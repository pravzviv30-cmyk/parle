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
    const screen = stripComments(read('./DrillScreen.tsx')).replace(/\s+/g, ' ');
    assert.match(
      screen,
      /color: used \? paper\.inkSoft : paper\.ink/,
      'a placed word drops to the mark-only faint ink on the porcelain ground',
    );
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
    const screen = stripComments(read('./DrillScreen.tsx'));
    const map = screen.slice(screen.indexOf('gradeWritesRef.current = gradeCards('), screen.indexOf('recordActivity('));

    assert.ok(map.length > 0, 'persistGrades moved; this test is reading the wrong thing');
    assert.match(map, /\{\s*phraseKey,\s*grade,\s*transfer\s*\}/, 'the screen destructures the transfer mark away again');
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
  const screen = stripComments(read('./DrillScreen.tsx'));

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

  test('the empty drill bank draws the nothing due scene', () => {
    // Revamp A retired the vector scene for the registered drawing. The claim
    // is unchanged and so is every assertion below it: the empty bank is a
    // cleared table, above the card, with the same two sentences.
    assert.ok(
      /import \{ Art \} from '\.\/art\/Art\.tsx'/.test(screen),
      'the drill screen does not import the one art renderer',
    );
    assert.ok(
      /<Art name=\{SCREEN_ART\.emptyDeck\}[^/>]*\/>/.test(emptyBranch),
      'the empty drill bank still renders a bare card',
    );
    assert.ok(
      emptyBranch.indexOf('<Art ') < emptyBranch.indexOf('<Card>'),
      'the scene sits above the card on the review deck and has to sit above it here',
    );
    // A width written at the call site is the drift the registry exists to
    // stop, and it is exactly what the retired scene took.
    assert.ok(!/<Art[^/>]*width=/.test(emptyBranch), 'the empty bank sizes the scene itself instead of reading the registry');
    // The item is the missing drawing, not a rewrite. The copy stays put.
    assert.ok(emptyBranch.includes('Nothing to review.'), 'the copy changed; F158 is about the drawing');
    assert.ok(emptyBranch.includes('Your next session adds more.'), 'the copy changed; F158 is about the drawing');
  });

  test('both surfaces the scene claims actually draw it', () => {
    // Read from the promise rather than from a list written here, so a scene
    // that stops naming its second home stops being held to it. The promise
    // moved with the drawing: it is `SCREEN_ART.emptyDeck`'s own comment now.
    const promise = read('./art/maps.ts');
    assert.ok(
      /Review and Drill, when there is nothing due/.test(promise),
      'the scene no longer claims both surfaces; this test is stale',
    );
    const drawn = /<Art name=\{SCREEN_ART\.emptyDeck\}/;
    assert.ok(drawn.test(stripComments(read('./ReviewScreen.tsx'))), 'the review deck stopped drawing it');
    assert.ok(drawn.test(screen), 'the drill bank stopped drawing it');
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

const SCREEN = stripComments(read('./DrillScreen.tsx'));

/** The own-words Check handler alone. Sliced, so a match elsewhere cannot pass. */
const checkBlock = (() => {
  const from = SCREEN.indexOf('const checkOwnWords = useCallback(');
  assert.ok(from > 0, 'the own-words Check handler moved; this test is reading the wrong thing');
  const to = SCREEN.indexOf('const keepPhrase = useCallback(', from);
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
  test("own-words asks for the learner's own French and never a recording", () => {
    // 1. The exercise has no answer key, so there is nothing to reproduce.
    assert.deepEqual([...OWN_WORDS.accepted], [], 'the own-words exercise carries a right string, which makes it a recall drill');
    assert.ok(OWN_WORDS.situation.length > 0 && OWN_WORDS.en.length > 0, 'the learner is given neither a situation nor a meaning to carry');
    assert.ok(OWN_WORDS.mustKeep.length > 0, 'nothing says what the learner’s own words have to get across');

    // 2. The card takes typing, and it says out loud first. The hint is the
    //    honest bit: the phone can read text and cannot hear, and pretending
    //    otherwise would be a claim about pronunciation nobody has earned.
    const view = SCREEN.slice(SCREEN.indexOf('function OwnWordsView('), SCREEN.indexOf('export function DrillScreen('));
    assert.ok(view.length > 0, 'the own-words view moved; this test is reading the wrong thing');
    assert.match(view, /placeholder=\{OWN_WORDS_PROMPT\}/, 'the own-words field does not ask for the learner’s own French');
    assert.match(view, /\{OWN_WORDS_HINT\}/, 'the card never tells the learner to say it out loud first');
    assert.equal(OWN_WORDS_HINT, 'Say it out loud first if you can, then type what you said.');
    assert.equal(OWN_WORDS_PROMPT, 'Say it your way, in French');

    // 3. Nothing listens. The microphone belongs to repeat-this, which has a
    //    known reference to score against; this kind has none, so a recording
    //    here could only ever be scored against a sentence nobody wrote down.
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
    assert.match(checkBlock, /if \(!session \|\| session\.finished \|\| judging\) return;/, 'a second Check can start while the first is still out');
    assert.ok(
      checkBlock.indexOf('setJudging(true)') < checkBlock.indexOf('judgeOwnWords('),
      'the door is closed after the call is made, which is not closed at all',
    );
    assert.match(checkBlock, /const attempt = typed\.trim\(\);\s*if \(attempt === ''\) return;/, 'an empty field can spend a judge call');
    // The attempt is spent on the request and nothing else: no store, no log.
    assert.ok(!checkBlock.includes('AsyncStorage') && !checkBlock.includes('addPhrases('), 'the attempt is written somewhere');
  });
});
