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
import { mergeTopics, type IncomingTopic, type PracticeTopic } from '@parle/core';
import { onUserScopeReset, userKey } from '../storage/scope.ts';
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

function serialized<T>(mutation: (key: string) => Promise<T>): Promise<T> {
  // Bind the account when the work is requested. A sign-out while a background
  // write is queued must never redirect that write into the next account.
  const key = KEY();
  const run = () => mutation(key);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => {});
  return next;
}

async function readTopics(key: string): Promise<PracticeTopic[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredTopics> | null;
    if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.topics)) return [];
    return parsed.topics;
  } catch {
    // A corrupt store is not worth crashing over. The topics rebuild from
    // future sessions; the review deck underneath lost nothing.
    return [];
  }
}

/**
 * The envelope exactly as the sync engine reads it: the parsed key, or null when
 * this account has never written one.
 *
 * Not `readTopics`, which unwraps to a bare list and answers a missing key with
 * an empty one. The merge policy works on the shape that is actually on disk.
 */
async function persistedTopics(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function loadTopics(): Promise<PracticeTopic[]> {
  return readTopics(KEY());
}

async function saveTopics(key: string, topics: readonly PracticeTopic[], origin: WriteOrigin): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ version: VERSION, topics: [...topics] } satisfies StoredTopics));
    if (origin === 'local') markDirty('topics');
  } catch {
    // Storage full or unavailable. The deck still banked the phrases.
  }
}

/** Fold one session's curated topics in. Core owns the merge; this owns the disk. */
export function mergeSessionTopics(
  incoming: readonly IncomingTopic[],
  discussedOn = new Date().toISOString().slice(0, 10),
): Promise<void> {
  if (incoming.length === 0) return Promise.resolve();
  return serialized(async (key) => {
    const existing = await readTopics(key);
    await saveTopics(key, mergeTopics(existing, incoming, discussedOn), 'local');
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
  return serialized(async (key) => {
    const folded = fold(await persistedTopics(key));
    if (typeof folded !== 'object' || folded === null) return 'declined';
    const envelope = folded as Partial<StoredTopics>;
    if (envelope.version !== VERSION || !Array.isArray(envelope.topics)) return 'declined';
    const topics = envelope.topics.filter(
      (topic): topic is PracticeTopic =>
        typeof topic === 'object' && topic !== null && typeof (topic as PracticeTopic).id === 'string',
    );
    await saveTopics(key, topics, 'adopted');
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
