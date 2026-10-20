/**
 * What a store says when the disk refuses it.
 *
 * Every practice store on this device is a read-modify-write ending in one
 * `AsyncStorage.setItem`, and every one of them used to catch that call's
 * failure and resolve anyway. That was a deliberate kindness — a full phone
 * should not stop a lesson — and it quietly became a lie the moment something
 * downstream started deleting data on the strength of those promises. The
 * journal deletes the only copy of a conversation when its writes resolve, so
 * "resolved" and "written" had to stop being the same word.
 *
 * Two things are checked here and neither is negotiable. A refused write
 * answers `failed`, and a refused write does not raise the sync dirty flag —
 * the registry's own rule at sync/registry.ts:181, because a flag raised for a
 * write that failed pushes the previous value to the account as if it were the
 * new one, and then every other device adopts it.
 *
 * The third thing is what must NOT change: the learner's launch. The caches are
 * filled before the disk is touched and stay filled when it refuses, so the
 * deck and the bank on screen are exactly what they would have been.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ConvoPhrase, DrillExercise } from '@luvani/core';

import { loadDrillBank, mergeExercises } from '../drill/store.ts';
import { addPhrases, loadDeck } from '../review/store.ts';
import { loadTopics, mergeSessionTopics } from '../topics/store.ts';
import { dirtyStamp, resetSyncRegistry, type SyncNamespace } from '../sync/registry.ts';
import { setActiveUser } from './scope.ts';
import type { PersistAck } from './ack.ts';

/**
 * The storage double, with a disk that can be full.
 *
 * Same arrangement as storeBinding.test.ts: the stores all import the same
 * module object, so giving it four methods is enough. `full` decides, per key,
 * whether this phone has room — which is how one store can be refused while the
 * other two are fine, the way a real quota bites the key that happens to be
 * written next.
 */
function installDisk(opts: { full?: (key: string) => boolean } = {}): Map<string, string> {
  const map = new Map<string, string>();
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = (key: string): Promise<string | null> => Promise.resolve(map.get(key) ?? null);
  shared.setItem = (key: string, value: string): Promise<void> => {
    if (opts.full?.(key)) return Promise.reject(new Error('QuotaExceededError'));
    map.set(key, value);
    return Promise.resolve();
  };
  shared.removeItem = (key: string): Promise<void> => {
    map.delete(key);
    return Promise.resolve();
  };
  return map;
}

const phrase = (fr: string, en: string): ConvoPhrase => ({
  fr,
  frWritten: null,
  en,
  enLiteral: null,
  register: 'familier',
  note: null,
});

const exercise = (id: string, phraseKey: string): DrillExercise =>
  ({ id, phraseKey, kind: 'listen-type', difficulty: 'production', fr: 'Ça marche', accepted: ['ça marche'] }) as DrillExercise;

/** One store, its key, its sync namespace, and the public write that reaches it. */
interface AcknowledgingStore {
  readonly store: string;
  readonly suffix: string;
  readonly namespace: SyncNamespace;
  write(): Promise<PersistAck>;
  /** What the learner still sees this launch. Null for a store with no cache. */
  stillServes: null | (() => Promise<boolean>);
}

const STORES: readonly AcknowledgingStore[] = [
  {
    store: 'review/store.ts',
    suffix: 'review',
    namespace: 'review',
    write: () => addPhrases([phrase('Ça marche', 'coming up')], { source: 'conversation' }),
    stillServes: async () => (await loadDeck()).some((card) => card.id === 'phrase:ça marche'),
  },
  {
    store: 'topics/store.ts',
    suffix: 'topics',
    namespace: 'topics',
    write: () =>
      mergeSessionTopics([{ title: { fr: 'Au café', en: 'Ordering at the café' }, phraseKeys: ['phrase:ça marche'] }], '2026-08-27'),
    // The topics store reads the key every time rather than caching it, so
    // there is no in-memory copy to still be serving. Nothing regressed here:
    // a refused write leaves the Learn tab showing the topics it showed before.
    stillServes: null,
  },
  {
    store: 'drill/store.ts',
    suffix: 'drills',
    namespace: 'drills',
    write: () => mergeExercises([exercise('gen:one', 'phrase:ça marche')]),
    stillServes: async () => (await loadDrillBank()).some((e) => e.id === 'gen:one'),
  },
];

let uids = 0;
const nextUid = (): string => `44444444-4444-4444-8444-${String(++uids).padStart(12, '0')}`;

let uid: string;

beforeEach(() => {
  resetSyncRegistry();
  uid = nextUid();
  setActiveUser(uid);
});

describe('what a store says about its own write', () => {
  test('a failed store write answers failed and never raises the dirty flag', async () => {
    // One test over all three stores, because the invariant is not a property of
    // any one of them: a single store that swallows a refusal is a journal that
    // deletes a conversation nobody wrote down.
    for (const entry of STORES) {
      uid = nextUid();
      resetSyncRegistry();
      setActiveUser(uid);
      const key = `luvani.u.${uid}.${entry.suffix}`;
      const disk = installDisk({ full: (k) => k === key });

      const ack = await entry.write();

      assert.equal(ack, 'failed', `${entry.store}: a refused write answered as if it had landed`);
      assert.equal(disk.has(key), false, `${entry.store}: the test's own disk did not actually refuse the write`);
      assert.equal(
        dirtyStamp(entry.namespace),
        null,
        `${entry.store}: a failed write raised the dirty flag, so the account would be pushed the previous value`,
      );
    }
  });

  test('a write that reaches the disk answers durable and raises the flag exactly once', async () => {
    // The other half. Without this, a store that answered `failed` on every
    // write would pass the test above and lose every session.
    for (const entry of STORES) {
      uid = nextUid();
      resetSyncRegistry();
      setActiveUser(uid);
      const key = `luvani.u.${uid}.${entry.suffix}`;
      const disk = installDisk();

      const ack = await entry.write();

      assert.equal(ack, 'durable', `${entry.store}: a write that landed would not say so`);
      assert.ok(disk.has(key), `${entry.store}: nothing reached the key`);
      assert.ok(dirtyStamp(entry.namespace) !== null, `${entry.store}: the account will never hear about this write`);
    }
  });

  test('a refused write still serves the learner for the rest of this launch', async () => {
    // The kindness the swallowed catch was there for, kept. A learner whose
    // phone is full keeps reviewing and drilling exactly what they just earned;
    // what changes is only that nobody downstream believes it is safe on disk.
    for (const entry of STORES) {
      if (entry.stillServes === null) continue;
      uid = nextUid();
      resetSyncRegistry();
      setActiveUser(uid);
      installDisk({ full: () => true });

      assert.equal(await entry.write(), 'failed');
      assert.equal(await entry.stillServes(), true, `${entry.store}: the learner lost this launch's work, not just the disk copy`);
    }
  });

  test('one full key does not stop the two stores beside it', async () => {
    // Quotas bite one write at a time. Banking two thirds of a conversation is
    // better than banking none of it, and the journal is kept either way — so
    // the store that can write, writes.
    const disk = installDisk({ full: (k) => k === `luvani.u.${uid}.review` });

    const [review, topics, drills] = [await STORES[0]!.write(), await STORES[1]!.write(), await STORES[2]!.write()];

    assert.equal(review, 'failed');
    assert.equal(topics, 'durable');
    assert.equal(drills, 'durable');
    assert.ok(disk.has(`luvani.u.${uid}.topics`), 'the topics went down even though the deck could not');
    assert.ok(disk.has(`luvani.u.${uid}.drills`), 'and so did the drills');
    assert.equal((await loadTopics()).length, 1);
  });

  test('a write with nothing in it is durable without touching the disk', async () => {
    // Nothing to fold is nothing at risk, and an outbox that treated an empty
    // section as a failure would keep every journal forever.
    const disk = installDisk({ full: () => true });

    assert.equal(await addPhrases([], { source: 'conversation' }), 'durable');
    assert.equal(await mergeSessionTopics([]), 'durable');
    assert.equal(await mergeExercises([]), 'durable');
    assert.equal(disk.size, 0, 'an empty batch wrote something');
  });
});
