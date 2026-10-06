/**
 * A practice sitting settles where its durable plan completes (F744, review
 * finding 9), whoever ran the plan: the screen's finish, its retry after a
 * `kept` answer, or the recovery the app runs at launch.
 *
 * Three things to hold. A retry is measured against the learner's state before
 * the sitting's first write, not after half of it landed, so its XP and its
 * streak day are reported. It settles at the instant the plan froze, so a
 * retry after midnight never makes a second practice day. And a plan a crash
 * left pending is settled when the recovery completes it, so a zero-XP sitting
 * still counts for the day's goal and quests.
 *
 * The storage double is `practice/completion.test.ts`'s, with a key that can
 * refuse writes the way a full phone does.
 */

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  answerCurrent,
  buildPracticeSession,
  localDayKey,
  newCard,
  phraseKeyOf,
  type DrillExercise,
  type DrillSessionState,
  type PracticeTarget,
  type ReviewCard,
} from '@luvani/core';

import { completePracticeSitting, recoverPracticeCompletion } from '../practice/completion.ts';
import { loadActiveDays, loadActivity } from '../progress/activity.ts';
import { setActiveUser } from '../storage/scope.ts';
import { resetSyncRegistry } from '../sync/registry.ts';
import type { GameDelta } from './delta.ts';
import { configureGameEnvironment, onSettleChain, onSettled } from './settle.ts';
import { loadGame } from './store.ts';
import { NO_OUTSIDE_FACTS } from './view.ts';

interface Disk {
  map: Map<string, string>;
  /** Key suffixes whose setItem rejects, as a full phone does. */
  full: Set<string>;
}

function installDisk(): Disk {
  const disk: Disk = { map: new Map(), full: new Set() };
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = async (key: string): Promise<string | null> => disk.map.get(key) ?? null;
  shared.setItem = async (key: string, value: string): Promise<void> => {
    if ([...disk.full].some((suffix) => key.endsWith(`.${suffix}`))) throw new Error('QuotaExceededError');
    disk.map.set(key, value);
  };
  shared.removeItem = async (key: string): Promise<void> => {
    disk.map.delete(key);
  };
  shared.multiRemove = async (keys: string[]): Promise<void> => {
    for (const key of keys) disk.map.delete(key);
  };
  return disk;
}

const MINUTE = 60_000;
const PACK = 'pack-cafe';
const PHRASES = ['Un café, s’il vous plaît', 'Bonjour', 'Merci beaucoup'];

const BANK: DrillExercise[] = PHRASES.map(
  (fr, index) =>
    ({
      id: `pack:${PACK}:en-fr:${index}`,
      kind: 'translate',
      direction: 'en-fr',
      phraseKey: phraseKeyOf(fr),
      difficulty: 'production',
      fr,
      en: `english ${index}`,
      accepted: [fr],
    }) as DrillExercise,
);

function targets(): PracticeTarget[] {
  return PHRASES.map((fr, i) => ({ phraseKey: phraseKeyOf(fr), source: { kind: 'pack', packId: PACK }, exerciseId: BANK[i]!.id, scheduled: true }));
}

function dueDeck(now: number): ReviewCard[] {
  return PHRASES.map((fr) => ({ ...newCard({ id: phraseKeyOf(fr), kind: 'vocab', front: fr, back: 'x', context: '', ipa: '' }, now - 86_400_000), due: now - 1000 }));
}

/** A sitting played to its end: every answer right, or every answer wrong (which earns no XP). */
function played(deck: ReviewCard[], now: number, right: boolean): { state: DrillSessionState; targets: PracticeTarget[] } {
  const built = buildPracticeSession(targets(), BANK, deck, now);
  let state = built.state;
  for (let guard = 0; guard < 40 && !state.finished; guard += 1) {
    const head = state.queue[0]!;
    state = answerCurrent(state, right ? (head as { fr: string }).fr : 'zzz').state;
  }
  assert.ok(state.finished, 'the fixture sitting did not finish');
  return { state, targets: built.targets };
}

let uids = 0;
let uid = '';
let disk: Disk;
let clock = 0;
let restore: () => void = () => {};
let deltas: GameDelta[] = [];
let stopListening: () => void = () => {};
const key = (suffix: string) => `luvani.u.${uid}.${suffix}`;

function finish(sittingId: string, now: number, right: boolean, activeMs = 6 * MINUTE) {
  const deck = JSON.parse(disk.map.get(key('review')) ?? '[]') as ReviewCard[];
  const sitting = played(deck, now, right);
  return completePracticeSitting({ sittingId, state: sitting.state, targets: sitting.targets, exercises: BANK, exposed: false, durationMs: activeMs, activeMs, now });
}

/** Every settle already asked for has run. */
const settled = (): Promise<void> => onSettleChain(async () => {});

beforeEach(() => {
  disk = installDisk();
  resetSyncRegistry();
  uid = `77777777-7777-4777-8777-${String(++uids).padStart(12, '0')}`;
  setActiveUser(uid);
  clock = new Date(2026, 9, 5, 12, 0, 0).getTime();
  restore = configureGameEnvironment({
    now: () => clock,
    billing: () => Promise.resolve(null),
    canRecord: () => Promise.resolve(true),
    outside: () => Promise.resolve({ ...NO_OUTSIDE_FACTS, goalTarget: 5 }),
  });
  deltas = [];
  stopListening = onSettled((delta) => deltas.push(delta));
});

afterEach(() => {
  stopListening();
  restore();
});

describe('a practice sitting settles where its plan completes — F744', () => {
  test('a practice plan retried after a kept answer settles once, measured from before its first write', async () => {
    const at = clock;
    disk.map.set(key('review'), JSON.stringify(dueDeck(at)));

    // The XP lands, the history write does not: the plan is kept, and nothing settles yet.
    disk.full.add('practiceHistory');
    const first = await finish('s-retry', at, true);
    assert.equal(first.status, 'kept');
    assert.ok(first.xp > 0);
    await settled();
    assert.equal(deltas.length, 0, 'a kept plan settled before it completed');
    const entries = (await loadActivity({ strict: true })).filter((e) => e.kind === 'drill');
    assert.equal(entries.length, 1, 'the fixture did not land the XP before the history failed');

    // The retry completes it: one settle, against the state before the sitting.
    disk.full.clear();
    clock += 2 * MINUTE;
    const second = await finish('s-retry', clock, true);
    assert.equal(second.status, 'completed');
    await settled();
    assert.equal(deltas.length, 1, 'the completed plan did not settle, or settled twice');
    const delta = deltas[0]!;
    assert.equal(delta.source, 'drill');
    assert.equal(delta.at, entries[0]!.at, 'the settle named an instant the plan did not freeze');
    assert.equal(delta.xp.earned, first.xp);
    assert.equal(delta.xp.counted, first.xp, 'the retry was measured after its own XP had landed, so it reported none');
    assert.equal(delta.xp.capped, false);
    assert.equal(delta.streak.extendedNow, true, 'the retry was measured after its own day had landed, so the day was lost');
    assert.ok((await loadGame()).claims.some((claim) => claim.questId === 'finish-practice'));

    // A replay of a completed sitting settles nothing.
    const third = await finish('s-retry', clock, true);
    assert.equal(third.status, 'already-completed');
    await settled();
    assert.equal(deltas.length, 1, 'already-completed settled again');
  });

  test('a zero-XP practice plan retried after midnight records one practice day, at the instant it froze', async () => {
    const frozenAt = new Date(2026, 9, 4, 23, 59, 50).getTime();
    disk.map.set(key('review'), JSON.stringify(dueDeck(frozenAt)));
    clock = frozenAt;

    disk.full.add('practiceHistory');
    const first = await finish('s-midnight', frozenAt, false);
    assert.equal(first.status, 'kept');
    assert.equal(first.xp, 0, 'the fixture sitting earned XP, so this checks nothing about a zero-XP day');
    assert.deepEqual(await loadActiveDays(), [localDayKey(frozenAt)]);

    // Retried five minutes into the next day.
    disk.full.clear();
    clock = new Date(2026, 9, 5, 0, 5, 0).getTime();
    assert.equal((await finish('s-midnight', clock, false)).status, 'completed');
    await settled();
    assert.equal(deltas.length, 1);
    assert.equal(deltas[0]!.at, frozenAt);
    assert.deepEqual(await loadActiveDays(), [localDayKey(frozenAt)], 'a retry after midnight made a second practice day');
    assert.deepEqual((await loadGame()).sittings, [{ at: frozenAt, source: 'drill', activeMs: 6 * MINUTE }]);
  });

  test('a plan a crash left pending is settled when the recovery completes it', async () => {
    const at = clock;
    disk.map.set(key('review'), JSON.stringify(dueDeck(at)));

    // Nothing right, six minutes of work; the history write fails and the app is killed.
    disk.full.add('practiceHistory');
    assert.equal((await finish('s-crash', at, false)).status, 'kept');
    await settled();
    setActiveUser(null);
    setActiveUser(uid);
    disk.full.clear();
    assert.equal(deltas.length, 0);

    // The next launch: Practice, the next-task card or the drill screen recovers it.
    const recovered = await recoverPracticeCompletion();
    assert.equal(recovered?.status, 'completed');
    await settled();
    assert.equal(deltas.length, 1, 'a plan finished on recovery was never settled');
    const game = await loadGame();
    assert.deepEqual(game.sittings, [{ at, source: 'drill', activeMs: 6 * MINUTE }], 'the zero-XP sitting has no row, so it counts for no quest or goal');
    assert.deepEqual(game.goalDays, [localDayKey(at)], 'its minutes did not count toward the goal');
    assert.ok(game.claims.some((claim) => claim.questId === 'finish-practice'), 'it did not count for the day\'s quests');

    // Nothing is left to recover, and nothing settles twice.
    assert.equal(await recoverPracticeCompletion(), null);
    await settled();
    assert.equal(deltas.length, 1);
  });
});
