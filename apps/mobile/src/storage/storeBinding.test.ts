/**
 * Which account a store's write belongs to, and who the account tells about it.
 *
 * Two invariants, both of which were understood and neither of which was
 * enforced until this file existed.
 *
 * **The account is bound when the work is asked for.** Every store here is a
 * read-modify-write serialised through a promise chain, and the chained callback
 * does not run in the same tick as the call that queued it. A store that
 * resolves `userKey(...)` inside that callback resolves it against whoever is
 * signed in when the queue drains — which on a fast sign-out and sign-in is the
 * *next* learner. progress/activity.ts was the worst of them: it re-read the key
 * it landed on and folded the queued entry into whatever it found there, so one
 * learner's session could be merged into another learner's log. Four stores had
 * the discipline with a comment explaining why, and four did not.
 *
 * **A local write is news; an adopted one is not.** The sync engine learns a
 * namespace changed through `markDirty`, and hands merged state back through the
 * adopter the store registered. A store that forgot the flag would sync only
 * when something else happened to dirty it; a store that raised the flag while
 * adopting would make every catch-up look like a fresh local change and spend a
 * pointless push cycle proving itself right.
 *
 * The double below is what makes this testable at all: AsyncStorage resolves
 * under plain node but has no implementation off a device, so the module object
 * every store shares is given one for the length of a test.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ConvoPhrase, DrillExercise, SessionSummary, StoredSession } from '@luvani/core';

import { USER_KEY_SUFFIXES, setActiveUser } from './scope.ts';
import { adopterFor, clearDirty, dirtyStamp, resetSyncRegistry, type SyncFold } from '../sync/registry.ts';
import { createSyncPolicy } from '../sync/policy.ts';
import { sameData } from '../sync/envelope.ts';

import { createStoredProfile, loadProfile, saveProfile } from '../profile/store.ts';
import { addPhrases, gradeCards, loadDeck } from '../review/store.ts';
import { loadDrillBank, mergeExercises } from '../drill/store.ts';
import { loadHistory, recordSession } from '../progress/store.ts';
import { loadActivity, recordActivity } from '../progress/activity.ts';
import { loadTopics, mergeSessionTopics } from '../topics/store.ts';
import { loadMissionCompletions, recordMissionCompletion } from '../missions/store.ts';
import { loadSoundChecks, recordSoundCheck } from '../soundcheck/store.ts';
import {
  hasSeenTutorIntro,
  loadSeenCoachMarks,
  markCoachMarkSeen,
  markTutorIntroSeen,
} from '../tutor/store.ts';
import { journalRecap } from '../live/journal.ts';
import { createLocalAdapter } from '../friends/localAdapter.ts';

// ─────────────────────────────────────────────────────────── the storage double

/**
 * Give the shared AsyncStorage module an implementation for this test.
 *
 * The stores import the same module object, so assigning the four methods onto
 * it is enough — no loader, no flag, no rewrite of a store to take an injected
 * disk it does not otherwise need.
 */
function installDisk(initial: Record<string, string> = {}): Map<string, string> {
  const map = new Map<string, string>(Object.entries(initial));
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
  shared.multiGet = (keys: string[]): Promise<[string, string | null][]> =>
    Promise.resolve(keys.map((key) => [key, map.get(key) ?? null]));
  shared.multiSet = (pairs: [string, string][]): Promise<void> => {
    for (const [key, value] of pairs) map.set(key, value);
    return Promise.resolve();
  };
  shared.multiRemove = (keys: string[]): Promise<void> => {
    for (const key of keys) map.delete(key);
    return Promise.resolve();
  };
  return map;
}

// ───────────────────────────────────────────────────────────────── the fixtures

const phrase = (fr: string, en: string): ConvoPhrase => ({
  fr,
  frWritten: null,
  en,
  enLiteral: null,
  register: 'familier',
  note: null,
});

const exercise = (id: string, phraseKey: string): DrillExercise =>
  ({
    id,
    phraseKey,
    kind: 'listen-type',
    difficulty: 'production',
    fr: 'Ça marche',
    accepted: ['ça marche'],
  }) as DrillExercise;

const summary = (lessonId: string): SessionSummary => ({
  lessonId,
  durationSec: 120,
  pronunciation: { stats: [], focus: null, overall: 0, wins: [] },
  pronunciationStatus: 'unavailable' as SessionSummary['pronunciationStatus'],
  unassistedRate: 0.5,
  wordsProduced: [],
  longestTurnSec: 0,
  speakingShare: 0.5,
  turnsCompleted: 4,
  rescues: 0,
  utterancesScored: 0,
  struggledTurnIds: [],
  nextStartRung: 1 as SessionSummary['nextStartRung'],
});

const recap = {
  headline: 'You ordered a coffee.',
  wins: [],
  fixes: [],
  phrases: [phrase('Ça marche', 'coming up')],
  nextFocus: '',
  topics: [{ fr: 'Au café', en: 'Ordering at the café' }],
  cefr: { estimate: 'A1' as const, confidence: 'low' as const },
  stats: { turns: 4, rescues: 0, unassistedRate: 0.5 },
};

let uids = 0;
const nextUid = (): string => `11111111-1111-4111-8111-${String(++uids).padStart(12, '0')}`;

let disk: Map<string, string>;
let uid: string;

beforeEach(() => {
  disk = installDisk();
  // Drop the adopters, then change the account: the scope reset is what puts
  // them back, which is the same thing that happens on a real account switch.
  resetSyncRegistry();
  uid = nextUid();
  setActiveUser(uid);
});

// ────────────────────────────────────────────── which account a write belongs to

/**
 * Every write path that can still be in flight when the account changes.
 *
 * `seed` is for the stores that only write when something was already there.
 */
interface QueuedWrite {
  readonly store: string;
  readonly suffix: string;
  seed?(key: string): string;
  write(): Promise<unknown>;
}

const QUEUED_WRITES: readonly QueuedWrite[] = [
  { store: 'progress/activity.ts', suffix: 'activity', write: () => recordActivity('convo', 12) },
  { store: 'drill/store.ts', suffix: 'drills', write: () => mergeExercises([exercise('gen:queued', 'phrase:ça marche')]) },
  { store: 'live/journal.ts', suffix: 'journal', write: () => journalRecap(recap, { savedAt: 1 }) },
  {
    store: 'friends/localAdapter.ts',
    suffix: 'friends',
    seed: () =>
      JSON.stringify({
        version: 1,
        friends: [{ id: 'f1', username: 'sample.1', displayName: 'Sample', since: 1, preview: true }],
        requests: [],
      }),
    write: () => createLocalAdapter().removeFriend('f1'),
  },
  {
    store: 'topics/store.ts',
    suffix: 'topics',
    write: () => mergeSessionTopics([{ title: { fr: 'Au café', en: 'Ordering at the café' }, phraseKeys: [] }], '2026-08-26'),
  },
  { store: 'progress/store.ts', suffix: 'history', write: () => recordSession(summary('cafe-order'), 5) },
  { store: 'review/store.ts', suffix: 'review', write: () => addPhrases([phrase('Ça marche', 'coming up')]) },
  { store: 'missions/store.ts', suffix: 'missions', write: () => recordMissionCompletion('cafe-order', 2, 5) },
  { store: 'tutor/store.ts', suffix: 'coachMarks', write: () => markCoachMarkSeen('mic') },
  {
    store: 'soundcheck/store.ts',
    suffix: 'soundChecks',
    write: () =>
      recordSoundCheck({ missionId: 'cafe-order', reference: 'Ça marche', at: 5, kind: 'self-guided', focus: null }),
  },
  { store: 'profile/store.ts', suffix: 'profile', write: () => saveProfile(createStoredProfile({ name: 'A', motivation: null }, 5)) },
  { store: 'tutor/store.ts (intro)', suffix: 'tutorIntro', write: () => markTutorIntroSeen() },
];

/**
 * Queue a write, switch account before the queue can drain, and report where it
 * landed. The switch is synchronous on purpose: the chained callback has not run
 * yet, which is precisely the window this whole invariant is about.
 */
async function landingOf(entry: QueuedWrite): Promise<{ mine: boolean; theirs: boolean }> {
  const mine = `luvani.u.${uid}.${entry.suffix}`;
  if (entry.seed) disk.set(mine, entry.seed(mine));
  const before = disk.get(mine) ?? null;

  const inFlight = entry.write();
  const next = nextUid();
  setActiveUser(next);
  await inFlight;

  return {
    mine: (disk.get(mine) ?? null) !== before,
    theirs: disk.has(`luvani.u.${next}.${entry.suffix}`),
  };
}

describe('the account a queued write belongs to', () => {
  test("a write queued under one account never lands in the next account's storage", async () => {
    // One test over every write path in the app, because the invariant is not a
    // property of any one store: a single store that resolves its key late is a
    // learner's work filed under a stranger.
    for (const entry of QUEUED_WRITES) {
      // A fresh account per store, so no store inherits the switch the last one made.
      uid = nextUid();
      setActiveUser(uid);
      const landed = await landingOf(entry);
      assert.equal(landed.mine, true, `${entry.store}: the write never reached the account that asked for it`);
      assert.equal(landed.theirs, false, `${entry.store}: the write landed under the account that signed in after it`);
    }
  });

  for (const entry of QUEUED_WRITES) {
    test(`${entry.store} binds the account when the write is asked for, not when it runs`, async () => {
      const landed = await landingOf(entry);
      assert.equal(landed.mine, true, 'the write never reached the account that asked for it');
      assert.equal(landed.theirs, false, 'the write landed under the account that signed in after it');
    });
  }

  test('a queued write is folded into the bank it was queued against, not the one it lands beside', async () => {
    // The sharpest edge of the same bug, and the reason activity.ts was named
    // first: a store with a load-once cache that misses re-reads the key it is
    // about to write, so a late-resolved key does not just misfile the entry —
    // it merges one learner's work into another learner's data.
    const mine = `luvani.u.${uid}.drills`;
    disk.set(mine, JSON.stringify({ version: 1, exercises: [exercise('gen:mine', 'phrase:mine')], micSuppressedUntil: null }));
    const other = nextUid();
    disk.set(
      `luvani.u.${other}.drills`,
      JSON.stringify({ version: 1, exercises: [exercise('gen:theirs', 'phrase:theirs')], micSuppressedUntil: null }),
    );

    const inFlight = mergeExercises([exercise('gen:queued', 'phrase:queued')]);
    setActiveUser(other);
    await inFlight;

    const landedMine = JSON.parse(disk.get(mine)!) as { exercises: DrillExercise[] };
    const landedTheirs = JSON.parse(disk.get(`luvani.u.${other}.drills`)!) as { exercises: DrillExercise[] };
    assert.deepEqual(
      landedMine.exercises.map((e) => e.id).sort(),
      ['gen:mine', 'gen:queued'],
      'the batch folded into the bank of the account that generated it',
    );
    assert.deepEqual(
      landedTheirs.exercises.map((e) => e.id),
      ['gen:theirs'],
      "the next account's bank was not touched by work it never did",
    );
  });
});

// ───────────────────────────────────────── the seam each store shares with sync

interface SyncedStore {
  readonly namespace: string;
  write(): Promise<unknown>;
  readonly merged: unknown;
  read(): Promise<unknown>;
  readonly expected: unknown;
  /** Something the store must refuse rather than write over good local data. */
  readonly corrupt: unknown;
  /**
   * The learner's own write that lands while the engine is on the network.
   *
   * The engine reads this key, spends a round trip on the pull, and only then
   * adopts. This is the grade, the banked session or the finished conversation
   * that happened in between — the thing F93 destroyed. It must enqueue
   * synchronously, because that is what puts it on the store's chain ahead of
   * the adoption the way a real one would be.
   */
  during(): Promise<unknown>;
  /** The account's blob, as the engine pulled it. */
  readonly remote: unknown;
  /** Both the account's state and the mid-cycle write, on disk, afterwards. */
  survived(): Promise<void>;
}

/**
 * The engine's own fold, built from the real policy.
 *
 * Copied in behaviour rather than in code from `engine.ts`, and deliberately so:
 * a store-side test that built its own merge rule would prove the stores agree
 * with the test, not that they agree with the reconciler. `current` is whatever
 * the store hands it, which is the whole point of the fold.
 */
const syncPolicy = createSyncPolicy({ now: () => Date.UTC(2026, 7, 26, 12, 0, 0) });

function foldFrom(namespace: string, remote: unknown): SyncFold {
  return (current: unknown): unknown => {
    const result = syncPolicy.merge({ namespace, local: current, remote });
    return result.kind === 'merged' ? result.data : current;
  };
}

/** The brain phrase a conversation banks. Unioned by key, so it always survives. */
const brainPhrase = (fr: string, en: string) => ({
  fr,
  frWritten: null,
  en,
  register: 'familier' as const,
  introducedAt: '2026-08-26T00:00:00.000Z',
  timesUsedWell: 1,
  mastered: false,
});

const localProfile = createStoredProfile({ name: 'Camille', ageConfirmed: true, motivation: 'travel' }, 5);

/** The same profile after a conversation banked one phrase into the brain. */
const profileAfterConvo = {
  ...localProfile,
  brain: { ...localProfile.brain, phrases: { 'phrase:pendant': brainPhrase('pendant', 'during') } },
};

/** The account's profile: a different phrase, and more sessions behind it. */
const remoteProfile = {
  ...createStoredProfile({ name: 'Camille', ageConfirmed: true, motivation: 'travel' }, 5),
  brain: {
    ...localProfile.brain,
    phrases: { 'phrase:ailleurs': brainPhrase('ailleurs', 'elsewhere') },
    stats: { ...localProfile.brain.stats, sessions: 9, totalTurns: 40 },
  },
};

/**
 * A whole `ReviewCard`, not a sketch of one.
 *
 * `mergeDecks` is strict about the fields it orders on and the ones the
 * scheduler dereferences, and drops anything that fails — so a half-written
 * fixture would make this file's merges quietly do nothing.
 */
const card = (id: string) => ({
  id,
  kind: 'vocab' as const,
  front: 'Merci',
  back: 'thanks',
  context: '',
  ipa: '',
  addedAt: 1,
  due: 0,
  intervalDays: 1,
  ease: 2.5,
  reps: 1,
  lapses: 0,
});

async function phraseKeysOnDisk(): Promise<string[]> {
  return Object.keys((await loadProfile())?.brain.phrases ?? {}).sort();
}

const SYNCED_STORES: readonly SyncedStore[] = [
  {
    namespace: 'profile',
    write: () => saveProfile(localProfile),
    merged: { ...createStoredProfile({ name: 'Merged', ageConfirmed: true, motivation: 'travel' }, 5) },
    read: async () => (await loadProfile())?.name ?? null,
    expected: 'Merged',
    corrupt: { version: 99, name: 'From the future' },
    // A conversation that ended mid-cycle, banking one phrase into the brain.
    during: () => saveProfile(profileAfterConvo),
    remote: remoteProfile,
    survived: async () => {
      assert.deepEqual(
        await phraseKeysOnDisk(),
        ['phrase:ailleurs', 'phrase:pendant'],
        "the conversation's phrase was written over by a profile computed before it happened",
      );
    },
  },
  {
    namespace: 'review',
    write: () => addPhrases([phrase('Ça marche', 'coming up')]),
    merged: [card('phrase:merged')],
    read: async () => (await loadDeck()).map((c) => c.id),
    expected: ['phrase:merged'],
    corrupt: 'not a deck',
    // The judge's own scenario: the learner grades a card during the pull.
    during: () => gradeCards([{ id: 'phrase:ça marche', grade: 'good' }]),
    remote: [card('phrase:merci')],
    survived: async () => {
      const deck = await loadDeck();
      assert.deepEqual(
        deck.map((c) => c.id).sort(),
        ['phrase:merci', 'phrase:ça marche'],
        'the account\'s card and the graded card did not both survive',
      );
      const graded = deck.find((c) => c.id === 'phrase:ça marche');
      assert.equal(graded?.reps, 1, 'the grade was destroyed on disk by the adoption');
    },
  },
  {
    namespace: 'drills',
    write: () => mergeExercises([exercise('gen:local', 'phrase:local')]),
    merged: { version: 1, exercises: [exercise('gen:merged', 'phrase:merged')], micSuppressedUntil: null },
    read: async () => (await loadDrillBank()).map((e) => e.id),
    expected: ['gen:merged'],
    corrupt: { version: 99, exercises: [] },
    during: () => mergeExercises([exercise('gen:during', 'phrase:during')]),
    remote: { version: 1, exercises: [exercise('gen:remote', 'phrase:remote')], micSuppressedUntil: null },
    survived: async () => {
      // The fixtures ride along in every real bank, so this asks about the
      // generated rows: the account's, this device's, and the one that landed
      // while the engine was on the network.
      assert.deepEqual(
        (await loadDrillBank()).map((e) => e.id).filter((id) => id.startsWith('gen:')).sort(),
        ['gen:during', 'gen:local', 'gen:remote'],
        "the batch banked during the cycle was written over by the account's bank",
      );
    },
  },
  {
    namespace: 'history',
    write: () => recordSession(summary('cafe-order'), 5),
    merged: [{ endedAt: 9, summary: summary('market') }] satisfies StoredSession[],
    read: async () => (await loadHistory()).map((s) => s.endedAt),
    expected: [9],
    corrupt: { not: 'an array' },
    during: () => recordSession(summary('market'), 6),
    remote: [{ endedAt: 9, summary: summary('bakery') }] satisfies StoredSession[],
    survived: async () => {
      assert.deepEqual(
        (await loadHistory()).map((s) => s.endedAt),
        [5, 6, 9],
        'the session banked during the cycle was written over by the account\'s history',
      );
    },
  },
  {
    namespace: 'activity',
    write: () => recordActivity('convo', 12, 5),
    merged: { version: 1, entries: [{ at: 9, kind: 'drill', xp: 7 }], backfilled: true },
    read: async () => (await loadActivity()).map((e) => e.xp),
    expected: [7],
    corrupt: { version: 99, entries: [] },
    during: () => recordActivity('drill', 7, 6),
    remote: { version: 1, entries: [{ at: 9, kind: 'review', xp: 3 }], backfilled: false },
    survived: async () => {
      assert.deepEqual(
        (await loadActivity()).map((e) => e.xp),
        [12, 7, 3],
        'the sitting logged during the cycle was written over by the account\'s log',
      );
    },
  },
  {
    namespace: 'topics',
    write: () =>
      mergeSessionTopics([{ title: { fr: 'Au café', en: 'Ordering at the café' }, phraseKeys: [] }], '2026-08-26'),
    merged: {
      version: 1,
      topics: [{ id: 'topic:merged', title: { fr: 'Au marché', en: 'At the market' }, discussed: ['2026-08-25'], phraseKeys: [] }],
    },
    read: async () => (await loadTopics()).map((t) => t.id),
    expected: ['topic:merged'],
    corrupt: { version: 99, topics: [] },
    during: () => mergeSessionTopics([{ title: { fr: 'Au marché', en: 'At the market' }, phraseKeys: [] }], '2026-08-26'),
    remote: {
      version: 1,
      topics: [
        { id: 'topic:at-the-bakery', title: { fr: 'À la boulangerie', en: 'At the bakery' }, discussed: ['2026-08-20'], phraseKeys: [] },
      ],
    },
    survived: async () => {
      assert.deepEqual(
        (await loadTopics()).map((t) => t.id).sort(),
        ['topic:at-the-bakery', 'topic:at-the-market', 'topic:ordering-at-the-cafe'],
        'the topic curated during the cycle was written over by the account\'s list',
      );
    },
  },
  {
    namespace: 'missions',
    write: () => recordMissionCompletion('cafe-order', 2, 5),
    merged: { version: 1, completions: [{ id: 'market', at: 9, rung: 3 }] },
    read: async () => (await loadMissionCompletions()).map((c) => c.id),
    expected: ['market'],
    corrupt: { version: 99, completions: [] },
    during: () => recordMissionCompletion('market', 3, 6),
    remote: { version: 1, completions: [{ id: 'bakery', at: 9, rung: 1 }] },
    survived: async () => {
      assert.deepEqual(
        (await loadMissionCompletions()).map((c) => c.id).sort(),
        ['bakery', 'cafe-order', 'market'],
        'the mission finished during the cycle was written over by the account\'s wins',
      );
    },
  },
  {
    namespace: 'soundChecks',
    write: () =>
      recordSoundCheck({ missionId: 'cafe-order', reference: 'Ça marche', at: 5, kind: 'self-guided', focus: null }),
    merged: {
      version: 1,
      evidence: [{ missionId: 'market', reference: 'Un kilo', at: 9, kind: 'assessed-clear', focus: null }],
    },
    read: async () => (await loadSoundChecks()).map((e) => e.at),
    expected: [9],
    corrupt: { version: 99, evidence: [] },
    during: () =>
      recordSoundCheck({ missionId: 'market', reference: 'Un kilo', at: 6, kind: 'self-guided', focus: null }),
    remote: {
      version: 1,
      evidence: [{ missionId: 'bakery', reference: 'Une baguette', at: 9, kind: 'assessed-clear', focus: null }],
    },
    survived: async () => {
      assert.deepEqual(
        (await loadSoundChecks()).map((e) => e.at),
        [5, 6, 9],
        'the check completed during the cycle was written over by the account\'s evidence',
      );
    },
  },
  {
    namespace: 'tutorIntro',
    write: () => markTutorIntroSeen(),
    merged: 1,
    read: () => hasSeenTutorIntro(),
    expected: true,
    corrupt: null,
    // A one-time flag has no read-modify-write to lose, and this is the honest
    // shape of that: the write that lands mid-cycle is the same write.
    during: () => markTutorIntroSeen(),
    remote: 1,
    survived: async () => {
      assert.equal(await hasSeenTutorIntro(), true, 'a flag that only ever turns on was turned off');
    },
  },
  {
    namespace: 'coachMarks',
    write: () => markCoachMarkSeen('mic'),
    // Union, not replace: adoption may turn a mark on and must never turn one off.
    merged: ['orb'],
    read: () => loadSeenCoachMarks(),
    expected: ['mic', 'orb'],
    corrupt: 'not a list',
    // 'ladder' sorts before 'mic', so the disk going into the adoption is in the
    // order the marks were dismissed rather than in the order the policy emits.
    // The store has to land on the policy's order or it is re-adopted forever.
    during: () => markCoachMarkSeen('ladder'),
    remote: ['orb'],
    survived: async () => {
      assert.deepEqual(
        await loadSeenCoachMarks(),
        ['ladder', 'mic', 'orb'],
        'the mark dismissed during the cycle was unread by the adoption',
      );
    },
  },
];
describe('the seam every synced store shares with the reconciler', () => {
  test('every synced namespace is a per-user suffix a data reset clears', () => {
    const cleared = new Set<string>(USER_KEY_SUFFIXES);
    for (const store of SYNCED_STORES) {
      assert.equal(cleared.has(store.namespace), true, `${store.namespace} is synced but survives a reset`);
    }
  });

  for (const store of SYNCED_STORES) {
    test(`${store.namespace}: a learner's own write is news for the account and an adopted one is not`, async () => {
      await store.write();
      const stamp = dirtyStamp(store.namespace);
      assert.notEqual(stamp, null, 'a write the account has not seen must raise the flag, or it is never pushed');
      assert.equal(clearDirty(store.namespace, stamp!), true);

      const adopt = adopterFor(store.namespace);
      assert.ok(adopt, 'a synced namespace with no adopter is a merge the engine can never hand back');
      assert.equal(await adopt(() => store.merged), 'adopted');

      assert.deepEqual(await store.read(), store.expected, 'the merged state did not reach the store');
      assert.equal(
        dirtyStamp(store.namespace),
        null,
        'adopting is this device catching up with the account, not a new local change',
      );
    });

    test(`${store.namespace}: a merge this build cannot read is dropped, never written over good local data`, async () => {
      await store.write();
      const before = await store.read();
      const adopt = adopterFor(store.namespace);
      assert.ok(adopt);
      assert.equal(
        await adopt(() => store.corrupt),
        'declined',
        'a store that cannot read the fold must say so, not fail silently',
      );
      assert.deepEqual(await store.read(), before, 'an unreadable merge overwrote what this device could read');
    });
  }

  // ───────────────────────────────────────────────── the window F93 left open

  test('a local write that lands while a merge is being adopted survives the adoption', async () => {
    // One test over every synced store, because the loss is not a property of
    // any one of them. The engine reads a namespace, spends a network round
    // trip on the pull, and only then adopts; a store handed a *finished* blob
    // writes a value computed from a world several hundred milliseconds old.
    // The grade, the banked session or the finished conversation that landed in
    // between is written over — and, because it had already raised the dirty
    // flag, the clobbered state is then pushed to the account and the flag is
    // cleared. The learner's work is gone on every device, silently.
    for (const store of SYNCED_STORES) {
      // The beforeEach shape: drop the adopters, then change the account, so the
      // scope reset is what puts them back — exactly as a real switch does.
      resetSyncRegistry();
      uid = nextUid();
      setActiveUser(uid);

      await store.write();

      const adopt = adopterFor(store.namespace);
      assert.ok(adopt, `${store.namespace}: no adopter`);

      // Fired, not awaited, and the adoption is asked for in the same tick: this
      // is the write in flight when the engine comes back off the network, and
      // it only survives if the store folds inside its own chain.
      const inFlight = store.during();
      const adopted = adopt(foldFrom(store.namespace, store.remote));
      await inFlight;
      assert.equal(await adopted, 'adopted', `${store.namespace}: the account's state never reached the store`);

      await store.survived();
    }
  });

  test("an adopted merge is folded into the store's current state, never written over it", async () => {
    // The mechanism under the test above, asserted directly. Two claims, and
    // both have to hold or the fold is decoration: the store hands the fold the
    // blob it holds *at that instant* — byte for byte what the engine would read
    // off this key — and it writes what the fold gives back rather than
    // replacing its own state with something computed elsewhere.
    for (const store of SYNCED_STORES) {
      // The beforeEach shape: drop the adopters, then change the account, so the
      // scope reset is what puts them back — exactly as a real switch does.
      resetSyncRegistry();
      uid = nextUid();
      setActiveUser(uid);

      await store.write();
      await store.during();

      const key = `luvani.u.${uid}.${store.namespace}`;
      const raw = disk.get(key) ?? null;
      const onDisk: unknown = raw === null ? null : JSON.parse(raw);

      const adopt = adopterFor(store.namespace);
      assert.ok(adopt, `${store.namespace}: no adopter`);

      const seen: unknown[] = [];
      const answered: unknown[] = [];
      const reply = await adopt((current) => {
        seen.push(current);
        const next = foldFrom(store.namespace, store.remote)(current);
        answered.push(next);
        return next;
      });

      assert.equal(reply, 'adopted', `${store.namespace}: the fold was refused`);
      assert.equal(seen.length, 1, `${store.namespace}: the fold must be called exactly once, inside the chain`);
      assert.deepEqual(
        seen[0],
        onDisk,
        `${store.namespace}: the fold was handed something other than the state this store is holding`,
      );

      await store.survived();

      // And what the store wrote is what the fold answered. The engine pushes
      // the fold's answer, so a store that quietly adds a rule of its own —
      // another cap, another sort — leaves the disk and the account's row
      // different forever, and the engine re-adopts on every cycle for the rest
      // of that install's life. `sameData` is the engine's own comparison.
      const settled = disk.get(key) ?? null;
      assert.equal(
        sameData(settled === null ? null : JSON.parse(settled), answered[0]),
        true,
        `${store.namespace}: the store wrote something other than what the fold answered`,
      );
    }
  });
});
