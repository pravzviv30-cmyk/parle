/**
 * The learner's practice topics on the device.
 *
 * Storage shell only: every rule about topics (identity, merging, caps) lives
 * in core's topics module, so this file is a versioned envelope and a write
 * chain and nothing more. The chain matters: the practice message and the
 * leave-early fallback can race for the same key in one beat, and the last
 * writer must see the first one's work.
 *
 * Dates are stored at day granularity on purpose — "talked about twice" is a
 * feeling, not billing, and two sittings in one afternoon are one day of
 * talking about it.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeTopics, type IncomingTopic, type PracticeTopic } from '@parle/core';
import { userKey } from '../storage/scope.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('topics');

const VERSION = 1;

interface StoredTopics {
  version: typeof VERSION;
  topics: PracticeTopic[];
}

let writeChain: Promise<unknown> = Promise.resolve();

function serialized<T>(mutation: () => Promise<T>): Promise<T> {
  const next = writeChain.then(mutation, mutation);
  writeChain = next.catch(() => {});
  return next;
}

export async function loadTopics(): Promise<PracticeTopic[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY());
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

/** Fold one session's curated topics in. Core owns the merge; this owns the disk. */
export function mergeSessionTopics(
  incoming: readonly IncomingTopic[],
  discussedOn = new Date().toISOString().slice(0, 10),
): Promise<void> {
  if (incoming.length === 0) return Promise.resolve();
  return serialized(async () => {
    const existing = await loadTopics();
    const merged = mergeTopics(existing, incoming, discussedOn);
    try {
      await AsyncStorage.setItem(KEY(), JSON.stringify({ version: VERSION, topics: merged }));
    } catch {
      // Storage full or unavailable. The deck still banked the phrases.
    }
  });
}
