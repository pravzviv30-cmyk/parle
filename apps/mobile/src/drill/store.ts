/**
 * The drill bank on the device.
 *
 * Same architecture as review/store.ts: AsyncStorage under one versioned key,
 * every mutation through one serialized write chain so concurrent writers can
 * never lose an update. One difference, deliberate: the store is read once and
 * cached, because the bank is written from few places and the drill screen
 * reads it on every mount — a load-once cache keeps that read instant without
 * a second source of truth (every write updates the cache before the disk).
 *
 * First run is the fixtures. A learner installs the app and can drill the café
 * arc immediately; generated batches arriving later merge over the fixtures
 * through `mergeExercises` rather than waiting on a first conversation.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DRILL_FIXTURES, type DrillExercise } from '@parle/core';
import { onUserScopeReset, userKey } from '../storage/scope.ts';
import { mergeExerciseBank } from './merge.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('drills');

interface DrillStore {
  version: 1;
  exercises: DrillExercise[];
  /** ISO timestamp until which "can't speak now" holds, or null. */
  micSuppressedUntil: string | null;
}

function defaultStore(): DrillStore {
  return { version: 1, exercises: [...DRILL_FIXTURES], micSuppressedUntil: null };
}

/** Same shape as review/store.ts and for the same reason: see that file. */
let writeChain: Promise<unknown> = Promise.resolve();

function serialized<T>(mutation: () => Promise<T>): Promise<T> {
  const next = writeChain.then(mutation, mutation);
  writeChain = next.catch(() => {});
  return next;
}

let cache: Promise<DrillStore> | null = null;

// The load-once cache is per-account truth: drop it the moment the account
// changes, or the next learner would drill the last learner's bank.
onUserScopeReset(() => {
  cache = null;
});

function isStore(value: unknown): value is DrillStore {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { version?: unknown }).version === 1 &&
    Array.isArray((value as { exercises?: unknown }).exercises)
  );
}

async function readStore(): Promise<DrillStore> {
  try {
    const raw = await AsyncStorage.getItem(KEY());
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isStore(parsed)) {
        return {
          version: 1,
          exercises: parsed.exercises,
          micSuppressedUntil: typeof parsed.micSuppressedUntil === 'string' ? parsed.micSuppressedUntil : null,
        };
      }
    }
  } catch {
    // A corrupt bank is not worth crashing over. Start from the fixtures.
  }
  return defaultStore();
}

function loadStore(): Promise<DrillStore> {
  cache ??= readStore();
  return cache;
}

async function saveStore(store: DrillStore): Promise<void> {
  // The cache is the truth the moment the write is decided; the disk catches up.
  cache = Promise.resolve(store);
  try {
    await AsyncStorage.setItem(KEY(), JSON.stringify(store));
  } catch {
    // Storage full or unavailable. The bank still works for this launch.
  }
}

/** The exercises to drill from. The fixtures until anything fresher lands. */
export async function loadDrillBank(): Promise<DrillExercise[]> {
  return (await loadStore()).exercises;
}

/**
 * Whether the tutor has authored anything from this learner's own
 * conversations yet — generated ids carry the `gen:` prefix. The Learn tab
 * shows its starter framing until this flips.
 */
export async function hasGeneratedExercises(): Promise<boolean> {
  return (await loadStore()).exercises.some((e) => e.id.startsWith('gen:'));
}

/**
 * Where the `drills` protocol message lands. `ConvoScreen` calls this once per
 * conversation, with the batch the tutor authored from what the learner just
 * said, so a sitting's own drills reach the bank on the way out of the session
 * rather than waiting on a relaunch.
 *
 * The fold itself is `mergeExerciseBank` in merge.ts — replace, never
 * accumulate, proven there under plain node. This function owns only the disk:
 * read through the cache, fold, write back through the chain.
 */
export function mergeExercises(incoming: readonly DrillExercise[]): Promise<DrillExercise[]> {
  return serialized(async () => {
    const store = await loadStore();
    const merged = mergeExerciseBank(store.exercises, incoming);
    await saveStore({ ...store, exercises: merged });
    return merged;
  });
}

/**
 * Persist the "can't speak now" window. The session applies `suppressMic` for
 * its own lifetime; this remembers the decision across screens and relaunches
 * so the next hour of sittings opens silent without being asked again.
 */
export function setMicSuppressed(until: string | null): Promise<void> {
  return serialized(async () => {
    const store = await loadStore();
    await saveStore({ ...store, micSuppressedUntil: until });
  });
}

/** The raw window edge, or null when none was ever set. */
export async function getMicSuppressedUntil(): Promise<string | null> {
  return (await loadStore()).micSuppressedUntil;
}

/** Whether "can't speak now" still holds. An unparseable date reads as expired. */
export async function isMicSuppressed(now = Date.now()): Promise<boolean> {
  const until = await getMicSuppressedUntil();
  return until !== null && Date.parse(until) > now;
}
