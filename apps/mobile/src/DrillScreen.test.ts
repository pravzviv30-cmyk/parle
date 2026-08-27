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
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  answerCurrent,
  evidenceOf,
  summariseDrill,
  type DrillExercise,
  type DrillSessionState,
  type ReviewCard,
} from '@parle/core';

import { gradeCards, loadDeck } from './review/store.ts';
import { setActiveUser } from './storage/scope.ts';

const NOW = new Date(2026, 7, 20, 14).getTime();
const PHRASE = 'phrase:ça marche';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

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
  await AsyncStorage.setItem(`parle.u.${uid}.review`, JSON.stringify([card()]));
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
