/**
 * The learner's practice topics on the device.
 *
 * Storage shell only: every rule about topics (identity, merging, caps) lives
 * in core's topics module, so this file is a versioned envelope and a write
 * chain and nothing more. The chain matters: the practice message and the
 * leave-early fallback can race for the same key in one beat, and the last
 * writer must see the first one's work. The key is bound at enqueue for the
 * reason review/store.ts states — a queued write must land in the account that
 * asked for it, not in whichever account is signed in when it runs.
 *
 * Dates are stored at day granularity on purpose — "talked about twice" is a
 * feeling, not billing, and two sittings in one afternoon are one day of
 * talking about it.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeTopics, type IncomingTopic, type PracticeTopic } from '@luvani/core';
import type { PersistAck } from '../storage/ack.ts';
import { readOwnedCache } from '../storage/ownedRead.ts';
import { onUserScopeReset, scopeGeneration, userKey, writeInUserScope } from '../storage/scope.ts';
import { markDirty, registerSyncAdopter, type SyncAdoption, type SyncFold } from '../sync/registry.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('topics');

const VERSION = 1;

/** See progress/activity.ts for why an adopted write does not raise the flag. */
type WriteOrigin = 'local' | 'adopted';

interface StoredTopics {
  version: typeof VERSION;
  topics: PracticeTopic[];
}

let writeChain: Promise<unknown> = Promise.resolve();

interface Bound { key: string; generation: number }

function serialized<T>(mutation: (bound: Bound) => Promise<T>): Promise<T> {
  // Bind the account when the work is requested. A sign-out while a background
  // write is queued must never redirect that write into the next account.
  const bound = { key: KEY(), generation: scopeGeneration() };
  const run = () => mutation(bound);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => {});
  return next;
}

function isTopic(value: unknown): value is PracticeTopic {
  if (typeof value !== 'object' || value === null) return false;
  const topic = value as Partial<PracticeTopic>;
  return typeof topic.id === 'string' && topic.id.length > 0 &&
    typeof topic.title === 'object' && topic.title !== null &&
    typeof topic.title.fr === 'string' && typeof topic.title.en === 'string' &&
    Array.isArray(topic.discussed) && topic.discussed.every(day => typeof day === 'string') &&
    Array.isArray(topic.phraseKeys) && topic.phraseKeys.every(key => typeof key === 'string');
}

function isStoredTopics(value: unknown): value is StoredTopics {
  return typeof value === 'object' && value !== null && (value as StoredTopics).version === VERSION &&
    Array.isArray((value as StoredTopics).topics) && (value as StoredTopics).topics.every(isTopic);
}

async function readTopics(key: string): Promise<PracticeTopic[]> {
  return readOwnedCache(await AsyncStorage.getItem(key), isStoredTopics)?.topics ?? [];
}

/**
 * The envelope exactly as the sync engine reads it: the parsed key, or null when
 * this account has never written one.
 *
 * Not `readTopics`, which unwraps to a bare list and answers a missing key with
 * an empty one. The merge policy works on the shape that is actually on disk.
 */
async function persistedTopics(key: string): Promise<unknown> {
  return readOwnedCache(await AsyncStorage.getItem(key), isStoredTopics);
}

export function loadTopics(): Promise<PracticeTopic[]> {
  return readTopics(KEY());
}

/**
 * The one place this store touches the disk, and the one place it says so.
 *
 * `markDirty` sits inside the try because of the registry's own rule at
 * sync/registry.ts:181: a flag raised for a write that then failed would push
 * whatever happened to be on disk, which is the previous value. What the caller
 * gets back is the same fact in one word, so an outbox can tell a banked
 * session from a session that only looked banked.
 */
async function saveTopics(bound: Bound, topics: readonly PracticeTopic[], origin: WriteOrigin): Promise<PersistAck> {
  try {
    const written = await writeInUserScope(bound.generation, () =>
      AsyncStorage.setItem(bound.key, JSON.stringify({ version: VERSION, topics: [...topics] } satisfies StoredTopics)));
    if (!written) return 'failed';
    if (origin === 'local') markDirty('topics');
    return 'durable';
  } catch {
    // Storage full or unavailable. The deck still banked the phrases.
    return 'failed';
  }
}

/** Fold one session's curated topics in. Core owns the merge; this owns the disk. */
export function mergeSessionTopics(
  incoming: readonly IncomingTopic[],
  discussedOn = new Date().toISOString().slice(0, 10),
): Promise<PersistAck> {
  // No topics is no write, and no write is nothing that can have been lost.
  if (incoming.length === 0) return Promise.resolve('durable');
  return serialized(async (bound) => {
    const existing = await readTopics(bound.key);
    return saveTopics(bound, mergeTopics(existing, incoming, discussedOn), 'local');
  });
}

/**
 * Fold the account's topics into this device's, on this store's own chain.
 *
 * The engine hands over a fold rather than a finished list, because it read this
 * key before the pull: topics curated from a session that ended during the round
 * trip were written over by a list computed before that session, and then pushed.
 * The fold is called here, inside the chain, between the read and the write, with
 * the list this store holds at that instant. Core's union is by topic id, so
 * folding twice is the same as folding once.
 *
 * A topic needs an id to be a topic; anything without one is dropped rather than
 * rendered as an empty row on the Learn tab. The sitting dates and deck ids
 * inside are whatever the merge preserved — this store has never had an opinion
 * about them and does not grow one here.
 */
function adoptTopics(fold: SyncFold): Promise<SyncAdoption> {
  return serialized(async (bound) => {
    if (scopeGeneration() !== bound.generation) throw new Error('Topics account changed before adoption');
    const folded = fold(await persistedTopics(bound.key));
    if (!isStoredTopics(folded)) return 'declined';
    if (await saveTopics(bound, folded.topics, 'adopted') !== 'durable') throw new Error('Topics adoption was not durable');
    return 'adopted';
  });
}

function registerAdopter(): void {
  registerSyncAdopter('topics', adoptTopics);
}

// Registered at load, and again whenever the account scope changes: the sync
// registry is cleared on an account switch, and a module only evaluates once.
registerAdopter();
onUserScopeReset(registerAdopter);
