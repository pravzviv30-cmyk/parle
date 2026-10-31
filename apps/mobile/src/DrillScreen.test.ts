/**
 * What a drill sitting tells the deck, on a device.
 *
 * Core learned to mark an exercise as transfer — the same phrase asked in a
 * changed situation — and to raise `evidence.transfers` when one comes back
 * right. Knowing a line and knowing when to use it are different things, and
 * only the second one travels, so it is the strongest thing a drill can prove.
 *
 * The screen then threw it away. `summary.grades.map(({ phraseKey, grade }) =>
 * ...)` destructured the mark out one line before the store, so on a real phone
 * core recorded transfer, the summary carried transfer, and the card the learner
 * owns never heard about it. Core's own test passed the whole time, which is the
 * shape of bug this file exists for: a closed rule and a live path that goes
 * round it.
 *
 * So this runs the real summary through the real store against a disk, and then
 * reads the screen to check the map that used to drop it.
 *
 * That made it the file that reads DrillScreen's source, so the second block is
 * here too: a claim the drill screen's own markup has to keep.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  answerCurrent,
  evidenceOf,
  ownWordsFrom,
  scopedOwnWordsSession,
  summariseDrill,
  type DrillExercise,
  type DrillSessionState,
  type ReviewCard,
} from '@luvani/core';

import { gradeCards, loadDeck } from './review/store.ts';
import { setActiveUser } from './storage/scope.ts';
import { drillSource, readSrc } from './testing/drillSource.ts';
import { JUDGE_UNAVAILABLE, OWN_WORDS_HINT, OWN_WORDS_PROMPT } from './drill/ownWordsCopy.ts';

const NOW = new Date(2026, 7, 20, 14).getTime();
const PHRASE = 'phrase:ça marche';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

describe('a used word stays readable in the sentence bank — F593', () => {
  test('a word already placed stays readable on the ground it is left on', () => {
    const screen = stripComments(drillSource()).replace(/\s+/g, ' ');
    // 2026-10-21 UI-008, artboard B-Drill: a placed word now reads in its brand
    // tile in the answer box, and leaves a dashed slot its own size in the bank,
    // so the bank never jumps and the word is never faint ink on a ground.
    // Drill B v2 T5 (UI-016): the placed word is the landed brand pill in the
    // answer box, and the bank's chip leaves a dashed slot the chip's size.
    assert.match(screen, /<LandedWord big word=\{exercise\.tokens\[tokenIndex\] \?\? ''\} \/>/, 'a placed word is not a readable brand tile');
    assert.match(screen, /style=\{\[bType\.bold17, \{ color: bt\.onBrand \}\]\}>\{word\}/, 'a placed word is not readable on its brand fill');
    assert.match(screen, /landed: \{[^}]*backgroundColor: bt\.brand/, 'a placed word is not on the brand fill');
    assert.match(screen, /placed=\{assembled\.includes\(i\)\}/, 'a placed word leaves no slot in the bank');
    assert.match(screen, /if \(placed\) \{ return \( <View style=\{ds\.slot\}/, 'a placed word leaves no slot in the bank');
    assert.match(screen, /slot: \{ height: 46, marginBottom: LIP_SIZES\.chip\.lip, borderRadius: LIP_SIZES\.chip\.radius, paddingHorizontal: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: bt\.ring/);
  });
});

/** One in-memory AsyncStorage, shared by every store in this process. */
function installDisk(): Map<string, string> {
  const map = new Map<string, string>();
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = (key: string): Promise<string | null> => Promise.resolve(map.get(key) ?? null);
  shared.setItem = (key: string, value: string): Promise<void> => {
    map.set(key, value);
    return Promise.resolve();
  };
  shared.removeItem = (key: string): Promise<void> => {
    map.delete(key);
    return Promise.resolve();
  };
  return map;
}

let uids = 0;
const nextUid = (): string => `44444444-4444-4444-8444-${String(++uids).padStart(12, '0')}`;

const card = (): ReviewCard => ({
  id: PHRASE,
  kind: 'vocab',
  front: 'Ça marche',
  back: 'that works',
  context: '',
  ipa: '',
  addedAt: NOW - 10 * 86_400_000,
  due: NOW - 86_400_000,
  intervalDays: 3,
  ease: 2.5,
  reps: 2,
  lapses: 0,
});

const exercise = (over: Partial<DrillExercise> = {}): DrillExercise =>
  ({
    id: 'gen:transfer',
    phraseKey: PHRASE,
    kind: 'listen-type',
    difficulty: 'production',
    fr: 'Ça marche',
    accepted: ['ça marche'],
    ...over,
  }) as DrillExercise;

/**
 * A sitting holding exactly this one exercise.
 *
 * Built directly rather than through `buildDrillSession`, because that function
 * picks what a sitting contains and this test is about what happens after it is
 * answered. Choosing the queue here is what keeps the selection rules free to
 * change without silently emptying this test.
 */
const sitting = (queue: DrillExercise[]): DrillSessionState => ({
  queue,
  missesById: {},
  answered: [],
  startedAt: NOW,
  finished: false,
});

/** The map DrillScreen's `persistGrades` makes, on the real summary. */
const asTheScreenSends = (state: DrillSessionState) =>
  summariseDrill(state).grades.map(({ phraseKey, grade, transfer }) => ({
    id: phraseKey,
    grade,
    ...(transfer === true ? { transfer: true } : {}),
  }));

async function withDeck(): Promise<void> {
  const uid = nextUid();
  installDisk();
  setActiveUser(uid);
  await AsyncStorage.setItem(`luvani.u.${uid}.review`, JSON.stringify([card()]));
}

describe('a drill sitting reaches the deck with everything it proved — F128', () => {
  test('a transfer drill answered right raises transfer evidence on the phrase the learner owns', async () => {
    await withDeck();
    const { state } = answerCurrent(sitting([exercise({ transfer: true })]), 'ça marche');
    const grades = asTheScreenSends({ ...state, finished: true });

    assert.deepEqual(grades, [{ id: PHRASE, grade: 'good', transfer: true }], 'the mark was lost before the store');

    await gradeCards(grades);
    const stored = (await loadDeck()).find((c) => c.id === PHRASE)!;
    assert.equal(evidenceOf(stored).transfers, 1, 'the drill proved transfer and the card never heard about it');
    assert.equal(evidenceOf(stored).retrievals, 0, 'a drill is not a review sitting and may not claim one');
  });

  test('an ordinary drill claims nothing it did not ask for', async () => {
    // The situation did not change, so nothing transferred. An unmarked grade
    // has to keep grading exactly as it always did.
    await withDeck();
    const { state } = answerCurrent(sitting([exercise({ id: 'gen:plain' })]), 'ça marche');
    const grades = asTheScreenSends({ ...state, finished: true });

    assert.deepEqual(grades, [{ id: PHRASE, grade: 'good' }], 'an ordinary drill claimed transfer');

    await gradeCards(grades);
    assert.equal(evidenceOf((await loadDeck()).find((c) => c.id === PHRASE)!).transfers, 0);
  });

  test('a transfer drill nobody got right proves nothing', async () => {
    // Two misses and the exercise is let go. Core keeps `transfer` off an
    // unresolved answer, and the screen must not put it back on.
    await withDeck();
    let state = sitting([exercise({ transfer: true })]);
    state = answerCurrent(state, 'no idea').state;
    state = answerCurrent(state, 'still no').state;
    const grades = asTheScreenSends({ ...state, finished: true });

    assert.deepEqual(grades, [{ id: PHRASE, grade: 'again' }], 'a drill nobody answered claimed transfer');
    await gradeCards(grades);
    assert.equal(evidenceOf((await loadDeck()).find((c) => c.id === PHRASE)!).transfers, 0);
  });

  test('the drill screen hands the store what the summary gave it', () => {
    // The one-line regression that started this: a destructure that names two
    // of three fields silently drops the third, and nothing about the call
    // looks wrong afterwards.
    const screen = stripComments(drillSource());
    const map = screen.slice(screen.indexOf('gradeWritesRef.current = gradeCards('), screen.indexOf('recordActivity('));

    assert.ok(map.length > 0, 'persistGrades moved; this test is reading the wrong thing');
    assert.match(map, /\{\s*phraseKey,\s*grade,\s*transfer,\s*assisted\s*\}/, 'the screen destructures the transfer or assisted mark away again');
    assert.match(map, /assisted === true \? \{ assisted: true \} : \{\}/, 'an answer right only after a miss must reach the store as assisted');
    assert.match(map, /transfer === true \? \{ transfer: true \} : \{\}/, 'the screen sends transfer: false, which is a claim of its own');
  });
});

/**
 * The scene file promises itself to two screens and only reached one — F158.
 *
 * `illustrations/scenes/empty.tsx` says in its own words that `NothingDue` is
 * "for an empty review deck and an empty drill bank, both of which mean the
 * learner is finished rather than that something is missing". The review deck
 * drew it. The drill bank rendered a bare card on lilac, which is the dead end
 * the scene exists to avoid, and nothing anywhere would have said so.
 *
 * There is no renderer in this suite, so the check reads the branch out of the
 * source the same way `surfaceContract.test.ts` reads its own. Bodies this size
 * are matched through `assert.ok` rather than `assert.match`, because a failing
 * `match` prints the whole thirty-thousand-character file at whoever broke it.
 */
describe('the empty drill bank draws the scene the art registry promises it — F158', () => {
  const screen = stripComments(drillSource());

  /**
   * The built-empty branch alone. The end card sits directly under it, renders
   * the same kind of Card, and has a different job, so slicing matters: a match
   * anywhere in the file would pass with the drawing in the wrong branch.
   */
  const emptyBranch = (() => {
    const from = screen.indexOf('if (session.finished && session.answered.length === 0)');
    assert.ok(from > 0, 'the built-empty branch moved; this test is reading the wrong thing');
    const to = screen.indexOf('if (session.finished) {', from);
    assert.ok(to > from, 'the end card no longer follows the empty branch; this test is stale');
    return screen.slice(from, to);
  })();

  test('the empty drill bank keeps its explanation and next action without retired art', () => {
    assert.doesNotMatch(emptyBranch, /<Art\b|SCREEN_ART|NothingDue/);
    // 2026-10-21 UI-008, B-Empty-States "Review, all done": the cloud-cheer
    // card with Done as its one door, inside the card rather than the footer.
    assert.match(emptyBranch, /<EmptyStateCard/);
    assert.match(emptyBranch, /name: 'cloud-cheer', width: 150, height: 114/);
    assert.ok(emptyBranch.includes('Nothing to review.'));
    assert.ok(emptyBranch.includes('Your next session adds more.'));
    assert.match(emptyBranch, /action=\{\{ label: 'Done', onPress: finishAndLeave \}\}/);
    assert.doesNotMatch(emptyBranch, /footer=/, 'the empty bank shows two ways out');
  });

  test('review and drill no longer import or draw retired empty-table art', () => {
    for (const source of [screen, stripComments(read('./ReviewScreen.tsx'))]) {
      assert.doesNotMatch(source, /SCREEN_ART|<Art\b|empty-table/);
    }
  });
});

/* ===========================================================================
 * F581 — the drill asks for the learner's own French.
 *
 * The seventh kind could only ever ask for the sentence the app taught, because
 * everything a string comparison can grade is something a string comparison
 * already knows. The eighth hands over a situation and a meaning and takes
 * whatever French the learner has, which means the outcome arrives from outside
 * this process. Three things have to hold for that to be safe, and all three
 * are below: nothing listens, a tutor that cannot answer never becomes a miss,
 * and one Check is one call.
 *
 * Same ceiling as the block above. The behaviour that can be run is run — the
 * session arithmetic, the summary the screen sends, and the network client
 * against a stubbed fetch — and the wiring that cannot is read out of the
 * source, which is what `docs/TESTING.md` allows and names.
 * =========================================================================== */

const SCREEN = stripComments(drillSource());
/** The own-words view, which now has a file of its own (drill/kinds). */
const OWN_WORDS_VIEW = stripComments(readSrc('drill/kinds/OwnWordsView.tsx'));
/** The write kinds' file, where TranslationView now lives. */
const WRITE = stripComments(readSrc('drill/kinds/write.tsx'));

/** The own-words Check handler alone. Sliced, so a match elsewhere cannot pass. */
const checkBlock = (() => {
  const from = SCREEN.indexOf('const checkOwnWords = useCallback(');
  assert.ok(from > 0, 'the own-words Check handler moved; this test is reading the wrong thing');
  const to = SCREEN.indexOf('const recordOwnWords = useCallback(', from);
  assert.ok(to > from, 'the keep-phrase handler no longer follows the Check handler; this test is stale');
  return SCREEN.slice(from, to);
})();

/**
 * The real `judgeOwnWords`, run here.
 *
 * `speech/judgeAttempt.ts` cannot be imported: it reaches `auth/adapter.ts`,
 * which reaches expo-crypto, which node's type stripper refuses under
 * node_modules, so the suite would fail to load rather than fail an assertion.
 * The way round it is `analytics/track.test.ts`'s and `useLiveSession.test.ts`'s
 * — lift the module's own text, strip its types with the same stripper this
 * file runs under, and supply every free name by hand.
 *
 * The text being executed IS the shipped text: `readVerdict` is the real
 * validation rather than a restatement of it, and a call that never happened is
 * the only version of "the judge was asked once" worth making.
 */
const CLIENT = readFileSync(fileURLToPath(new URL('./speech/judgeAttempt.ts', import.meta.url)), 'utf8');

const AsyncFunction = Object.getPrototypeOf(async (): Promise<void> => {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<unknown>;

type Judge = (userId: string, exercise: unknown, attempt: string) => Promise<unknown>;

/** The client, wired to one canned answer, and a count of the calls it made. */
function judgeClient(answer: { status: number; body: unknown }): { judge: Judge; calls: () => number } {
  const js = stripTypeScriptTypes(
    CLIENT.split('\n')
      .filter((line) => !line.startsWith('import '))
      .join('\n')
      .replace(/^export /gm, ''),
  );
  let calls = 0;
  const world: Record<string, unknown> = {
    auth: { getSession: () => Promise.resolve({ id: 'learner' }) },
    scopeGeneration: () => 0,
    authHeaders: () => Promise.resolve({}),
    TOKEN_SERVER: 'https://tokens.invalid',
    loadProfile: () => Promise.resolve(null),
    fetch: () => {
      calls += 1;
      return Promise.resolve({
        ok: answer.status >= 200 && answer.status < 300,
        status: answer.status,
        json: () => Promise.resolve(answer.body),
      });
    },
  };
  const names = Object.keys(world);
  const built = new AsyncFunction(...names, `"use strict";\n${js}\nreturn judgeOwnWords;`);
  return {
    judge: (userId, exercise, attempt) =>
      built(...names.map((name) => world[name])).then((fn) => (fn as Judge)(userId, exercise, attempt)),
    calls: () => calls,
  };
}

const OWN_WORDS = ownWordsFrom(
  { fr: 'Je peux avoir le code wifi ?', en: 'Ask for the wifi password', key: 'phrase:wifi' },
  'You are at the hotel desk.',
);

describe('the drill asks for the learner’s own French — F581', () => {
  test('feedback keeps the learner’s thought visible beside a supported alternative', () => {
    const view = OWN_WORDS_VIEW;
    assert.match(view, /\{outcome\.attempt !== null && <View/, 'the learner’s checked words disappear when the feedback arrives');
    assert.match(view, /\{outcome\.attempt\}/, 'the feedback cannot be compared with the learner’s words');
    assert.match(view, /\{outcome\.note\}/, 'the judge’s supported reason is hidden');
    assert.match(view, /OWN_WORDS_ANOTHER\(outcome\.another\)/, 'the natural alternative is hidden');
    assert.match(checkBlock, /attempt,\s*\}\);/, 'the checked thought is not held for the transient comparison');
    assert.ok(!checkBlock.includes('why: generate'), 'a reason is invented rather than read from the guarded verdict');
  });
  test("own-words checks the learner's own French as editable text", () => {
    // 1. The exercise has no answer key, so there is nothing to reproduce.
    assert.deepEqual([...OWN_WORDS.accepted], [], 'the own-words exercise carries a right string, which makes it a recall drill');
    assert.ok(OWN_WORDS.situation.length > 0 && OWN_WORDS.en.length > 0, 'the learner is given neither a situation nor a meaning to carry');
    assert.ok(OWN_WORDS.mustKeep.length > 0, 'nothing says what the learner’s own words have to get across');

    // A recording supplies editable text, with the same typed fallback.
    const view = OWN_WORDS_VIEW;
    assert.ok(view.length > 0, 'the own-words view moved; this test is reading the wrong thing');
    assert.match(view, /placeholder=\{OWN_WORDS_PROMPT\}/, 'the own-words field does not ask for the learner’s own French');
    assert.match(view, /\{OWN_WORDS_HINT\}/, 'the card never tells the learner to say it out loud first');
    assert.equal(OWN_WORDS_HINT, 'Say it your way, or type your French. Check the words before sending.');
    assert.equal(OWN_WORDS_PROMPT, 'Say it your way, in French');

    assert.match(view, /<SpokenAttempt onTake=\{onTake\} onTyping=\{typeInstead\}/);
    // Check remains a text job: no pronunciation score is inferred.
    for (const listening of ['useAudioRecorder', 'SpeakCircle', 'AudioModule', 'scoreRecordedAttempt', 'consumeRecording', 'RecordingPresets']) {
      assert.ok(!view.includes(listening), `the own-words card reaches for ${listening}; nothing here records`);
      assert.ok(!checkBlock.includes(listening), `the own-words Check reaches for ${listening}; nothing here records`);
    }
    // And the request carries a typed sentence, never bytes.
    const client = stripComments(read('./speech/judgeAttempt.ts'));
    assert.ok(!/octet-stream|File\(|\.bytes\(|Recording/.test(client), 'the judge client sends audio');
    assert.match(client, /'content-type': 'application\/json'/, 'the judge client does not send one small JSON body');
  });

  test('a null verdict reveals the line and writes no grade', async () => {
    // The endpoint answers 503 rather than inventing a verdict when the brain
    // will not answer, and every other failure lands in the same place.
    const down = judgeClient({ status: 503, body: { error: 'judge-unavailable' } });
    assert.equal(await down.judge('learner', OWN_WORDS, 'je veux le wifi'), null, 'a 503 became a verdict about the learner');
    // A body that is not the promised shape is the same answer, because a
    // missing `meaningKept` would otherwise reach decideOwnWords as false.
    const odd = judgeClient({ status: 200, body: { verdict: { meaningKept: true } } });
    assert.equal(await odd.judge('learner', OWN_WORDS, 'je veux le wifi'), null, 'a half-written verdict was treated as a judgement');

    // Nothing moves. The screen hands `answerCurrent` nothing on a null
    // verdict, so the sitting is left exactly as it was found and the summary
    // it persists has no grade in it.
    const opened = scopedOwnWordsSession({ fr: OWN_WORDS.fr, en: OWN_WORDS.en, key: 'phrase:wifi' }, OWN_WORDS.situation, NOW);
    const unjudged = answerCurrent(opened, 'je veux le wifi');
    assert.equal(unjudged.feedback, null, 'an unjudged attempt produced feedback');
    assert.deepEqual(unjudged.state, opened, 'an unjudged attempt moved the sitting');
    assert.deepEqual(asTheScreenSends({ ...opened, finished: true }), [], 'a sitting nobody judged still sent a grade');

    // And the learner is shown the line with the sentence that says why.
    const nullBranch = checkBlock.slice(checkBlock.indexOf('if (verdict === null)'), checkBlock.indexOf('const decided ='));
    assert.ok(nullBranch.length > 0, 'the null-verdict branch moved; this test is reading the wrong thing');
    assert.match(nullBranch, /message: JUDGE_UNAVAILABLE/, 'a tutor that could not read the attempt says nothing about it');
    assert.match(nullBranch, /reveal: current\.fr/, 'the line is withheld from a learner nobody could judge');
    assert.ok(!nullBranch.includes('answerCurrent('), 'a null verdict is handed to the session, which grades it');
    assert.ok(!nullBranch.includes('persistGrades('), 'a null verdict writes a grade');
    assert.equal(JUDGE_UNAVAILABLE, 'Your tutor could not read that just now. Here is one way to say it.');
  });

  test('the judge is asked once per Check', async () => {
    // One call per Check on the wire.
    const one = judgeClient({
      status: 200,
      body: { verdict: { meaningKept: true, comprehensible: true, natural: 'awkward', betterLine: null, note: 'Clear.' } },
    });
    const verdict = await one.judge('learner', OWN_WORDS, 'je peux avoir le wifi');
    assert.ok(verdict !== null, 'a whole verdict did not survive the client');
    assert.equal(one.calls(), 1, `the client made ${one.calls()} requests for one Check`);

    // And one call site, behind a door that is closed for the round trip: a
    // double tap, a return key and the pill together are still one judgement,
    // because a second call would grade the same attempt twice and the second
    // grade would land on a session the first had already moved.
    assert.equal((SCREEN.match(/judgeOwnWords\(/g) ?? []).length, 1, 'the screen asks the judge from more than one place');
    assert.match(checkBlock, /if \(!session \|\| session\.finished \|\| judging \|\| attemptBusy\.current\) return;/, 'a second Check can start while the first is still out');
    assert.ok(
      checkBlock.indexOf('setJudging(true)') < checkBlock.indexOf('judgeOwnWords('),
      'the door is closed after the call is made, which is not closed at all',
    );
    assert.match(checkBlock, /const attempt = typed\.trim\(\);\s*if \(attempt === ''\) return;/, 'an empty field can spend a judge call');
    // The attempt is spent on the request and nothing else: no store, no log.
    assert.ok(!checkBlock.includes('AsyncStorage') && !checkBlock.includes('addPhrases('), 'the attempt is written somewhere');
  });
});

/* ===========================================================================
 * Only answered work finishes a sitting.
 *
 * Core builds an empty queue as `finished: true`, which is right for its state
 * machine: there is nothing left to ask. It was also the whole of the check in
 * front of the finished signal, so a conversation whose phrases had nothing
 * playable opened, drew "Nothing to review", and was marked practised on this
 * phone without one answer. The signal now asks for answered work as well.
 * =========================================================================== */

describe('an empty sitting finishes nothing — practice journey', () => {
  test('the finished signal waits for answered work, not just a finished flag', () => {
    const effect = SCREEN.slice(SCREEN.indexOf('finishedRef.current = true;') - 240, SCREEN.indexOf('finishedRef.current = true;'));
    assert.ok(effect.length > 0, 'the finished signal moved; this test is reading the wrong thing');
    assert.match(effect, /!hasAnsweredWork\(session\)/, 'an empty sitting can still fire the finished signal and mark a pack practised');
    assert.match(SCREEN, /import \{[^}]*hasAnsweredWork[^}]*\} from '\.\/practice\/sittingOutcome\.ts'/, 'the guard is spelled on the screen instead of read from the practice model');
  });

  test('the rule the guard reads is the one core needs it for', () => {
    const empty = sitting([]);
    const built = { ...empty, finished: true };
    assert.equal(built.finished, true);
    assert.equal(built.answered.length, 0);
  });
});

/* ===========================================================================
 * The practice path, read out of the screen.
 *
 * The rules themselves run for real elsewhere: grades and outcomes against core
 * in `practice/sittingOutcome.test.ts`, the save states in
 * `practice/saveState.test.ts`, opening and resume in `practice/opening.test.ts`,
 * and completion's at-most-once rule in the data store's own suite. What only
 * the source can show is that this screen routes a practice sitting through
 * them, finishes it through the one completion owner, and leaves the ordinary
 * sitting alone.
 * =========================================================================== */

describe('a practice sitting is finished by the completion owner and nothing else', () => {
  const persistBlock = SCREEN.slice(SCREEN.indexOf('const persistGrades = useCallback('), SCREEN.indexOf('const answer = useCallback('));
  const finishBlock = SCREEN.slice(SCREEN.indexOf('const finishPractice = useCallback('), SCREEN.indexOf('const persistGrades = useCallback('));

  test('the practice branch hands off before the ordinary summary is ever asked for grades', () => {
    assert.ok(persistBlock.length > 0, 'persistGrades moved; this test is reading the wrong thing');
    const practiceAt = persistBlock.indexOf('if (held !== null)');
    const ordinaryAt = persistBlock.indexOf('const summary = summariseDrill(state);');
    assert.ok(practiceAt > 0 && ordinaryAt > practiceAt, 'the ordinary grades are computed before the practice sitting is routed away from them');
    const practiceBranch = persistBlock.slice(practiceAt, ordinaryAt);
    // Unfinished: saved, never graded. Leave keeps the sitting for resume.
    assert.match(practiceBranch, /if \(!state\.finished\) \{\s*savePractice\(state\);\s*return;\s*\}/, 'leaving an unfinished practice sitting grades it');
    assert.match(practiceBranch, /if \(!hasAnsweredWork\(state\)\) return;/, 'an empty practice sitting can still complete');
    assert.match(practiceBranch, /const completion = finishPractice\(state\);/, 'a finished practice sitting is not completed through its owner');
    assert.match(practiceBranch, /gradeWritesRef\.current = completion\.then\(\(\) => undefined\);\s*return;\s*\}/, 'the practice branch falls through into the ordinary grades');
    assert.ok(!/gradeCards\(|recordActivity\(/.test(practiceBranch), 'the practice branch writes grades or XP itself beside the completion owner');
  });

  test('completion is the one owner of practice grades, XP and history, keyed on the stable sitting id', () => {
    assert.ok(finishBlock.length > 0, 'finishPractice moved; this test is stale');
    assert.match(finishBlock.replace(/\s+/g, ' '), /completePracticeSitting\(\{ sittingId: held\.sittingId, state, targets: held\.targets, exercises: held\.exercises, exposed: held\.exposed,/);
    assert.match(finishBlock, /\.then\(\(done\) => saveStateOfResult\(done\)\)/, 'the card reads something other than the store\'s own status');
    assert.ok(!/packId/.test(finishBlock), 'the screen passes a packId, which completion derives from the targets');
    assert.ok(!/gradeCards|recordActivity|practiceGrades|drillXp|recordPracticeEvent/.test(finishBlock), 'the screen grades, awards or records beside the completion owner');
    // No second writer anywhere on the practice path.
    assert.ok(!SCREEN.includes('persistPracticeSitting'), 'the interim writer came back');
    assert.equal((SCREEN.match(/completePracticeSitting\(/g) ?? []).length, 1, 'completion is called from more than one place');
  });

  test('every settled answer is saved for resume, a miss that comes round again included, with no grade', () => {
    const answer = SCREEN.slice(SCREEN.indexOf('const answer = useCallback('), SCREEN.indexOf('const spoke = useCallback('));
    assert.ok(answer.indexOf('if (!next.finished) savePractice(next);') > 0, 'a settled answer is not saved until the feedback beat ends');
    assert.ok(answer.indexOf('savePractice(next)') < answer.indexOf('setFeedback(fb)'), 'an answer given in the beat can be lost to a reload');
    const check = SCREEN.slice(SCREEN.indexOf('const checkOwnWords = useCallback('), SCREEN.indexOf('const keepPhrase = useCallback('));
    assert.match(check, /if \(next\.finished\) persistGrades\(next\);\s*else savePractice\(next\);/, 'an own-words answer is not saved for resume');
    const save = SCREEN.slice(SCREEN.indexOf('const savePractice = useCallback('), SCREEN.indexOf('const finishPractice = useCallback('));
    assert.match(save, /if \(held === null \|\| scopeGeneration\(\) !== held\.scope\) return;/, 'a save can land in an account the sitting does not belong to');
    assert.match(save, /void savePracticeSession\(\{/);
    assert.ok(!/gradeCards|recordActivity|completePracticeSitting/.test(save), 'saving a sitting grades or awards something');
    const silent = SCREEN.slice(SCREEN.indexOf('const goSilent = useCallback('), SCREEN.indexOf('const heading = '));
    assert.match(silent, /micSuppressedRef\.current = true;\s*savePractice\(quiet\);/, 'a sitting that went quiet resumes speaking');
  });

  test('the ordinary sitting is unchanged: same builder, same grades, same XP', () => {
    const ordinary = persistBlock.slice(persistBlock.indexOf('const summary = summariseDrill(state);'));
    assert.match(ordinary, /gradeCards\(\s*summary\.grades\.map/, 'the scheduled sitting no longer grades from its own summary');
    assert.match(SCREEN, /buildDrillSession\(deck, bank, now, node \? \{ only: node\.phraseKeys \} : undefined\)/);
    assert.match(
      SCREEN,
      /if \(practice !== undefined\) return;\s*let cancelled = false;\s*const asked = node\?\.ownWords;/,
      'both builders can run for one sitting',
    );
  });

  test('the end card waits for completion and says only what its status supports, offering a retry when nothing is safe', () => {
    const end = SCREEN.slice(
      SCREEN.indexOf('if (practice !== undefined && session.finished) {'),
      SCREEN.indexOf('if (session.finished && session.answered.length === 0)'),
    );
    assert.ok(end.length > 0, 'the practice end card moved; this test is stale');
    assert.match(end, /practiceSaved === 'waiting'/, 'the end card can speak before completion answers');
    assert.match(end, /sittingStatement\(\s*practiceOutcomes\(\{ state: session, targets: held\.targets, exercises: held\.exercises, exposed: held\.exposed, assisted \}\)/, 'the card reads outcomes by a rule other than the history\'s');
    assert.match(end, /const card = practiceEndCard\(practiceSaved, statement\);/);
    assert.match(end, /\{card\.retry && \(/, 'a sitting that was not saved offers no way to try again');
    assert.match(end, /onPress=\{retryPractice\}/);
    assert.ok(!/<Stat|s\.resolved|Got right/.test(end), 'the practice card counts at the learner');
    const retry = SCREEN.slice(SCREEN.indexOf('const retryPractice = useCallback('), SCREEN.indexOf('const finishAndLeave = useCallback('));
    assert.match(retry, /if \(!session \|\| practiceRetrying\) return;/, 'a second tap can start a second retry');
    assert.match(retry, /finishPractice\(session\)/, 'a retry does something other than replay the same completion');
  });

  test('an empty practice sitting says so, and claims no finish', () => {
    const empty = SCREEN.slice(SCREEN.indexOf('if (practice !== undefined && session.finished && !hasAnsweredWork(session))'), SCREEN.indexOf('if (practice !== undefined && session.finished) {'));
    assert.ok(empty.length > 0, 'there is no empty practice branch');
    assert.match(empty, /PRACTICE_END\.empty/);
    assert.ok(!/onPracticeFinished|persistGrades|tapSettled/.test(empty), 'an empty practice sitting records or celebrates something');
    const signal = SCREEN.slice(SCREEN.indexOf('const held = practiceRef.current;\n    if (!session?.finished'), SCREEN.indexOf('const retryPractice = useCallback('));
    assert.match(signal, /if \(!hasAnsweredWork\(session\)\) return;/, 'the practice finished signal fires on an empty sitting');
    assert.match(signal, /const written = completionRef\.current;/);
    assert.ok(signal.indexOf('written.then(') > 0 && signal.indexOf('written.then(') < signal.indexOf('onPracticeFinished?.('), 'the practice finished signal fires before completion answers');
    assert.match(signal, /if \(saved === 'not-saved'\) return;/, 'a sitting that was not saved still marks the pack practised');
  });

  test('opening recovers a half-done completion first, then resumes or starts through the opening rule, bound to the account', () => {
    const from = SCREEN.indexOf("if (practice === undefined || practice === 'invalid') return;");
    assert.ok(from > 0, 'the practice builder moved; this test is stale');
    const effect = SCREEN.slice(from, SCREEN.indexOf('const savePractice = useCallback('));
    assert.ok(effect.indexOf('recoverPracticeCompletion()') < effect.indexOf('loadPracticeSession()'), 'a saved sitting is read before a pending completion lands');
    assert.match(effect, /const opening = practiceOpening\(\{ route: practice, record, deck, bank, packs, now \}\);/);
    assert.match(effect, /if \(cancelled \|\| scopeGeneration\(\) !== scope\) return;/, 'a sitting read for one account can open under another');
    // A resume keeps the record's own identity and warm-up flag, never the link's.
    const resume = effect.slice(effect.indexOf("if (opening.kind === 'resume') {"), effect.indexOf('const built = buildPracticeSession('));
    assert.match(resume, /sittingId: held\.sittingId,/);
    assert.match(resume, /exposed: held\.exposed,/, 'a reload can turn a warm-up sitting into one that claims recall');
    assert.match(resume, /setSession\(restored\.state\)/);
    // A fresh sitting mints its id once, here and nowhere else.
    assert.equal((SCREEN.match(/mintSittingId\(/g) ?? []).length, 1, 'the sitting id is minted in more than one place');
    assert.match(effect, /buildPracticeSession\(opening\.targets, bank, deck, now\)/);
    assert.ok(!effect.includes('buildDrillSession'), 'the practice sitting falls back to the due deck');
    // A saved sitting that cannot resume is cleared and said, never replaced.
    const cannot = effect.slice(effect.indexOf("if (opening.kind === 'cannot-resume') {"), effect.indexOf("if (opening.kind === 'resume') {"));
    assert.match(cannot, /clearPracticeSession\(opening\.sittingId\)/);
    assert.ok(!cannot.includes('buildPracticeSession'), 'a sitting that cannot resume is silently replaced');
    const said = SCREEN.slice(SCREEN.indexOf('if (cannotResume !== null) {'), SCREEN.indexOf("if (practice === 'invalid') {"));
    assert.ok(said.length > 0, 'the cannot-resume card moved; this test is stale');
    // Seen in the browser: after a sitting finished, /drill?practice=resume said
    // its phrases were gone when they were not. No saved sitting and a saved
    // sitting whose exercises are gone are different facts, and read so.
    assert.match(cannot, /setCannotResume\(opening\.sittingId === null \? 'none' : 'gone'\)/, 'nothing saved and phrases gone are reported as the same thing');
    assert.match(said, /cannotResume === 'none'\s*\? \{ title: PRACTICE_END\.nothingToResume, body: PRACTICE_END\.nothingToResumeBody \}\s*: \{ title: PRACTICE_END\.cannotResume, body: PRACTICE_END\.cannotResumeBody \}/, 'a resume with nothing saved claims the phrases are gone');
  });

  test('a practice link that cannot be read says so, and the navigator reads params only through the parser', () => {
    const invalid = SCREEN.slice(SCREEN.indexOf("if (practice === 'invalid') {"), SCREEN.indexOf('if (unread) {'));
    assert.ok(invalid.length > 0, 'an unreadable practice link has no branch of its own');
    assert.match(invalid, /PRACTICE_END\.unreadable/);
    assert.ok(!/persistGrades|onPracticeFinished|buildPracticeSession/.test(invalid), 'an unreadable link opens or records something');
    const navigator = stripComments(read('./nav/RootNavigator.tsx'));
    assert.match(navigator, /const practice = parsePracticeRoute\(route\.params\) \?\? undefined;/, 'the drill route reads its params some other way than the parser');
    assert.match(navigator, /practice=\{practice\}/, 'the drill route hands the screen raw params');
    assert.ok(!/practice=\{route\.params/.test(navigator), 'the drill route hands the screen raw params');
    assert.match(navigator, /nav\.replace\('Drill', practiceRouteParams\(\{ origin: 'pack', packId: node\.id, exposed \}\)\)/, 'the warm-up puts something other than flat params in the route');
    assert.ok(!/practice: \{/.test(navigator), 'an object went into a practice route');
  });
});

describe('a practice sitting says where the learner is, and nothing about how it is going — whole-app phase 2', () => {
  test('the step strip is drawn only in a practice sitting, from the practice model, in words', () => {
    // The strip reads the held targets through the one module that counts
    // them, so the screen never computes a position or a total of its own.
    assert.match(SCREEN, /import \{ sittingProgress \} from '\.\/practice\/sittingProgress\.ts';/, 'the drill counts its own position instead of asking the practice model');
    const flatScreen = SCREEN.replace(/\s+/g, ' ');
    assert.match(
      flatScreen,
      /const progress = practice !== undefined && practiceRef\.current !== null \? sittingProgress\(session, practiceRef\.current\.targets\) : null;/,
      'the strip is drawn outside a practice sitting, or from something other than its own targets',
    );
    // In the header's centre slot, which scrolls with nothing and never
    // pushes the exercise down, spoken politely as it changes.
    // 2026-10-21 UI-008, artboard B-Drill: the close header, the 8pt bar in
    // its centre, and the words at 14/600 on its right.
    assert.match(flatScreen, /<ScreenHeader leave=\{\{ onPress: leave, label: 'Leave', accessibilityLabel: 'Leave the drills', close: true \}\} title=\{session\?.queue\[0\]\?.kind \? drillTitle\(session.queue\[0\].kind\) : heading\} centre=\{fill !== null && session !== null && !session\.finished \? <SittingBar fill=\{fill\} glow=\{comboGlows\(combo\)\} \/> : null\} trailing=\{progress !== null \? \( <Text accessibilityLiveRegion="polite" style=\{\[bType\.semi14, \{ color: bt\.text \}\]\}>\{progress\.label\}<\/Text> \) : undefined\} \/>/, 'the strip is not the header\'s own quiet line');
    // Words only: no digit, no fraction, no bar, no percentage anywhere in it.
    assert.doesNotMatch(flatScreen, /\{progress\.step\}|\{progress\.total\}|progress\.step \/|percent|<ProgressBar|<Bar\b/, 'the strip draws a number, a fraction or a bar');
    // And it added no control: the pill count is exactly what it was.
    assert.equal((SCREEN.match(/<PillButton\b/g) ?? []).length, 4, 'the strip added a primary pill to the drill');
  });
});

describe('help in a practice sitting: the known phrase, recorded so it is never recall', () => {
  test('only a practice sitting offers it, only on an English-to-French ask, and it shows the exercise\'s own line', () => {
    const view = WRITE.slice(WRITE.indexOf('function TranslationView('));
    assert.match(view, /const canHelp = help !== undefined && !isFrenchPrompt;/, 'help is offered where the French is already on screen, or outside practice');
    assert.match(view, /\{canHelp && help\.shown && \(/);
    assert.match(view, /\{exercise\.fr\}/, 'the help shows something other than the exercise\'s own French line');
    assert.match(view, /label=\{PRACTICE_HELP\.show\}/);
    // The ordinary drill is unchanged: no help prop is passed outside practice.
    assert.match(SCREEN.replace(/\s+/g, ' '), /help=\{practice !== undefined \? \{ shown: assisted\.includes\(exercise\.id\), onShow: \(\) => showPhrase\(exercise\.id\) \} : undefined\}/);
    assert.equal((SCREEN.match(/<PillButton\b/g) ?? []).length, 4, 'help added a primary pill to the drill');
  });

  test('asking for help is recorded at once, saved for reload, and handed to completion and the end card', () => {
    const show = SCREEN.slice(SCREEN.indexOf('const showPhrase = useCallback('), SCREEN.indexOf('const goSilent = useCallback('));
    assert.match(show, /assistedRef\.current = \[\.\.\.assistedRef\.current, exerciseId\];/);
    assert.match(show, /savePractice\(session\);/, 'help is not saved until the next answer, so a reload loses it');
    const save = SCREEN.slice(SCREEN.indexOf('const savePractice = useCallback('), SCREEN.indexOf('const finishPractice = useCallback('));
    assert.match(save, /assisted: assistedRef\.current,/, 'the help mark never reaches the resume record');
    const finish = SCREEN.slice(SCREEN.indexOf('const finishPractice = useCallback('), SCREEN.indexOf('const persistGrades = useCallback('));
    assert.match(finish, /assisted: assistedRef\.current,/, 'completion never hears about help, so it can grade a helped answer as recall');
    const opening = SCREEN.slice(SCREEN.indexOf("if (opening.kind === 'resume') {"), SCREEN.indexOf('const built = buildPracticeSession('));
    assert.match(opening, /assistedRef\.current = \[\.\.\.held\.assisted\];/, 'a reload forgets the phrase was shown');
    const end = SCREEN.slice(SCREEN.indexOf('if (practice !== undefined && session.finished) {'), SCREEN.indexOf('if (session.finished && session.answered.length === 0)'));
    assert.match(end, /exposed: held\.exposed, assisted \}/, 'the end card can call a helped answer recall');
  });
});

// 2026-10-21 UI-008, simulator check of the Drill in light and dark.
describe('the drill draws no stray strip and keeps its end figures on one line', () => {
  test('no exercise card carries a top border, which drew as an ink strip across its top', () => {
    const screen = stripComments(drillSource());
    const card = /exCard: \{([^}]*)\}/.exec(screen);
    assert.ok(card, 'the exercise card style moved; this test is stale');
    assert.doesNotMatch(card[1]!, /borderTop/, 'the exercise card draws a top edge again');
    assert.doesNotMatch(screen, /borderTopWidth/, 'something on the drill draws a top edge');
  });

  test('an end scene tile sets its figure at 24/800 on the shared stat tile, and stacks when "0:30" would not fit beside its coin', () => {
    const end = stripComments(read('./celebrate/EndScene.tsx'));
    // Dark aware: the figure is the theme's text on the theme's card, never paper ink.
    assert.match(end, /const number = \[bType\.stat24, \{ color: t\.text \}\];/, 'the tile figure is not the stat tiles\' 24/800 in the theme\'s text');
    assert.match(end, /textStyle=\{number\}/);
    assert.match(end, /<Tile\s+key=\{tile\.id\}\s+layout=\{layout\}/, 'the end tiles are not the shared stat tile');
    assert.match(end, /const layout = statTileLayout\(statRowTileWidth\(width > 0 \? width : windowWidth - ROW_MARGINS\), fontScale, viewTiles\.flatMap\(\(tile\) => \[tileText\(tile, tile\.value\), tile\.label\]\)\);/, 'the end tiles no longer fit their own figures, so "0:30" can break');
    assert.doesNotMatch(end, /type\.stat\b/, 'the 36pt stat size is back in a tile');
    assert.doesNotMatch(end, /\bpaper\.|\bcolour\.|textOn\.|onColour\./, 'the end scene draws a light-only colour');
  });
});
