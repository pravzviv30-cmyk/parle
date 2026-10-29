/**
 * What this phone remembers about the launch wall for one account (founder
 * decision 4, 2026-10-28, superseding D24's cadence): the last local day it
 * opened, and whether the learner has finished a conversation yet.
 *
 * - `shownDay`: the launch wall (or the first-run `path-complete` offer, which
 *   counts as that day's showing) opened on this day, so it never opens again
 *   the same day.
 * - `conversationDone`: set once, when a conversation ran to its recap with at
 *   least one learner reply (`ConvoScreen.tsx`). Until then the launch wall
 *   never opens on its own.
 *
 * Device-local under `userKey('launch-wall-seen')`, the shape `home/homeSeen.ts`
 * uses: excluded from sync (`sync/policy.ts`) and cleared with the account
 * (`storage/scope.ts`). The last record is held in memory for the account, so
 * a write the disk refused still never shows the wall twice in one day.
 *
 * Also the seam an early exit uses: `noteLeftEarly` tells the launch wall
 * controller (through `useLaunchWall.ts`) that the learner left a conversation
 * or the first scene without a recap, and that return opens nothing.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDayKey, type DayKey } from '@luvani/core';

import { readOwnedCache } from '../storage/ownedRead.ts';
import { scopeGeneration, userKey, writeInUserScope } from '../storage/scope.ts';

export const LAUNCH_WALL_SEEN_VERSION = 1;

export interface LaunchWallSeen {
  version: typeof LAUNCH_WALL_SEEN_VERSION;
  shownDay: DayKey | null;
  conversationDone: boolean;
}

export const NOTHING_SEEN: LaunchWallSeen = { version: LAUNCH_WALL_SEEN_VERSION, shownDay: null, conversationDone: false };

export function isLaunchWallSeen(value: unknown): value is LaunchWallSeen {
  if (typeof value !== 'object' || value === null) return false;
  const seen = value as Record<string, unknown>;
  return seen.version === LAUNCH_WALL_SEEN_VERSION
    && (seen.shownDay === null || isDayKey(seen.shownDay))
    && typeof seen.conversationDone === 'boolean';
}

// ───────────────────────────────────────────────────────────── on this phone

const KEY = () => userKey('launch-wall-seen');

let memory: { generation: number; seen: LaunchWallSeen } | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

/** What this phone remembers for the signed-in learner. A read that fails reads as nothing remembered. */
export async function loadLaunchWallSeen(): Promise<LaunchWallSeen> {
  try {
    await writeChain;
    const generation = scopeGeneration();
    if (memory !== null && memory.generation === generation) return memory.seen;
    return readOwnedCache(await AsyncStorage.getItem(KEY()), isLaunchWallSeen) ?? NOTHING_SEEN;
  } catch {
    return NOTHING_SEEN;
  }
}

/** Apply `change` to the current record, held in memory at once, then written one at a time for the account it was asked for. */
function update(change: (seen: LaunchWallSeen) => LaunchWallSeen): Promise<boolean> {
  let key: string;
  try {
    key = KEY();
  } catch {
    return Promise.resolve(false);
  }
  const generation = scopeGeneration();
  const work = async (): Promise<boolean> => {
    if (generation !== scopeGeneration()) return false;
    let base: LaunchWallSeen;
    if (memory !== null && memory.generation === generation) base = memory.seen;
    else {
      try { base = readOwnedCache(await AsyncStorage.getItem(key), isLaunchWallSeen) ?? NOTHING_SEEN; } catch { base = NOTHING_SEEN; }
    }
    const next = change(base);
    memory = { generation, seen: next };
    return writeInUserScope(generation, () => AsyncStorage.setItem(key, JSON.stringify(next))).catch(() => false);
  };
  const run = writeChain.then(work, work);
  writeChain = run;
  return run;
}

/** The launch wall (or the first-run offer) opened today. */
export function markLaunchWallShown(day: DayKey): Promise<boolean> {
  return update((seen) => ({ ...seen, shownDay: day }));
}

/** A conversation ran to its recap with a learner reply. Set once; never cleared. */
export function markConversationDone(): Promise<boolean> {
  return update((seen) => (seen.conversationDone ? seen : { ...seen, conversationDone: true }));
}

// ───────────────────────────────────────────────────────────── early exit

const leftEarlyListeners = new Set<() => void>();

/** The learner left a conversation or the first scene without a recap. */
export function noteLeftEarly(): void {
  for (const listener of [...leftEarlyListeners]) listener();
}

export function onLeftEarly(listener: () => void): () => void {
  leftEarlyListeners.add(listener);
  return () => { leftEarlyListeners.delete(listener); };
}

/** For tests: forget what this launch remembered. */
export function forgetLaunchWallSeenInMemory(): void {
  memory = null;
}
