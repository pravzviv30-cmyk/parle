/**
 * The account-synced conversation-practice history on this device.
 *
 * One key (`practiceHistory`), one serialised write chain, the account bound at
 * enqueue and re-checked against the scope generation just before the write,
 * so neither a sign-out nor an account deletion mid-await can land one
 * learner's event in another's namespace or bring a deleted namespace back.
 *
 * No cache: every read comes off the disk, so "already recorded" always means
 * "already durable", and a replayed completion is a no-op rather than a second
 * row. Shapes and the merge live in `history.ts`, shared with `sync/policy.ts`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PersistAck } from '../storage/ack.ts';
import { onUserScopeReset, scopeGeneration, userKey, writeInUserScope } from '../storage/scope.ts';
import { markDirty, registerSyncAdopter, type SyncAdoption, type SyncFold } from '../sync/registry.ts';
import {
  isEventId,
  isPracticeEvent,
  PRACTICE_HISTORY_VERSION,
  readPracticeHistory,
  type PracticeEvent,
  type StoredPracticeHistory,
  uniquePracticeEvents,
  withPracticeEvents,
} from './history.ts';

export const PRACTICE_HISTORY_SUFFIX = 'practiceHistory';

const KEY = () => userKey('practiceHistory');

let chain: Promise<unknown> = Promise.resolve();

interface Bound {
  key: string;
  generation: number;
}

function serialized<T>(mutation: (bound: Bound) => Promise<T>): Promise<T> {
  // Bound when the work is asked for, never when it runs.
  const bound = { key: KEY(), generation: scopeGeneration() };
  const run = () => mutation(bound);
  const next = chain.then(run, run);
  chain = next.catch(() => {});
  return next;
}

/** The raw parsed blob, or null only when absent. Unreadable history is unknown. */
async function persisted(key: string): Promise<unknown> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (readPracticeHistory(parsed) === null) throw new Error('Practice history could not be read');
  return parsed;
}

async function readStored(key: string): Promise<StoredPracticeHistory | 'newer' | 'unreadable'> {
  const empty: StoredPracticeHistory = { version: PRACTICE_HISTORY_VERSION, events: [], floor: 0 };
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch {
    return 'unreadable';
  }
  if (raw === null) return empty;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return 'unreadable';
  }
  const version = typeof parsed === 'object' && parsed !== null ? (parsed as { version?: unknown }).version : undefined;
  if (typeof version === 'number' && version > PRACTICE_HISTORY_VERSION) return 'newer';
  return readPracticeHistory(parsed) ?? 'unreadable';
}

/** Write only if the scope this work was bound under still stands. */
async function write(bound: Bound, value: StoredPracticeHistory, origin: 'local' | 'adopted'): Promise<PersistAck> {
  try {
    const written = await writeInUserScope(bound.generation, () => AsyncStorage.setItem(bound.key, JSON.stringify(value)));
    if (!written) return 'failed';
  } catch {
    return 'failed';
  }
  if (origin === 'local') markDirty(PRACTICE_HISTORY_SUFFIX);
  return 'durable';
}

/** Every readable event for the signed-in account, one per (kind, id), oldest first. */
export async function loadPracticeHistory(): Promise<PracticeEvent[]> {
  const stored = await readStored(KEY());
  if (typeof stored === 'string') throw new Error('Practice history could not be read');
  return uniquePracticeEvents(stored.events);
}

/**
 * What recording one fact did.
 *
 * `aged-out` is not a failure and not a success: the event is older than
 * everything the bounded history keeps (at or below its floor, or cut by the
 * bound the moment it was added), so no row was written and none will be
 * shown. Nothing claims it is on disk. It happens after 150 newer events, or
 * when this device's clock is behind events synced from another one.
 */
export type PracticeRecordOutcome = PersistAck | 'aged-out';

/**
 * Record one fact, and say exactly what happened. Idempotent on `(kind, id)`:
 * an event already on disk answers `durable` without a write. An invalid event,
 * a disk written by a newer build, a refused write or a changed account answers
 * `failed`, and raises no flag.
 */
export function recordPracticeEventOutcome(event: PracticeEvent): Promise<PracticeRecordOutcome> {
  if (!isPracticeEvent(event)) return Promise.resolve('failed');
  return serialized(async (bound) => {
    const stored = await readStored(bound.key);
    if (stored === 'newer' || stored === 'unreadable') return 'failed';
    if (scopeGeneration() !== bound.generation) return 'failed';
    if (stored.events.some((held) => held.kind === event.kind && held.id === event.id)) return 'durable';
    const next = withPracticeEvents(stored, [event]);
    if (!next.events.some((held) => held.kind === event.kind && held.id === event.id)) return 'aged-out';
    return write(bound, next, 'local');
  });
}

/**
 * Record one fact. `durable` only when the row is on disk; an aged-out event is
 * `failed` here, because a caller holding a plain acknowledgement must never
 * read it as "recorded". Completion uses `recordPracticeEventOutcome` instead.
 */
export async function recordPracticeEvent(event: PracticeEvent): Promise<PersistAck> {
  const outcome = await recordPracticeEventOutcome(event);
  return outcome === 'aged-out' ? 'failed' : outcome;
}

/**
 * Whether the retained history already holds this completed sitting. Null when
 * the disk cannot be read or was written by a newer build: then nobody can say
 * it has not completed, and a caller must not start it afresh.
 */
export function hasRecordedSitting(sittingId: string): Promise<boolean | null> {
  return serialized(async (bound) => {
    const stored = await readStored(bound.key);
    if (stored === 'newer' || stored === 'unreadable') return null;
    if (scopeGeneration() !== bound.generation) return null;
    return stored.events.some((held) => held.kind === 'session-completed' && held.id === sittingId);
  });
}

/** A tutor revisit room opened for this conversation. Started, never succeeded. */
export function recordRevisitStarted(input: { sessionId: string; packId: string; at: number }): Promise<PersistAck> {
  if (!isEventId(input.sessionId)) return Promise.resolve('failed');
  return recordPracticeEvent({ kind: 'revisit-started', id: input.sessionId, at: input.at, packId: input.packId });
}

/** The recognition warm-up for one conversation finished. Exposure, never recall; no grades, no XP. */
export function recordWarmupCompleted(input: { warmupId: string; packId: string; at: number }): Promise<PersistAck> {
  if (!isEventId(input.warmupId)) return Promise.resolve('failed');
  return recordPracticeEvent({ kind: 'warmup-completed', id: input.warmupId, at: input.at, packId: input.packId });
}

/**
 * Fold the account's history into this device's, on this store's chain. The
 * folded value is validated exactly as a disk read is, so a row the merge
 * accepts is a row this store keeps.
 */
function adoptPracticeHistory(fold: SyncFold): Promise<SyncAdoption> {
  return serialized(async (bound) => {
    if (scopeGeneration() !== bound.generation) throw new Error('Practice history account changed before adoption');
    const folded = readPracticeHistory(fold(await persisted(bound.key)));
    if (folded === null) return 'declined';
    if (await write(bound, folded, 'adopted') !== 'durable') throw new Error('Practice history adoption was not durable');
    return 'adopted';
  });
}

function registerAdopter(): void {
  registerSyncAdopter('practiceHistory', adoptPracticeHistory);
}

registerAdopter();
onUserScopeReset(registerAdopter);
