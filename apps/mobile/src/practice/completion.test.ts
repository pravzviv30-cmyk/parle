/**
 * Finishing a practice sitting, run against a storage double that can refuse,
 * crash, and change account underneath it.
 *
 * Everything here goes through the real stores (review, activity, practice
 * history, practice session) sharing one AsyncStorage module object, the same
 * arrangement `storage/ack.test.ts` and `storeBinding.test.ts` use.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  answerCurrent,
  buildPracticeSession,
  newCard,
  phraseKeyOf,
  type DrillExercise,
  type DrillSessionState,
  type PracticeTarget,
  type ReviewCard,
} from '@luvani/core';

import { clearActiveUserData, setActiveUser } from '../storage/scope.ts';
import { adopterFor, dirtyStamp, resetSyncRegistry } from '../sync/registry.ts';
import { loadActivity } from '../progress/activity.ts';
import { gradeCards, loadDeck } from '../review/store.ts';
import { completePracticeSitting, practiceCardGrades, recoverPracticeCompletion } from './completion.ts';
import { mergePracticeHistory } from './history.ts';
import { loadPracticeHistory, recordPracticeEvent, recordRevisitStarted } from './historyStore.ts';
import {
  clearPracticeSession,
  loadPracticeSession,
  restorePracticeSession,
  savePracticeSession,
} from './sessionStore.ts';

// ─────────────────────────────────────────────────────────── the storage double

interface Disk {
  map: Map<string, string>;
  /** Keys whose setItem rejects, as a full phone does. */
  full: Set<string>;
  /** Called before a getItem resolves, so a test can act in the await. */
  beforeGet: ((key: string) => void) | null;
  /** Called before a setItem lands, so a test can act in the await. */
  beforeSet: ((key: string) => void) | null;
  sets: string[];
}

function installDisk(): Disk {
  const disk: Disk = { map: new Map(), full: new Set(), beforeGet: null, beforeSet: null, sets: [] };
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = async (key: string): Promise<string | null> => {
    disk.beforeGet?.(key);
    return disk.map.get(key) ?? null;
  };
  shared.setItem = async (key: string, value: string): Promise<void> => {
    disk.beforeSet?.(key);
    if ([...disk.full].some((suffix) => key.endsWith(`.${suffix}`))) throw new Error('QuotaExceededError');
    disk.sets.push(key);
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

// ─────────────────────────────────────────────────────────────── fixtures

const NOW = Date.UTC(2026, 8, 23, 12);
const PACK = 'pack-cafe';
const PHRASES = ['Un café, s’il vous plaît', 'Bonjour', 'Merci beaucoup'];

function translate(fr: string, index: number): DrillExercise {
  return {
    id: `pack:${PACK}:en-fr:${index}`,
    kind: 'translate',
    direction: 'en-fr',
    phraseKey: phraseKeyOf(fr),
    difficulty: 'production',
    fr,
    en: `english ${index}`,
    accepted: [fr],
  } as DrillExercise;
}

const BANK = PHRASES.map(translate);

function card(fr: string, due: number): ReviewCard {
  return { ...newCard({ id: phraseKeyOf(fr), kind: 'vocab', front: fr, back: 'x', context: '', ipa: '' }, NOW - 86_400_000), due };
}

function targets(scheduled = true): PracticeTarget[] {
  return PHRASES.map((fr, i) => ({ phraseKey: phraseKeyOf(fr), source: { kind: 'pack', packId: PACK }, exerciseId: BANK[i]!.id, scheduled }));
}

/** A sitting played to the end: each answered right first time, except the last one missed twice. */
function playedSitting(deck: ReviewCard[]): { state: DrillSessionState; targets: PracticeTarget[] } {
  const built = buildPracticeSession(targets(), BANK, deck, NOW);
  let state = built.state;
  for (let guard = 0; guard < 20 && !state.finished; guard += 1) {
    const head = state.queue[0]!;
    const right = head.phraseKey !== phraseKeyOf(PHRASES[2]!);
    state = answerCurrent(state, right ? (head as { fr: string }).fr : 'zzz').state;
  }
  assert.ok(state.finished, 'the fixture sitting did not finish');
  return { state, targets: built.targets };
}

let uids = 0;
let uid = '';
const key = (suffix: string, who = uid) => `luvani.u.${who}.${suffix}`;

function seedDeck(disk: Disk, deck: ReviewCard[]): void {
  disk.map.set(key('review'), JSON.stringify(deck));
}

function dueDeck(): ReviewCard[] {
  return PHRASES.map((fr) => card(fr, NOW - 1000));
}

async function finish(disk: Disk, extra: Partial<Parameters<typeof completePracticeSitting>[0]> = {}) {
  const deck = JSON.parse(disk.map.get(key('review')) ?? '[]') as ReviewCard[];
  const played = playedSitting(deck);
  return completePracticeSitting({
    sittingId: 's-one',
    state: played.state,
    targets: played.targets,
    exercises: BANK,
    exposed: false,
    durationMs: 60_000,
    now: NOW,
    ...extra,
  });
}

function drillEntries() {
  return loadActivity().then((entries) => entries.filter((e) => e.kind === 'drill'));
}

let disk: Disk;

beforeEach(() => {
  resetSyncRegistry();
  disk = installDisk();
  uid = `55555555-5555-4555-8555-${String(++uids).padStart(12, '0')}`;
  setActiveUser(uid);
  // Adopters re-register on scope change; the registry was just reset.
});

// ─────────────────────────────────────────────────────────────────── tests

describe('practice completion — at most once', () => {
  test('a finished sitting grades, logs XP and writes history once, then says completed', async () => {
    seedDeck(disk, dueDeck());
    const first = await finish(disk);
    assert.equal(first.status, 'completed');
    assert.deepEqual(first.pending, []);
    assert.equal(first.grades.applied.length, 3);
    assert.ok(first.xp > 0);

    const history = await loadPracticeHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0]!.kind, 'session-completed');
    assert.equal(history[0]!.packId, PACK);
    const drills = await drillEntries();
    assert.equal(drills.length, 1);
    assert.equal(drills[0]!.xp, first.xp);
    assert.equal(drills[0]!.durationMs, 60_000);
    assert.equal(await loadPracticeSession(), null, 'the resume record outlived its completion');
    assert.notEqual(dirtyStamp('practiceHistory'), null);
    assert.notEqual(dirtyStamp('review'), null);
    assert.notEqual(dirtyStamp('activity'), null);
  });

  test('completing the same sitting again, even with different input, changes nothing', async () => {
    seedDeck(disk, dueDeck());
    await finish(disk);
    const deckAfter = disk.map.get(key('review'));
    const activityAfter = disk.map.get(key('activity'));
    const historyAfter = disk.map.get(key('practiceHistory'));

    const again = await finish(disk, { now: NOW + 5000, exposed: true });
    assert.equal(again.status, 'already-completed');
    assert.equal(disk.map.get(key('review')), deckAfter, 'a replay graded again');
    assert.equal(disk.map.get(key('activity')), activityAfter, 'a replay logged XP again');
    assert.equal(disk.map.get(key('practiceHistory')), historyAfter, 'a replay wrote history again');
  });

  test('two completions racing for one sitting apply one plan', async () => {
    seedDeck(disk, dueDeck());
    const [a, b] = await Promise.all([finish(disk), finish(disk, { now: NOW + 9 })]);
    assert.deepEqual([a.status, b.status].sort(), ['already-completed', 'completed']);
    assert.equal((await drillEntries()).length, 1);
    assert.equal((await loadPracticeHistory()).length, 1);
    const cardsReps = (JSON.parse(disk.map.get(key('review'))!) as ReviewCard[]).map((c) => c.reps + c.lapses);
    assert.deepEqual(cardsReps, [1, 1, 1], 'a card was graded twice');
  });

  test('a second call racing the first replays the plan the first froze, never its own', async () => {
    seedDeck(disk, dueDeck());
    // The first call freezes and then its activity write is refused, so its plan stays pending.
    disk.full.add('activity');
    const first = await finish(disk);
    assert.equal(first.status, 'kept');
    disk.full.clear();
    // A second call for the same sitting at a later instant and with different context.
    const second = await finish(disk, { now: NOW + 60_000, exposed: true });
    assert.equal(second.status, 'completed');
    assert.equal(second.xp, first.xp);
    const [event] = await loadPracticeHistory();
    assert.equal(event!.at, NOW, 'the replay used its own instant, not the frozen plan');
    assert.deepEqual(second.outcomes, first.outcomes, 'the replay recomputed outcomes');
  });

  test('two sittings finished in the same millisecond with the same XP log two entries, not one', async () => {
    seedDeck(disk, dueDeck());
    const first = await finish(disk);
    // A second, separate sitting over fresh cards, same instant, same answers.
    seedDeck(disk, dueDeck());
    const second = await finish(disk, { sittingId: 's-two' });
    assert.equal(second.status, 'completed');
    assert.equal(second.xp, first.xp);
    const drills = await drillEntries();
    assert.equal(drills.length, 2, 'the second sitting collided with the first in the (at, kind, xp) log');
    assert.equal((await loadPracticeHistory()).length, 2);
  });

  test('an unfinished sitting completes nothing: leaving saves no grade, no XP, no history', async () => {
    seedDeck(disk, dueDeck());
    const built = buildPracticeSession(targets(), BANK, dueDeck(), NOW);
    const oneAnswered = answerCurrent(built.state, (built.state.queue[0] as { fr: string }).fr).state;
    const result = await completePracticeSitting({
      sittingId: 's-left', state: oneAnswered, targets: built.targets, exercises: BANK, exposed: false, now: NOW,
    });
    assert.equal(result.status, 'failed');
    assert.equal(disk.map.has(key('activity')), false);
    assert.equal(disk.map.has(key('practiceHistory')), false);
    assert.deepEqual(JSON.parse(disk.map.get(key('review'))!), dueDeck());
  });

  test('a finished sitting with nothing answered saves nothing and says so', async () => {
    seedDeck(disk, dueDeck());
    const empty = buildPracticeSession([], BANK, dueDeck(), NOW);
    const result = await completePracticeSitting({
      sittingId: 's-empty', state: empty.state, targets: [], exercises: BANK, exposed: false, now: NOW,
    });
    assert.equal(result.status, 'nothing-to-save');
    assert.equal(disk.sets.length, 0);
  });
});

describe('practice completion — every write can fail, and nothing lies about it', () => {
  for (const suffix of ['review', 'activity', 'practiceHistory'] as const) {
    test(`a refused ${suffix} write keeps the plan, raises no flag for it, and the retry finishes once`, async () => {
      seedDeck(disk, dueDeck());
      disk.full.add(suffix);
      const first = await finish(disk);
      assert.equal(first.status, 'kept');
      const step = suffix === 'review' ? 'grades' : suffix === 'activity' ? 'activity' : 'history';
      assert.ok(first.pending.includes(step), `${step} was not reported pending`);
      assert.equal(dirtyStamp(suffix), null, 'a refused write raised the sync flag');
      assert.equal(await loadPracticeSession(), null, 'a resume was offered over a pending completion');

      disk.full.clear();
      const recovered = await recoverPracticeCompletion();
      assert.equal(recovered?.status, 'completed');
      assert.equal((await drillEntries()).length, 1, 'XP was logged twice across the retry');
      assert.equal((await loadPracticeHistory()).length, 1);
      const reps = (JSON.parse(disk.map.get(key('review'))!) as ReviewCard[]).map((c) => c.reps + c.lapses);
      assert.deepEqual(reps, [1, 1, 1], 'a card was graded twice across the retry');
      assert.equal(await recoverPracticeCompletion(), null, 'the plan outlived a full settle');
    });
  }

  test('a refused plan write applies nothing at all', async () => {
    seedDeck(disk, dueDeck());
    disk.full.add('practiceSession');
    const result = await finish(disk);
    assert.equal(result.status, 'failed');
    assert.deepEqual(JSON.parse(disk.map.get(key('review'))!), dueDeck());
    assert.equal(disk.map.has(key('activity')), false);
    assert.equal(disk.map.has(key('practiceHistory')), false);
  });

  test('a refused cleanup leaves the plan, and the replay applies nothing twice', async () => {
    seedDeck(disk, dueDeck());
    let settles = 0;
    disk.beforeSet = (k) => {
      // The freeze is the first practiceSession write; the settle is the second.
      if (k === key('practiceSession') && ++settles === 2) throw new Error('killed');
    };
    const first = await finish(disk);
    assert.equal(first.status, 'kept');
    assert.deepEqual(first.pending, ['cleanup']);
    disk.beforeSet = null;
    const again = await finish(disk);
    assert.equal(again.status, 'completed');
    assert.equal((await drillEntries()).length, 1);
    assert.deepEqual((JSON.parse(disk.map.get(key('review'))!) as ReviewCard[]).map((c) => c.reps + c.lapses), [1, 1, 1]);
  });

  test('a card graded by ordinary review between the crash and the retry is skipped and reported, never graded twice', async () => {
    seedDeck(disk, dueDeck());
    disk.full.add('review');
    await finish(disk);
    disk.full.clear();
    // The learner reviews one card in the Review tab before the retry.
    await gradeCards([{ id: phraseKeyOf(PHRASES[0]!), grade: 'good' }]);
    const recovered = await recoverPracticeCompletion();
    assert.equal(recovered?.status, 'completed');
    assert.deepEqual(recovered?.grades.skipped, [phraseKeyOf(PHRASES[0]!)]);
    const first = (JSON.parse(disk.map.get(key('review'))!) as ReviewCard[]).find((c) => c.id === phraseKeyOf(PHRASES[0]!))!;
    assert.equal(first.reps, 1, 'the practice grade was stacked on the review grade');
  });

  test('the grade plan reads the disk, not a cache holding a write that failed', async () => {
    seedDeck(disk, dueDeck());
    await loadDeck();
    disk.full.add('review');
    // An ordinary grade that never reached the disk: the cache has it, the disk does not.
    await gradeCards([{ id: phraseKeyOf(PHRASES[1]!), grade: 'good' }]);
    disk.full.clear();
    const result = await finish(disk);
    assert.equal(result.status, 'completed');
    const onDisk = (JSON.parse(disk.map.get(key('review'))!) as ReviewCard[]).find((c) => c.id === phraseKeyOf(PHRASES[1]!))!;
    assert.equal(onDisk.reps, 1, 'the plan was fingerprinted against the optimistic cache');
  });
});

describe('practice completion — accounts', () => {
  const OTHER = '66666666-6666-4666-8666-000000000001';

  test('a sign-out while the plan is being made writes nothing anywhere, and finishing again completes once', async () => {
    seedDeck(disk, dueDeck());
    const first = uid;
    let switched = false;
    disk.beforeGet = (k) => {
      if (!switched && k === key('activity', first)) {
        switched = true;
        setActiveUser(OTHER);
      }
    };
    const result = await finish(disk);
    assert.equal(result.status, 'account-changed');
    for (const suffix of ['review', 'activity', 'practiceHistory', 'practiceSession']) {
      assert.equal(disk.map.has(key(suffix, OTHER)), false, `${suffix} leaked into the next account`);
    }
    assert.equal(disk.map.has(key('activity', first)), false);
    assert.equal(disk.map.has(key('practiceHistory', first)), false);
    disk.beforeGet = null;
    setActiveUser(first);
    assert.equal(await recoverPracticeCompletion(), null, 'nothing was frozen, so nothing is pending');
    assert.equal((await finish(disk)).status, 'completed');
    assert.equal((await drillEntries()).length, 1);
  });

  test('a sign-out after the plan froze leaks nothing, and the original learner recovers it once', async () => {
    seedDeck(disk, dueDeck());
    const first = uid;
    let switched = false;
    let frozen = false;
    disk.beforeSet = (k) => {
      if (k === key('practiceSession', first)) frozen = true;
    };
    disk.beforeGet = (k) => {
      // The history read that follows the freeze, not the pre-check before it.
      if (!switched && frozen && k === key('practiceHistory', first)) {
        switched = true;
        setActiveUser(OTHER);
      }
    };
    const result = await finish(disk);
    disk.beforeSet = null;
    assert.ok(switched, 'the switch never happened after the freeze, so this checks nothing');
    assert.notEqual(result.status, 'completed');
    for (const suffix of ['review', 'activity', 'practiceHistory', 'practiceSession']) {
      assert.equal(disk.map.has(key(suffix, OTHER)), false, `${suffix} leaked into the next account`);
    }
    assert.equal(await recoverPracticeCompletion(), null, 'the other learner was offered this sitting');
    disk.beforeGet = null;
    setActiveUser(first);
    const recovered = await recoverPracticeCompletion();
    assert.equal(recovered?.status, 'completed', 'the original learner lost their sitting');
    assert.equal((await drillEntries()).length, 1, 'XP was logged twice across the sign-out');
    assert.deepEqual((JSON.parse(disk.map.get(key('review'))!) as ReviewCard[]).map((c) => c.reps + c.lapses), [1, 1, 1]);
  });

  test('an account deletion mid-write does not resurrect the deleted history', async () => {
    let cleared = false;
    disk.beforeGet = (k) => {
      if (!cleared && k === key('practiceHistory')) {
        cleared = true;
        void clearActiveUserData({ sweepAudio: () => ({ removed: 0, failed: 0 }) });
      }
    };
    const ack = await recordRevisitStarted({ sessionId: 'room-1', packId: PACK, at: NOW });
    assert.equal(ack, 'failed');
    assert.equal(disk.map.has(key('practiceHistory')), false, 'a queued write brought a deleted namespace back');
    assert.equal(dirtyStamp('practiceHistory'), null);
  });

  test('the account reset clears both practice namespaces', async () => {
    await recordRevisitStarted({ sessionId: 'room-1', packId: PACK, at: NOW });
    const built = buildPracticeSession(targets(), BANK, dueDeck(), NOW);
    await savePracticeSession({ sittingId: 's1', startedAt: NOW, origin: 'pack', packId: PACK, exposed: false, micSuppressed: false, targets: built.targets, state: built.state });
    assert.ok(disk.map.has(key('practiceHistory')) && disk.map.has(key('practiceSession')));
    await clearActiveUserData({ sweepAudio: () => ({ removed: 0, failed: 0 }) });
    assert.equal(disk.map.has(key('practiceHistory')), false);
    assert.equal(disk.map.has(key('practiceSession')), false);
  });
});

describe('practice completion — what a sitting is allowed to claim', () => {
  test('after the warm-up a success moves no schedule and recall becomes practised', async () => {
    seedDeck(disk, dueDeck());
    const result = await finish(disk, { exposed: true });
    assert.equal(result.status, 'completed');
    assert.ok(result.outcomes.every((o) => o.outcome !== 'recalled'));
    const deck = JSON.parse(disk.map.get(key('review'))!) as ReviewCard[];
    assert.deepEqual(deck.map((c) => c.reps), [0, 0, 0], 'a success after the warm-up advanced a schedule');
    assert.equal(deck.find((c) => c.id === phraseKeyOf(PHRASES[2]!))!.lapses, 1, 'the miss still counts as again');
  });

  test('help on one exercise downgrades that target only, in outcome and in schedule', async () => {
    seedDeck(disk, dueDeck());
    const helped = BANK[0]!.id;
    const result = await finish(disk, { assisted: [helped] });
    const byKey = new Map(result.outcomes.map((o) => [o.phraseKey, o.outcome]));
    assert.equal(byKey.get(phraseKeyOf(PHRASES[0]!)), 'practised');
    assert.equal(byKey.get(phraseKeyOf(PHRASES[1]!)), 'recalled');
    assert.equal(byKey.get(phraseKeyOf(PHRASES[2]!)), 'unresolved');
    const deck = JSON.parse(disk.map.get(key('review'))!) as ReviewCard[];
    assert.equal(deck.find((c) => c.id === phraseKeyOf(PHRASES[0]!))!.reps, 0, 'a helped answer advanced the schedule');
    assert.equal(deck.find((c) => c.id === phraseKeyOf(PHRASES[1]!))!.reps, 1);
  });

  test('help is matched through the answered record, so a played twin id counts', () => {
    const state: DrillSessionState = {
      queue: [], missesById: {}, startedAt: NOW, finished: true,
      answered: [{ id: 'rt-x-silent', phraseKey: 'phrase:x', outcome: 'good', attempts: 1 }],
    };
    const t: PracticeTarget[] = [{ phraseKey: 'phrase:x', source: { kind: 'review' }, exerciseId: 'rt-x', scheduled: true }];
    assert.deepEqual(practiceCardGrades(state, t, false), [{ id: 'phrase:x', grade: 'good' }]);
    assert.deepEqual(practiceCardGrades(state, t, false, ['rt-x-silent']), []);
  });
});

describe('practice session — same-device resume', () => {
  test('save, load and restore keep queue order, answered work and miss counts, and copy no French', async () => {
    const built = buildPracticeSession(targets(), BANK, dueDeck(), NOW);
    let state = answerCurrent(built.state, (built.state.queue[0] as { fr: string }).fr).state;
    state = answerCurrent(state, 'wrong').state;
    const ack = await savePracticeSession({
      sittingId: 's-resume', startedAt: NOW, origin: 'recommended', packId: PACK, exposed: false, micSuppressed: false,
      targets: built.targets, state, assisted: [],
    });
    assert.equal(ack, 'durable');
    const raw = disk.map.get(key('practiceSession'))!;
    for (const fr of PHRASES) assert.ok(!raw.includes(fr) && !raw.includes('english'), 'exercise text was copied into the resume record');

    const record = await loadPracticeSession();
    assert.ok(record);
    const restored = restorePracticeSession(record, BANK, dueDeck(), NOW + 1000)!;
    assert.deepEqual(restored.state.queue.map((e) => e.id), state.queue.map((e) => e.id));
    assert.deepEqual(restored.state.answered, state.answered);
    assert.deepEqual(restored.state.missesById, state.missesById);
    assert.deepEqual(restored.missing, []);
  });

  test('a silent sitting resumes on the same twin in the same place', () => {
    const twin = { kind: 'listen-type', id: 'rt-b-silent', phraseKey: 'phrase:b', difficulty: 'production', fr: 'b', accepted: ['b'] };
    const spoken = { kind: 'repeat-this', id: 'rt-b', phraseKey: 'phrase:b', difficulty: 'production', reference: 'b', referenceEn: 'b', ipa: null, noMicTwin: twin } as unknown as DrillExercise;
    const record = {
      sittingId: 's1', startedAt: NOW, origin: 'review' as const, packId: null, exposed: false, micSuppressed: true, assisted: [],
      targets: [{ phraseKey: 'phrase:b', source: { kind: 'review' as const }, exerciseId: 'rt-b', scheduled: true }],
      queue: ['rt-b-silent'], answered: [], missesById: { 'rt-b-silent': 1 },
    };
    const restored = restorePracticeSession(record, [spoken], [], NOW)!;
    assert.deepEqual(restored.state.queue.map((e) => e.id), ['rt-b-silent']);
    assert.equal(restored.state.missesById['rt-b-silent'], 1);
  });

  test('a deleted exercise is reported missing, and a sitting with nothing left cannot resume', () => {
    const record = {
      sittingId: 's1', startedAt: NOW, origin: 'pack' as const, packId: PACK, exposed: false, micSuppressed: false, assisted: [],
      targets: targets(), queue: [BANK[0]!.id, 'pack:gone:en-fr:9'], answered: [], missesById: {},
    };
    const restored = restorePracticeSession(record, BANK, dueDeck(), NOW)!;
    assert.deepEqual(restored.missing, ['pack:gone:en-fr:9']);
    assert.equal(restorePracticeSession({ ...record, queue: ['pack:gone:en-fr:9'] }, BANK, [], NOW), null);
  });

  test('a card graded elsewhere since loses the right to move the schedule on resume', () => {
    const record = {
      sittingId: 's1', startedAt: NOW, origin: 'pack' as const, packId: PACK, exposed: false, micSuppressed: false, assisted: [],
      targets: targets(true), queue: [BANK[0]!.id], answered: [], missesById: {},
    };
    const notDue = PHRASES.map((fr) => card(fr, NOW + 86_400_000));
    assert.ok(restorePracticeSession(record, BANK, notDue, NOW)!.targets.every((t) => !t.scheduled));
  });

  test('a completed sitting cannot be saved again, and a pending completion blocks save, load and clear', async () => {
    seedDeck(disk, dueDeck());
    disk.full.add('activity');
    await finish(disk);
    const built = buildPracticeSession(targets(), BANK, dueDeck(), NOW);
    const input = { sittingId: 's-one', startedAt: NOW, origin: 'pack' as const, packId: PACK, exposed: false, micSuppressed: false, targets: built.targets, state: built.state };
    assert.equal(await savePracticeSession(input), 'failed', 'a new save landed over a pending plan');
    assert.equal(await savePracticeSession({ ...input, sittingId: 's-other' }), 'failed');
    assert.equal(await clearPracticeSession('s-one'), 'failed');
    assert.equal(await loadPracticeSession(), null);
    disk.full.clear();
    await recoverPracticeCompletion();
    assert.equal(await savePracticeSession(input), 'failed', 'a finished sitting was reopened');
    assert.equal(await savePracticeSession({ ...input, sittingId: 's-other' }), 'durable');
  });

  test('an old or corrupt resume record reads as nothing to resume', async () => {
    disk.map.set(key('practiceSession'), JSON.stringify({ version: 0, session: { sittingId: 's' } }));
    assert.equal(await loadPracticeSession(), null);
    disk.map.set(key('practiceSession'), '{not json');
    assert.equal(await loadPracticeSession(), null);
  });
});

describe('practice history store — acknowledgements and the sync seam', () => {
  test('an invalid event and a disk from a newer build both answer failed and write nothing', async () => {
    assert.equal(await recordRevisitStarted({ sessionId: 'bad id', packId: PACK, at: NOW }), 'failed');
    disk.map.set(key('practiceHistory'), JSON.stringify({ version: 2, events: [] }));
    assert.equal(await recordRevisitStarted({ sessionId: 'room-2', packId: PACK, at: NOW }), 'failed');
    assert.equal(JSON.parse(disk.map.get(key('practiceHistory'))!).version, 2, 'a newer disk was overwritten');
  });

  test('a refused write raises no flag, a duplicate record is durable without a write', async () => {
    disk.full.add('practiceHistory');
    assert.equal(await recordRevisitStarted({ sessionId: 'room-1', packId: PACK, at: NOW }), 'failed');
    assert.equal(dirtyStamp('practiceHistory'), null);
    disk.full.clear();
    assert.equal(await recordRevisitStarted({ sessionId: 'room-1', packId: PACK, at: NOW }), 'durable');
    const writes = disk.sets.length;
    assert.equal(await recordRevisitStarted({ sessionId: 'room-1', packId: PACK, at: NOW }), 'durable');
    assert.equal(disk.sets.length, writes);
  });

  test('the adopter folds the account in without raising the flag and keeps a write made mid-cycle', async () => {
    await recordPracticeEvent({ kind: 'warmup-completed', id: 'w1', at: NOW, packId: PACK });
    const adopt = adopterFor('practiceHistory');
    assert.ok(adopt, 'practiceHistory has no adopter');
    const stamp = dirtyStamp('practiceHistory');
    const remote = { version: 1, events: [{ kind: 'revisit-started', id: 'room-9', at: NOW + 1, packId: PACK }] };
    const reply = await adopt((current) => {
      const events = (current as { events: unknown[] }).events;
      return { version: 1, events: [...events, ...remote.events] };
    });
    assert.equal(reply, 'adopted');
    assert.deepEqual((await loadPracticeHistory()).map((e) => e.id), ['w1', 'room-9']);
    assert.equal(dirtyStamp('practiceHistory'), stamp, 'adopting was treated as a local change');
    assert.equal(await adopt(() => ({ version: 3, events: [] })), 'declined');
  });
});

describe('practice completion — a bounded history, and a bounded receipt (Fable F1, F2)', () => {
  /** An account history already full of events dated after NOW: clock skew elsewhere, or this clock rolled back. */
  function seedFutureHistory(count = 151): void {
    const events = Array.from({ length: count }, (_, i) => ({ kind: 'revisit-started', id: `future-${i}`, at: NOW + 86_400_000 + i, packId: PACK }));
    disk.map.set(key('practiceHistory'), JSON.stringify(mergePracticeHistory(null, { version: 1, events, floor: 0 })));
  }

  test('a sitting older than everything the history keeps still finishes: grades and XP land, history says aged out, the next sitting can save', async () => {
    seedDeck(disk, dueDeck());
    seedFutureHistory();
    const before = disk.map.get(key('practiceHistory'));
    const result = await finish(disk);
    assert.equal(result.status, 'completed', `stuck as ${result.status} with ${result.pending.join(',')}`);
    assert.equal(result.history, 'aged-out', 'the result claimed a history row that is not on disk');
    assert.equal(disk.map.get(key('practiceHistory')), before, 'the history was rewritten for an event it did not keep');
    assert.equal((await drillEntries()).length, 1);
    assert.equal(await recoverPracticeCompletion(), null, 'the plan never settled');
    const built = buildPracticeSession(targets(), BANK, dueDeck(), NOW);
    const next = { sittingId: 's-next', startedAt: NOW, origin: 'pack' as const, packId: PACK, exposed: false, micSuppressed: false, targets: built.targets, state: built.state };
    assert.equal(await savePracticeSession(next), 'durable', 'a stuck plan blocked every later sitting');
  });

  test('a plan already pending when the history aged it out settles on replay, once', async () => {
    seedDeck(disk, dueDeck());
    disk.full.add('practiceHistory');
    assert.equal((await finish(disk)).status, 'kept');
    disk.full.clear();
    seedFutureHistory();
    const recovered = await recoverPracticeCompletion();
    assert.equal(recovered?.status, 'completed');
    assert.equal(recovered?.history, 'aged-out');
    assert.equal((await drillEntries()).length, 1);
    assert.equal(await recoverPracticeCompletion(), null);
  });

  test('an ordinary completion says its history row was recorded', async () => {
    seedDeck(disk, dueDeck());
    assert.equal((await finish(disk)).history, 'recorded');
  });

  test('a stale replay of a sitting finished many sittings ago earns nothing again', async () => {
    for (let i = 0; i < 25; i += 1) {
      seedDeck(disk, dueDeck());
      assert.equal((await finish(disk, { sittingId: `s-${i}`, now: NOW + i * 1000 })).status, 'completed');
    }
    const drills = (await drillEntries()).length;
    const history = (await loadPracticeHistory()).length;
    seedDeck(disk, dueDeck());
    const stale = await finish(disk, { sittingId: 's-0', now: NOW + 999_999 });
    assert.equal(stale.status, 'already-completed');
    assert.equal((await drillEntries()).length, drills, 'a stale replay logged XP again');
    assert.equal((await loadPracticeHistory()).length, history);
  });

  test('with its receipt gone, the retained history alone still refuses a second completion', async () => {
    seedDeck(disk, dueDeck());
    await finish(disk);
    const doc = JSON.parse(disk.map.get(key('practiceSession'))!);
    disk.map.set(key('practiceSession'), JSON.stringify({ ...doc, completed: [] }));
    seedDeck(disk, dueDeck());
    const replay = await finish(disk, { now: NOW + 5000 });
    assert.equal(replay.status, 'already-completed');
    assert.equal((await drillEntries()).length, 1);
    assert.deepEqual((JSON.parse(disk.map.get(key('review'))!) as ReviewCard[]).map((c) => c.reps + c.lapses), [0, 0, 0]);
  });

  test('two different sittings over the same cards are two real sittings, each graded once', async () => {
    // Fable F3, pinned as intended behaviour: identity is the sitting, not the card.
    seedDeck(disk, dueDeck());
    await finish(disk, { sittingId: 's-a' });
    const after = JSON.parse(disk.map.get(key('review'))!) as ReviewCard[];
    await finish(disk, { sittingId: 's-a', now: NOW + 1 });
    assert.deepEqual(JSON.parse(disk.map.get(key('review'))!), after, 'the same sitting graded twice');
  });
});

describe('practice completion — active learning time (Phase 1B)', () => {
  test('the measured active total lands on the drill entry beside the wall duration', async () => {
    seedDeck(disk, dueDeck());
    const done = await finish(disk, { durationMs: 600_000, activeMs: 95_000 });
    assert.equal(done.status, 'completed');
    const [drill] = await drillEntries();
    assert.equal(drill!.durationMs, 600_000);
    assert.equal(drill!.activeMs, 95_000);
  });

  test('with no active measurement the entry carries none, and wall time is never copied in', async () => {
    seedDeck(disk, dueDeck());
    await finish(disk);
    const [drill] = await drillEntries();
    assert.equal(drill!.durationMs, 60_000);
    assert.equal(Object.prototype.hasOwnProperty.call(drill, 'activeMs'), false);
  });

  test('a malformed active total is dropped, and the sitting still completes', async () => {
    for (const bad of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
      resetSyncRegistry();
      disk = installDisk();
      uid = `55555555-5555-4555-8555-${String(++uids).padStart(12, '0')}`;
      setActiveUser(uid);
      seedDeck(disk, dueDeck());
      const done = await finish(disk, { activeMs: bad });
      assert.equal(done.status, 'completed', `activeMs ${bad} blocked the completion`);
      assert.equal((await drillEntries())[0]!.activeMs, undefined);
    }
  });

  test('an active total larger than a rolled-back wall duration still completes; it is not clipped to wall time', async () => {
    seedDeck(disk, dueDeck());
    const done = await finish(disk, { durationMs: 0, activeMs: 40_000 });
    assert.equal(done.status, 'completed');
    assert.equal((await drillEntries())[0]!.activeMs, 40_000);
  });

  test('a plan frozen before activeMs existed still replays, and credits no active time', async () => {
    seedDeck(disk, dueDeck());
    disk.full.add('activity');
    const kept = await finish(disk, { activeMs: 12_000 });
    assert.equal(kept.status, 'kept');
    // Rewrite the pending plan the way an older build froze it: no activeMs field.
    const doc = JSON.parse(disk.map.get(key('practiceSession'))!);
    assert.equal(doc.completion.activeMs, 12_000, 'the plan did not freeze the active total');
    delete doc.completion.activeMs;
    disk.map.set(key('practiceSession'), JSON.stringify(doc));
    disk.full.delete('activity');
    const recovered = await recoverPracticeCompletion();
    assert.equal(recovered?.status, 'completed');
    const [drill] = await drillEntries();
    assert.equal(drill!.activeMs, undefined, 'an old plan was credited active time it never measured');
  });

  test('a replay of a frozen plan uses the frozen active total, not the new call\'s', async () => {
    seedDeck(disk, dueDeck());
    disk.full.add('activity');
    await finish(disk, { activeMs: 30_000 });
    disk.full.delete('activity');
    const again = await finish(disk, { activeMs: 999_000 });
    assert.equal(again.status, 'completed');
    const drills = await drillEntries();
    assert.equal(drills.length, 1, 'a replay logged XP twice');
    assert.equal(drills[0]!.activeMs, 30_000);
  });
});

describe('practice resume record — active learning time (Phase 1B)', () => {
  function liveInput(extra: Record<string, unknown> = {}) {
    const deck = dueDeck();
    const built = buildPracticeSession(targets(), BANK, deck, NOW);
    return {
      sittingId: 's-resume',
      startedAt: NOW,
      origin: 'pack' as const,
      packId: PACK,
      exposed: false,
      micSuppressed: false,
      targets: built.targets,
      state: built.state,
      ...extra,
    };
  }

  test('the saved sitting keeps its active total, so a resume starts from it', async () => {
    assert.equal(await savePracticeSession(liveInput({ activeMs: 44_000 })), 'durable');
    assert.equal((await loadPracticeSession())?.activeMs, 44_000);
  });

  test('a record saved before activeMs existed still resumes and reads as no measured time', async () => {
    assert.equal(await savePracticeSession(liveInput()), 'durable');
    const record = await loadPracticeSession();
    assert.notEqual(record, null, 'an old-shaped record no longer resumes');
    assert.equal(Object.prototype.hasOwnProperty.call(record, 'activeMs'), false);
  });

  test('a malformed saved active total is dropped rather than failing the save', async () => {
    assert.equal(await savePracticeSession(liveInput({ activeMs: -1 })), 'durable');
    assert.equal((await loadPracticeSession())?.activeMs, undefined);
  });

  test('a stored record with a malformed active total is refused as a whole, not credited', async () => {
    await savePracticeSession(liveInput({ activeMs: 5_000 }));
    const doc = JSON.parse(disk.map.get(key('practiceSession'))!);
    doc.session.activeMs = 'lots';
    disk.map.set(key('practiceSession'), JSON.stringify(doc));
    assert.equal(await loadPracticeSession(), null);
  });
});
