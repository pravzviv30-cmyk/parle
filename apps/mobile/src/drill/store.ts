/**
 * The drill bank on the device.
 *
 * Same architecture as review/store.ts: AsyncStorage under one versioned key,
 * every mutation through one serialized write chain so concurrent writers can
 * never lose an update, and the key bound at the moment the work is requested
 * rather than at the moment it runs. One difference, deliberate: the store is
 * read once and cached, because the bank is written from few places and the
 * drill screen reads it on every mount — a load-once cache keeps that read
 * instant without a second source of truth (every write updates the cache
 * before the disk). The cache is keyed by storage key for the same reason the
 * writes are: a queued write bound to the previous account must not be handed
 * the next account's bank to fold into.
 *
 * First run is the fixtures. A learner installs the app and can drill the café
 * arc immediately; generated batches arriving later merge over the fixtures
 * through `mergeExercises` rather than waiting on a first conversation.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DRILL_FIXTURES, type DrillExercise } from '@parle/core';
import { onUserScopeReset, userKey } from '../storage/scope.ts';
import { markDirty, registerSyncAdopter, type SyncAdoption, type SyncFold } from '../sync/registry.ts';
import { mergeExerciseBank } from './merge.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('drills');

/** See progress/activity.ts for why an adopted write does not raise the flag. */
type WriteOrigin = 'local' | 'adopted';

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

function serialized<T>(mutation: (key: string) => Promise<T>): Promise<T> {
  // Bind the account when the work is requested. A sign-out while a background
  // write is queued must never redirect that write into the next account.
  const key = KEY();
  const run = () => mutation(key);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => {});
  return next;
}

const caches = new Map<string, Promise<DrillStore>>();

// The load-once cache is per-account truth: drop it the moment the account
// changes, or the next learner would drill the last learner's bank.
onUserScopeReset(() => {
  caches.clear();
});

function isStore(value: unknown): value is DrillStore {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { version?: unknown }).version === 1 &&
    Array.isArray((value as { exercises?: unknown }).exercises)
  );
}

/**
 * The least an exercise must be to survive a trip through another device.
 *
 * `mergeExerciseBank` folds on `phraseKey`, `kind` and `id`, so a row missing
 * any of the three has no identity and cannot be merged with anything. The
 * deeper shape belongs to core's `DrillExercise` union and the player that
 * renders it; this is the identity check, not a second schema.
 */
function isExercise(value: unknown): value is DrillExercise {
  if (typeof value !== 'object' || value === null) return false;
  const exercise = value as Record<string, unknown>;
  return typeof exercise.id === 'string' && typeof exercise.phraseKey === 'string' && typeof exercise.kind === 'string';
}

async function readStore(key: string): Promise<DrillStore> {
  try {
    const raw = await AsyncStorage.getItem(key);
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

/**
 * The bank exactly as the sync engine reads it: the parsed key, or null when
 * this account has never written one.
 *
 * Deliberately not `loadStoreFor`. That answers a missing key with the fixtures,
 * and a merge policy told "this device holds the fixtures" would push them into
 * the account as if the learner had earned them.
 */
async function persistedStore(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    // Unreadable is the same as absent: the fold merges against nothing rather
    // than against a guess, and the account's bank is adopted whole.
    return null;
  }
}

function loadStoreFor(key: string): Promise<DrillStore> {
  const cached = caches.get(key);
  if (cached) return cached;
  const pending = readStore(key);
  caches.set(key, pending);
  return pending;
}

function loadStore(): Promise<DrillStore> {
  return loadStoreFor(KEY());
}

async function saveStore(key: string, store: DrillStore, origin: WriteOrigin): Promise<void> {
  // The cache is the truth the moment the write is decided; the disk catches up.
  caches.set(key, Promise.resolve(store));
  try {
    await AsyncStorage.setItem(key, JSON.stringify(store));
    if (origin === 'local') markDirty('drills');
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
  return serialized(async (key) => {
    const store = await loadStoreFor(key);
    const merged = mergeExerciseBank(store.exercises, incoming);
    await saveStore(key, { ...store, exercises: merged }, 'local');
    return merged;
  });
}

/**
 * Persist the "can't speak now" window. The session applies `suppressMic` for
 * its own lifetime; this remembers the decision across screens and relaunches
 * so the next hour of sittings opens silent without being asked again.
 */
export function setMicSuppressed(until: string | null): Promise<void> {
  return serialized(async (key) => {
    const store = await loadStoreFor(key);
    await saveStore(key, { ...store, micSuppressedUntil: until }, 'local');
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

/**
 * Fold the account's bank into this device's, on this store's own chain.
 *
 * The engine hands over a fold rather than a finished bank. It read this key
 * before the pull, so a batch `mergeExercises` banked during the round trip was
 * written over by a bank computed before that batch existed — and then pushed,
 * because the batch had already raised the dirty flag. Calling the fold here,
 * inside the chain, between the read and the write, is what keeps it: the fold
 * sees the bank this store holds at that instant. `mergeExerciseBank` is
 * idempotent and identity-based, so folding twice is the same as folding once.
 */
function adoptDrillBank(fold: SyncFold): Promise<SyncAdoption> {
  return serialized(async (key) => {
    const folded = fold(await persistedStore(key));
    if (!isStore(folded)) return 'declined';
    const micSuppressedUntil = typeof folded.micSuppressedUntil === 'string' ? folded.micSuppressedUntil : null;
    await saveStore(key, { version: 1, exercises: folded.exercises.filter(isExercise), micSuppressedUntil }, 'adopted');
    return 'adopted';
  });
}

function registerAdopter(): void {
  registerSyncAdopter('drills', adoptDrillBank);
}

// Registered at load, and again whenever the account scope changes: the sync
// registry is cleared on an account switch, and a module only evaluates once.
registerAdopter();
onUserScopeReset(registerAdopter);
