/**
 * Where a practice finishes, read from the screens (F744, F137).
 *
 * There is no renderer in this workspace (docs/TESTING.md), so the only way to
 * hold the screens to the settle pipeline is to read them, the way
 * `progress/sittingWrites.test.ts` and `tutor/safetyView.test.ts` do. The
 * pipeline's own behaviour is proved in `settle.test.ts`; this file proves the
 * screens call it where, and only where, a sitting really finished.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../', import.meta.url));
const read = (relative: string): string => readFileSync(join(SRC, relative), 'utf8');

/** Comments may say anything; only what runs is under test. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const flat = (relative: string): string => stripComments(read(relative)).replace(/\s+/g, ' ');

const SETTLE_CALL = /\b(settleSitting|beginSettle|finishSettle|settleGuestHandoff)\(/g;

/** Where each settle call starts, in source order. */
function settleCalls(source: string): number[] {
  return [...source.matchAll(SETTLE_CALL)].map((m) => m.index!);
}

const at = (source: string, needle: string): number => {
  const i = source.indexOf(needle);
  assert.notEqual(i, -1, `this test is reading for "${needle}" and the source no longer contains it`);
  return i;
};

describe('a sitting settles where it finished, and nowhere else — F744', () => {
  test('a safety stop settles nothing', () => {
    // The conversation: one settle, inside the recap effect, after the stop
    // guard and before that effect closes, so a stopped session never reaches it.
    const convo = flat('ConvoScreen.tsx');
    const calls = settleCalls(convo);
    assert.equal(calls.length, 1, 'the conversation settles in more than one place, and a second one may not be guarded');
    const guard = at(convo, 'if (!live.recap || stopped) return;');
    assert.ok(guard < calls[0]!, 'the conversation settles before its stop guard');
    const effect = convo.slice(guard, calls[0]);
    assert.doesNotMatch(effect, /\}, \[/, 'the settle sits in a different effect from the stop guard');
    const closes = convo.indexOf('}, [live.recap, onRecap, stopped]);', calls[0]);
    assert.ok(closes > calls[0]!, 'the guarded effect no longer re-runs when the session is stopped');

    // The lesson: the live screen withholds its summary after a stop, and the
    // navigator settles only inside the callback that summary reaches.
    const lesson = flat('LiveSessionScreen.tsx');
    assert.match(lesson, /if \(live\.summary && !stopped && live\.settlement === null\) onFinish\(live\.summary\);/, 'a stopped lesson hands its summary on');
    assert.deepEqual(settleCalls(lesson), [], 'the live lesson settles by itself, beside its stop guard');
    const nav = flat('nav/RootNavigator.tsx');
    const navCalls = settleCalls(nav);
    assert.equal(navCalls.length, 1);
    const finish = at(nav, 'const finish = useCallback((s: SessionSummary, timing?: { activeMs: number }) => {');
    const finishEnd = at(nav, '}, [user]);');
    assert.ok(finish < navCalls[0]! && navCalls[0]! < finishEnd, 'the lesson settles outside the summary callback');
    assert.match(nav, /onFinish=\{finish\}/, 'the summary callback is no longer the live lesson\'s onFinish');

    // Nothing the stop surface can reach settles, imports the pipeline or names a celebration.
    for (const file of readdirSync(join(SRC, 'tutor')).filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))) {
      const source = stripComments(read(`tutor/${file}`));
      assert.deepEqual(settleCalls(source), [], `tutor/${file} settles a sitting`);
      assert.doesNotMatch(source, /game\/settle|game\/guestHandoff|publishCelebrations/, `tutor/${file} reaches the settle pipeline`);
    }
  });

  test('every place a practice finishes settles through game/settle.ts, and says it finished', () => {
    const sites: readonly { file: string; source: string; via: RegExp }[] = [
      { file: 'ConvoScreen.tsx', source: 'convo', via: /settleSitting\(\{ source: 'convo'/ },
      { file: 'nav/RootNavigator.tsx', source: 'lesson', via: /settleSitting\(\{ source: 'lesson'/ },
      { file: 'DrillScreen.tsx', source: 'drill', via: /settleSitting\(\{ source: 'drill'/ },
      { file: 'practice/completion.ts', source: 'drill', via: /finishSettle\(token, \{ source: 'drill'/ },
      { file: 'ReviewScreen.tsx', source: 'review', via: /settleSitting\(\{ source: 'review'/ },
      { file: 'daily/DailyPracticeScreen.tsx', source: 'phrase', via: /finishSettle\(settling, \{ source: 'phrase', at, xpEarned: 0/ },
      { file: 'onboarding/GuestAccountHandoff.tsx', source: 'guest', via: /settleGuestHandoff\(guest\)/ },
    ];
    for (const site of sites) {
      const body = flat(site.file);
      assert.match(body, site.via, `${site.file} no longer settles its ${site.source} sitting`);
      assert.match(body, /from '(\.\.\/|\.\/)game\/(settle|guestHandoff)\.ts'/, `${site.file} settles through something other than the one pipeline`);
    }

    // Each activity write a settle makes says the sitting finished, so a
    // zero-XP finished sitting is still a day (F731).
    for (const file of ['ConvoScreen.tsx', 'nav/RootNavigator.tsx', 'DrillScreen.tsx', 'ReviewScreen.tsx']) {
      const body = flat(file);
      const write = body.indexOf('recordActivity(');
      assert.ok(write >= 0, `${file} no longer writes its sitting, so this test is stale`);
      assert.match(body.slice(write, write + 500), /finished: true/, `${file} writes a sitting without saying it finished`);
    }

    // The daily phrase settles on its durable day, and gives the token back otherwise.
    const daily = flat('daily/DailyPracticeScreen.tsx');
    assert.ok(at(daily, 'await beginSettle()') < at(daily, 'await recordActiveDay()'), 'the daily phrase writes its day before the snapshot it is measured against');
    // The day binds to whoever is signed in when it is asked for: an account
    // that changed while the snapshot was read records nothing.
    assert.match(daily, /const settling = await beginSettle\(\); if \(owner !== scopeGeneration\(\)\) \{ releaseSettle\(settling\); return; \} const ack = await recordActiveDay\(\);/, 'the daily phrase records its day for an account that changed under its snapshot');
    const handoff = flat('game/guestHandoff.ts');
    assert.match(handoff, /const token = await beginSettle\(\); if \(!settleStillLive\(token\)\) \{ releaseSettle\(token\); return \{ ack: 'failed', delta: null \}; \}/, 'the guest hand-off writes for an account that changed under its snapshot');
    assert.match(daily, /if \(ack === 'durable'\) void finishSettle\(settling, [^;]*\); else releaseSettle\(settling\);/, 'the daily phrase settles a day that did not land');
    assert.doesNotMatch(daily, /useActiveClock\('phrase'\)/, 'the daily phrase asks for a clock kind the cutoff table does not have (review finding 13)');

    // The guest hand-off settles after the practice is saved and before the
    // saved screen, so the flame lights on "Your phrase is saved." (finding 11).
    const guest = flat('onboarding/GuestAccountHandoff.tsx');
    assert.ok(at(guest, "userKey('onboarding-practice')") < at(guest, 'settleGuestHandoff(guest)'));
    assert.ok(at(guest, 'settleGuestHandoff(guest)') < at(guest, 'setSaved(true);'));
  });

  test('a practice sitting settles only when the durable plan says this call completed it', () => {
    // The plan settles where it completes, whoever ran it: the screen's finish,
    // its retry, or the recovery three screens run at launch (review finding 9).
    // Its behaviour is proved in game/practiceSettle.test.ts; this holds the shape.
    const completion = stripComments(read('practice/completion.ts'));
    const runs = completion.slice(at(completion, 'async function runAndSettle('), at(completion, 'export function completePracticeSitting(')).replace(/\s+/g, ' ');
    // The snapshot comes first (or is the one a kept run already took), the plan writes after it.
    assert.ok(at(runs, 'beginSettle()') < at(runs, 'runPlan('), 'the plan can write before the snapshot it is measured against');
    assert.match(runs, /if \(done\.status === 'completed'\) \{ void finishSettle\(token, \{ source: 'drill', at: plan\.activityAt, xpEarned: plan\.xp,/, 'a practice sitting settles on a status other than completed, or at an instant the plan did not freeze');
    assert.match(runs, /\} else if \(done\.status === 'kept'\) \{ heldSettles\.set\(plan\.sittingId, token\); \} else \{ releaseSettle\(token\); \}/, 'a kept plan drops its snapshot, or any other answer keeps one holding the catch-up back');
    assert.match(runs, /releaseSettle\(token\); throw error;/, 'a plan that throws leaves its token open');
    assert.equal((runs.match(/finishSettle\(/g) ?? []).length, 1);
    // Every run of a plan goes through it: the finish, the other sitting's plan ahead of it, and the recovery.
    const flatCompletion = completion.replace(/\s+/g, ' ');
    assert.equal((flatCompletion.match(/\brunPlan\(/g) ?? []).length, 2, 'a plan runs somewhere that does not settle it');
    assert.equal((flatCompletion.match(/\brunAndSettle\(/g) ?? []).length, 5);
    const recover = flatCompletion.slice(at(flatCompletion, 'export function recoverPracticeCompletion('));
    assert.match(recover, /return runAndSettle\(bound, slot\.plan\);/, 'a plan finished on recovery is never settled');

    // The screen hands the plan over and settles nothing of its own for it.
    const screen = stripComments(read('DrillScreen.tsx'));
    const block = screen.slice(at(screen, 'const finishPractice = useCallback('), at(screen, 'const persistGrades = useCallback(')).replace(/\s+/g, ' ');
    assert.deepEqual(settleCalls(block), [], 'the drill screen settles a practice sitting beside the plan, so it could settle twice');

    // The bank sitting settles only when the set was worked to its end.
    const persist = screen.slice(at(screen, 'const persistGrades = useCallback('), at(screen, 'const answer = useCallback(')).replace(/\s+/g, ' ');
    assert.match(persist, /if \(state\.finished\) void settleSitting\(\{ source: 'drill'[^;]*write: bank \}\); else void bank\(\);/, 'a bank sitting left from the header settles, or a finished one does not');
    assert.match(persist, /\.\.\.\(state\.finished \? \{ finished: true \} : \{\}\)/, 'a bank sitting left early claims it finished');
  });

  test('the game layer is mounted once, and its one intro sheet never opens over a live room or an open microphone', () => {
    const app = stripComments(readFileSync(fileURLToPath(new URL('../../App.tsx', import.meta.url)), 'utf8'));
    assert.equal((app.match(/<GameProvider>/g) ?? []).length, 1, 'the game layer is mounted more than once, or not at all');
    assert.ok(at(app, '<GameProvider>') < at(app, '<NavigationContainer'), 'the screens sit outside the game layer');

    const provider = flat('game/GameProvider.tsx');
    assert.equal((provider.match(/<Sheet\b/g) ?? []).length, 1);
    assert.match(provider, /visible=\{intro !== null && !held\}/, 'the intro sheet can open while something holds the microphone or the room');
    assert.match(provider, /setHeld\(micLive\(\) \|\| liveRoom\(\)\)/, 'the sheet does not watch the microphone and the live room');
    assert.match(provider, /footer=\{<PillButton label=\{GAME_COPY\.continue\} onPress=\{dismissIntro\} \/>\}/, 'the intro sheet has something other than one Continue');
    assert.match(provider, /GAME_COPY\.intro\.body\(intro\.current, intro\.level\)/);
    assert.doesNotMatch(provider, /numberOfLines/, 'the intro text is clipped for a learner with large type');
  });

  test('a review sitting is banked once, whichever way it ends', () => {
    const screen = stripComments(read('ReviewScreen.tsx')).replace(/\s+/g, ' ');
    const bank = screen.slice(at(screen, 'const bankSitting = useRef('), at(screen, '}).current;'));
    // Set before anything is written (review finding 18).
    assert.ok(at(bank, 'banked.current = true;') < at(bank, 'recordActivity('), 'the sitting is written before it is marked banked');
    assert.match(bank, /if \(banked\.current \|\| \(finished \? graded\.current === 0 : recalled\.current === 0\)\) return;/);
    assert.match(bank, /if \(finished\) void settleSitting\(\{ source: 'review'[^;]*write \}\); else void write\(\);/, 'leaving early settles, or finishing does not');
    // Both ends go through the one function, and nothing else writes the sitting.
    assert.match(screen, /bankSitting\(false\);/, 'leaving the screen no longer banks what was recalled');
    assert.match(screen, /if \(finished\) bankSitting\(true\);/, 'emptying the queue no longer settles the sitting');
    assert.equal((screen.match(/recordActivity\(/g) ?? []).length, 1, 'a second writer can record the same sitting twice');
  });
});
