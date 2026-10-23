/**
 * The hand-off after the first run (come alive, README Part 5.C row 11).
 *
 * "Saved to your phrasebook." is said only once the phrasebook write is
 * durable, keyed by the stored phrase and never the learner's text; the time
 * with the tutor is the server's answer, free only on the free allowance; and
 * the app is told whether the practice was kept. The words are run; the screen
 * is read as source, because there is no renderer in this suite.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkStarter, starterTasks, type StarterTask } from '@luvani/core';
import { evidence } from '../../test/evidence.ts';
import { streakGuiltIn } from '../copy/guilt.ts';
import { tutorTimeLine } from './firstRun/copy.ts';
import type { GuestAttempt, GuestPractice } from './guestModel.ts';
import { keptPhrase, savedPhraseTasks } from './guestProgress.ts';
import { freshPreAccountDraft } from './preAccountDraft.ts';
import { onboardingProgress } from './onboardingProgress.ts';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { guestScenePhrases, phraseKeyOf, type GuestSceneTurnId } from '@luvani/core';
import { GuestClaimRefused, claimRefusalCopy, claimRefusalIsFinal, claimRefusalOf, scenePhrasebookEntries } from './guestScene.ts';
import { repairFirstLiveRecord } from './firstLiveModel.ts';
import { DEFAULT_TUTOR_VOICE } from '@luvani/core';

/** A reply the starter check really returned. */
function attempt(task: StarterTask, reply: string, extra: Partial<GuestAttempt> = {}): GuestAttempt {
  return { taskId: task.id, reply, feedback: checkStarter(task, reply, 'typed'), at: Date.UTC(2026, 9, 5, 9), offline: true, ...extra };
}

describe('the hand-off', () => {
  test('the hand-off retains the guest route through auth until its durable welcome completes', () => {
    const handoff = evidence('apps/mobile/src/onboarding/GuestAccountHandoff.tsx');
    const source = handoff.slice(handoff.indexOf('const progress = onboardingProgress('), handoff.indexOf('if (welcoming)'));
    assert.ok(source.startsWith('const progress'), 'this check must execute the production route assignment');
    for (const onboardingVariant of ['full', 'five'] as const) {
      for (const quickStart of [false, true]) {
        const draft = { ...freshPreAccountDraft(), onboardingVariant, quickStart, onboardingSkippedSteps: ['remind'] };
        const progress = new Function('journey', 'process', 'onboardingProgress', `${source}; return progress;`)(
          { current: draft }, { env: { EXPO_PUBLIC_ONBOARDING_VARIANT: 'full' } }, onboardingProgress,
        );
        const signup = onboardingProgress({ page: 'account', five: onboardingVariant === 'five',
          skipped: [...draft.onboardingSkippedSteps, ...(quickStart ? ['reason', 'interests', 'start-level', 'confidence', 'focus', 'time'] : [])] });
        assert.ok(progress.fraction > signup.fraction, 'signing in must not restart progress');
        assert.equal(progress.step, progress.total, 'the handoff is the last step of its guest journey');
        assert.equal(progress.total, signup.total);
        assert.equal(progress.complete, false, 'pending adoption is not completion');
        assert.ok(progress.fraction < 1);
      }
    }
    assert.match(handoff, /const journey = useRef\(draft\)/);
    assert.match(handoff, /<AccountWelcome progress=\{progress\}/);
  });

  test('the hand-off says a phrase is saved only after the durable write, and the time the server holds', () => {
    // The time with the tutor, from the server's seconds, rounded down, and
    // never a countdown: nothing when none is held, free only on the free allowance.
    assert.equal(tutorTimeLine(0, true), null);
    assert.equal(tutorTimeLine(-5, null), null);
    assert.equal(tutorTimeLine(Number.NaN, true), null);
    assert.equal(tutorTimeLine(45, true), 'You have less than a minute with your AI tutor.');
    assert.equal(tutorTimeLine(60, true), 'You have 1 free minute with your AI tutor.');
    assert.equal(tutorTimeLine(299, true), 'You have 4 free minutes with your AI tutor.');
    assert.equal(tutorTimeLine(10800, false), 'You have 180 minutes with your AI tutor on your plan.');
    assert.equal(tutorTimeLine(600, null), 'You have 10 minutes with your AI tutor.');
    for (const seconds of [45, 60, 1799, 10800]) {
      for (const free of [true, false, null]) {
        const line = tutorTimeLine(seconds, free)!;
        assert.equal(streakGuiltIn(line), undefined, `"${line}" counts down or nags`);
        assert.doesNotMatch(line, /seconds|left|[—–·!]/, `"${line}" ticks, counts down or shouts`);
      }
    }

    const handoff = evidence('apps/mobile/src/onboarding/GuestAccountHandoff.tsx');
    // The toast: after the durable phrasebook write, and before nothing else that could fail it.
    const durable = handoff.indexOf("if ((await addPhrases(phrases, { source: 'curated' })) !== 'durable')");
    const toast = handoff.indexOf('publishCelebrations(');
    assert.ok(durable > 0 && toast > durable, 'the phrase is said saved before the phrasebook write is durable');
    assert.equal((handoff.match(/publishCelebrations\(/g) ?? []).length, 1);
    assert.match(
      handoff,
      /publishCelebrations\(\[\{ type: 'phrase-saved', key: celebrationKey\.saved\(phraseKey\), origin: 'account', at: Date\.now\(\), data: \{ phraseKey \} \}\]\)/,
    );
    assert.match(handoff, /const phraseKey = phraseKeyOf\(newest\.fr\);/, 'the toast is keyed by something other than the stored phrase');
    assert.match(handoff, /fr: keptPhrase\(task\),/, 'the stored phrase is not the natural line');
    // The settle still follows the saved practice, and the screen turns to saved after it (game/sites.test.ts).
    assert.ok(handoff.indexOf("userKey('onboarding-practice')") < handoff.indexOf('settleGuestHandoff(guest)'));
    assert.ok(handoff.indexOf('settleGuestHandoff(guest)') < handoff.indexOf('setSaved(true);'));
    // The time: the server's status once saved, read in the background, for this account only.
    assert.match(handoff, /setSaved\(true\); void fetchBillingStatus\(uid\)\.then\(\(answer\) => \{ if \(mounted\.current && owner === scopeGeneration\(\) && activeUserId\(\) === uid\) setStatus\(answer\); \}\);/);
    assert.match(handoff, /tutorTimeLine\(status\.secondsRemaining, status\.plan === 'trial' \|\| status\.lapsed\)/, 'a paid plan is called free, or the free allowance is not');
    assert.match(handoff, /tutorTimeLine\(remaining, null\)/);
    assert.doesNotMatch(handoff, /seconds remaining/, 'the hand-off still counts seconds');
  });

  test('the hand-off and the guest home name only a phrase the practice saves', () => {
    const plan = { ...freshPreAccountDraft(), eligibilityConfirmed: true, reason: 'food' as const, drink: 'coffee' as const, minutes: 15 as const };
    const [a, b] = starterTasks('food', 'coffee', 15);
    assert.ok(a && b, 'a fifteen-minute food starter no longer has two exchanges');
    const practice = (attempts: GuestAttempt[], kept = false): Pick<GuestPractice, 'attempts' | 'kept' | 'plan'> => ({ attempts, kept, plan });
    const refused = attempt(b, 'xyz');
    assert.equal(refused.feedback.accepted, false, 'core accepts the miss this test relies on');
    // The walk that ended on a refused line saves the accepted one before it,
    // and that is the phrase both cards name, as its natural line.
    const walk = practice([attempt(a, a.model), refused]);
    assert.deepEqual(savedPhraseTasks(walk).map((t) => t.id), [a.id], 'a refused line is saved, or the accepted one is not');
    assert.equal(keptPhrase(savedPhraseTasks(walk).at(-1)!), a.model);
    // A refused line kept on purpose is saved, as its natural line.
    assert.deepEqual(savedPhraseTasks(practice([attempt(a, a.model), refused], true)).map((t) => t.id), [a.id, b.id]);
    assert.deepEqual(savedPhraseTasks(practice([attempt(a, 'xyz', { kept: true })])).map((t) => t.id), [a.id]);
    // Nothing accepted or kept is nothing saved, and nothing to name.
    assert.deepEqual(savedPhraseTasks(practice([refused])), []);
    assert.deepEqual(savedPhraseTasks(null), []);

    // The hand-off writes exactly those, and its card names the newest of
    // them, or says the practice is saved and names no phrase.
    const handoff = evidence('apps/mobile/src/onboarding/GuestAccountHandoff.tsx');
    assert.match(handoff, /const phrases = scene \? scenePhrasebookEntries\(scene\) : savedPhraseTasks\(guest\)\.map\(\(task\) => \(\{ fr: keptPhrase\(task\),/, 'the hand-off saves a different list from the one its card names');
    assert.match(handoff, /const shown = savedPhraseTasks\(guest\)\.at\(-1\);/);
    assert.match(handoff, /<Text accessibilityRole="header"[^>]*> \{saved \? \(shownLine \? 'Your phrase is saved\.' : 'Your practice is saved\.'\) : 'Keep this practice\?'\}/, 'the hand-off says a phrase is saved when none was');
    assert.match(handoff, /const shownLine = guest\.live\?\.scene \? guestScenePhrases\(guest\.live\.sceneTurns \?\? \[\]\)\.at\(-1\)\?\.fr : shown \? keptPhrase\(shown\) : undefined;/);
    assert.match(handoff, /\{shownLine \? <Text style=\{\[type\.heading, \{ textAlign: 'center' \}\]\}>\{shownLine\}<\/Text> : null\}/);
    assert.doesNotMatch(handoff, /attempts\.at\(-1\)\?\.feedback\.model/, 'the hand-off names the last line whether or not it was saved');
    const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');
    assert.doesNotMatch(screen, /homePhrase|<StreakCard/);
    assert.match(screen, /<FirstSessionSummary record=\{guest\.live\}/);
    assert.match(handoff, /loadConversationPackForLearner/);
  });
});

const raw = readFileSync(new URL('./GuestAccountHandoff.tsx', import.meta.url), 'utf8');
const keepSource = stripTypeScriptTypes(raw.slice(raw.indexOf('  const keep = async () => {'), raw.indexOf('  const finish = async () => {')));
const finishSource = stripTypeScriptTypes(raw.slice(raw.indexOf('  const finish = async () => {'), raw.indexOf('  if (readError) return')));
const sessionId = '11111111-1111-4111-8111-111111111111';
const brief = { version: 1 as const, goals: [], level: 'zero' as const, confidence: null, focus: null, minutes: null, tutorVoice: DEFAULT_TUTOR_VOICE };

/** Run the production keep() and finish() with every outside effect recorded. */
async function runHandoff(guest: Partial<GuestPractice>, claim: () => Promise<{ secondsRemaining: number | null; sceneTurns: GuestSceneTurnId[] }>, which: 'keep' | 'finish' = 'keep') {
  const calls: string[] = [];
  const written: unknown[] = [];
  let error = '';
  const world = {
    user: { id: 'u1', email: 'a@b.c' }, adapter: {}, guest, saved: false, newlyCreated: false, resumeAdoption: false,
    operation: { current: false }, finished: { current: false }, mounted: { current: true },
    setBusy: () => {}, setError: (value: string) => { error = value; }, setRemaining: () => {}, setSaved: () => calls.push('saved'),
    setGuest: () => {}, setStatus: () => {}, setWelcoming: () => {}, onDone: (kept: boolean) => calls.push(kept ? 'done-kept' : 'done-fresh'),
    scopeGeneration: () => 1, activeUserId: () => 'u1',
    claimGuestPractice: async () => { calls.push('claim'); return claim(); },
    adoptGuestUsage: async () => { calls.push('claim'); return (await claim()).secondsRemaining; },
    loadConversationPackForLearner: async () => { calls.push('pack'); return { ok: true, pack: { sessionId } }; },
    savedPhraseTasks: () => [], keptPhrase: () => '', scenePhrasebookEntries,
    addPhrases: async (phrases: unknown[]) => { written.push(...phrases); calls.push('phrases'); return 'durable'; },
    phraseKeyOf, publishCelebrations: () => calls.push('toast'), celebrationKey: { saved: (k: string) => k },
    userKey: (k: string) => k, writeInUserScope: async (_o: number, work: () => Promise<void>) => { await work(); return true; },
    AsyncStorage: { setItem: async (_k: string, v: string) => { calls.push('practice'); written.push(JSON.parse(v)); } },
    settleGuestHandoff: async () => { calls.push('settle'); return { ack: 'durable' }; },
    loadArrival: async () => null, saveArrival: async () => { calls.push('arrival'); },
    fetchBillingStatus: async () => null, clearGuestPractice: async () => { calls.push('clear'); },
    GuestClaimRefused, claimRefusalIsFinal,
  };
  const body = which === 'keep' ? `${keepSource}; return keep();` : `${finishSource}; return finish();`;
  await new Function(...Object.keys(world), body)(...Object.values(world));
  return { calls, written, error };
}

describe('the café scene hand-off', () => {
  const sceneGuest = (turns: GuestSceneTurnId[]): Partial<GuestPractice> => ({
    token: 'x'.repeat(43), attempts: [], kept: false, finishedAt: [Date.UTC(2026, 9, 23)],
    live: { brief, sessionId, outcome: 'completed', contributions: [], seconds: 120, completedAt: Date.UTC(2026, 9, 23), pack: null, scene: 'guest-cafe', sceneTurns: turns },
  });

  test('keep() saves exactly the server scene lines, loads no pack, and settles day one once', async () => {
    const server: GuestSceneTurnId[] = ['t1-greet', 't2-order', 't12-goodbye'];
    const h = await runHandoff(sceneGuest(['t1-greet']), async () => ({ secondsRemaining: 300, sceneTurns: server }));
    assert.equal(h.error, '');
    assert.ok(!h.calls.includes('pack'), 'a scene has no conversation pack to load');
    assert.equal(h.calls.filter((c) => c === 'settle').length, 1, 'day one is settled exactly once');
    assert.equal(h.calls.filter((c) => c === 'claim').length, 1);
    const phrases = h.written.filter((w) => (w as { register?: string }).register === 'courant') as { fr: string; en: string }[];
    assert.deepEqual(phrases.map(({ fr, en }) => ({ fr, en })), guestScenePhrases(server).map(({ fr, en }) => ({ fr, en })));
    assert.ok(h.calls.indexOf('phrases') < h.calls.indexOf('toast'), 'saved is said only after the durable write');
    const practice = h.written.find((w) => (w as { version?: number }).version === undefined && (w as { live?: unknown }).live) as { token: unknown; live: { sceneTurns: unknown } };
    assert.equal(practice.token, null);
    assert.deepEqual(practice.live.sceneTurns, server, 'the kept record holds the server ids');
  });

  test('a refused claim shows its own calm line and saves nothing', async () => {
    const lines = new Set<string>();
    for (const code of ['guest-claimed-elsewhere', 'guest-expired', 'guest-active'] as const) {
      const h = await runHandoff(sceneGuest(['t1-greet']), async () => { throw new GuestClaimRefused(code); });
      assert.equal(h.error, claimRefusalCopy(code));
      assert.ok(!h.calls.includes('phrases') && !h.calls.includes('settle'));
      assert.doesNotMatch(h.error, /[—–!]/);
      lines.add(h.error);
    }
    assert.equal(lines.size, 3, 'each reason has its own words');
    assert.ok(![...lines].includes(claimRefusalCopy(null)), 'no reason falls back to the generic line');
    assert.equal(claimRefusalOf('guest-expired'), 'guest-expired');
    assert.equal(claimRefusalOf('something-else'), null);
  });

  test('Start fresh claims and imports nothing, and still finishes when the claim can never succeed', async () => {
    const fresh = await runHandoff(sceneGuest(['t1-greet']), async () => ({ secondsRemaining: 0, sceneTurns: ['t1-greet'] }), 'finish');
    assert.deepEqual(fresh.calls, ['claim', 'clear', 'done-fresh']);
    for (const code of ['guest-claimed-elsewhere', 'guest-expired'] as const) {
      const h = await runHandoff(sceneGuest([]), async () => { throw new GuestClaimRefused(code); }, 'finish');
      assert.deepEqual(h.calls, ['claim', 'clear', 'done-fresh']);
    }
    const busy = await runHandoff(sceneGuest([]), async () => { throw new GuestClaimRefused('guest-active'); }, 'finish');
    assert.deepEqual(busy.calls, ['claim'], 'a scene still finishing keeps the practice here');
  });

  test('the legacy conversation record still adopts through its pack', async () => {
    const legacy: Partial<GuestPractice> = { token: 'x'.repeat(43), attempts: [], kept: false,
      live: { brief, sessionId, outcome: 'partial', contributions: [], seconds: 60, completedAt: null, pack: { id: 'p1', sessionId } as never } };
    const h = await runHandoff(legacy, async () => ({ secondsRemaining: 300, sceneTurns: [] }));
    assert.ok(h.calls.includes('pack'), 'a conversation still links its pack');
    assert.equal(h.calls.filter((c) => c === 'settle').length, 1);
  });

  test('a scene record keeps turn ids only, never learner text', () => {
    const record = repairFirstLiveRecord({ brief, sessionId, outcome: 'completed', seconds: 90, completedAt: 1, pack: null, scene: 'guest-cafe',
      sceneTurns: ['t2-order', 't1-greet'], contributions: [{ id: 'u1', text: 'je voudrais un café', input: 'typed' }], transcript: 'free text' });
    assert.ok(record);
    assert.deepEqual(record.contributions, []);
    assert.deepEqual(record.sceneTurns, ['t1-greet', 't2-order']);
    assert.doesNotMatch(JSON.stringify(record), /je voudrais|free text/);
    for (const bad of [{ sceneTurns: ['t1-greet', 'made-up'] }, { pack: {} }, { scene: 'other' }, { completedAt: null }])
      assert.equal(repairFirstLiveRecord({ brief, sessionId, outcome: 'completed', seconds: 90, completedAt: 1, pack: null, scene: 'guest-cafe', sceneTurns: ['t1-greet'], contributions: [], ...bad }), null);
  });
});
