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
import { DRILL_FIXTURES, type DrillExercise } from '@luvani/core';
import type { PersistAck } from '../storage/ack.ts';
import { readOwnedCache } from '../storage/ownedRead.ts';
import { onUserScopeReset, scopeGeneration, userKey, writeInUserScope } from '../storage/scope.ts';
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
    Array.isArray((value as { exercises?: unknown }).exercises) &&
    (value as { exercises: unknown[] }).exercises.every(isExercise) &&
    ((value as { micSuppressedUntil?: unknown }).micSuppressedUntil === undefined ||
      (value as { micSuppressedUntil?: unknown }).micSuppressedUntil === null ||
      typeof (value as { micSuppressedUntil?: unknown }).micSuppressedUntil === 'string')
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
  const parsed = readOwnedCache(await AsyncStorage.getItem(key), isStore);
  if (parsed === null) return defaultStore();
  return {
    version: 1,
    // Add the new authored fifth rung for an existing bank. Stored choices win.
    exercises: mergeExerciseBank(parsed.exercises, DRILL_FIXTURES.filter(fixture =>
      fixture.kind === 'own-words' && !parsed.exercises.some(saved =>
        saved.phraseKey === fixture.phraseKey && saved.kind === fixture.kind))),
    micSuppressedUntil: typeof parsed.micSuppressedUntil === 'string' ? parsed.micSuppressedUntil : null,
  };
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
  return readOwnedCache(await AsyncStorage.getItem(key), isStore);
}

function loadStoreFor(key: string): Promise<DrillStore> {
  const cached = caches.get(key);
  if (cached) return cached;
  const pending = readStore(key);
  caches.set(key, pending);
  void pending.catch(() => { if (caches.get(key) === pending) caches.delete(key); });
  return pending;
}

function loadStore(): Promise<DrillStore> {
  return loadStoreFor(KEY());
}

/**
 * The one place this store touches the disk, and the one place it says so.
 *
 * The cache is filled first and stays filled when the write fails, so a learner
 * on a full phone drills exactly as they did before. `markDirty` is inside the
 * try for the registry's own reason (sync/registry.ts:181): a flag raised for a
 * failed write pushes the previous value to the account as if it were new.
 */
async function saveStore(bound: Bound, store: DrillStore, origin: WriteOrigin): Promise<PersistAck> {
  // The cache is the truth the moment the write is decided; the disk catches up.
  if (scopeGeneration() !== bound.generation) return 'failed';
  caches.set(bound.key, Promise.resolve(store));
  try {
    const written = await writeInUserScope(bound.generation, () => AsyncStorage.setItem(bound.key, JSON.stringify(store)));
    if (!written) return 'failed';
    if (origin === 'local') markDirty('drills');
    return 'durable';
  } catch {
    // Storage full or unavailable. The bank still works for this launch.
    return 'failed';
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
 * read through the cache, fold, write back through the chain, and answer with
 * what the disk actually did. The merged bank used to come back instead, and
 * nobody read it; what the outbox needs is whether the batch is safe to stop
 * keeping a copy of.
 */
export function mergeExercises(incoming: readonly DrillExercise[]): Promise<PersistAck> {
  // An empty batch folds to the bank that is already there, so there is nothing
  // to write and nothing that can have been lost.
  if (incoming.length === 0) return Promise.resolve('durable');
  return serialized(async (bound) => {
    const store = await loadStoreFor(bound.key);
    const merged = mergeExerciseBank(store.exercises, incoming);
    return saveStore(bound, { ...store, exercises: merged }, 'local');
  });
}

/**
 * Persist the "can't speak now" window. The session applies `suppressMic` for
 * its own lifetime; this remembers the decision across screens and relaunches
 * so the next hour of sittings opens silent without being asked again.
 */
export function setMicSuppressed(until: string | null): Promise<void> {
  return serialized(async (bound) => {
    const store = await loadStoreFor(bound.key);
    await saveStore(bound, { ...store, micSuppressedUntil: until }, 'local');
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
  return serialized(async (bound) => {
    if (scopeGeneration() !== bound.generation) throw new Error('Drill account changed before adoption');
    const folded = fold(await persistedStore(bound.key));
    if (!isStore(folded)) return 'declined';
    const micSuppressedUntil = typeof folded.micSuppressedUntil === 'string' ? folded.micSuppressedUntil : null;
    if (await saveStore(bound, { version: 1, exercises: folded.exercises, micSuppressedUntil }, 'adopted') !== 'durable') throw new Error('Drill adoption was not durable');
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
