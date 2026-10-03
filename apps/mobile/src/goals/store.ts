/**
 * The account-synced goal steps on this device (Stage 4, 2026-09-25).
 *
 * `practice/historyStore.ts`'s shape, deliberately: one key (`goalSteps`), one
 * serialised write chain, the account bound at enqueue and re-checked against
 * the scope generation just before the write, so neither a sign-out nor an
 * account deletion mid-await can land one learner's row in another's namespace
 * or bring a deleted namespace back.
 *
 * No cache: every read comes off the disk, so "already recorded" means
 * "already durable", and a replayed record is a no-op rather than a second
 * row. Shapes and the merge live in `model.ts`, shared with `sync/policy.ts`.
 *
 * This file writes one key and reads one key. It imports nothing that holds
 * review, activity, drills, momentum, XP or practice time, and
 * `goals/isolation.test.ts` holds that both ways.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PersistAck } from '../storage/ack.ts';
import { onUserScopeReset, scopeGeneration, userKey, setItemInUserScope } from '../storage/scope.ts';
import { markDirty, registerSyncAdopter, type SyncAdoption, type SyncFold } from '../sync/registry.ts';
import {
  GOAL_STEPS_VERSION,
  isGoalStepEvent,
  readGoalSteps,
  uniqueGoalSteps,
  usedOutsideId,
  withGoalSteps,
  type GoalStepEvent,
  type StoredGoalSteps,
} from './model.ts';

export const GOAL_STEPS_SUFFIX = 'goalSteps';

const KEY = () => userKey('goalSteps');

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

/** The raw parsed blob, or null only when absent. Unread local data must block adoption. */
async function persisted(key: string): Promise<unknown> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (readGoalSteps(parsed) === null || !(parsed as StoredGoalSteps).steps.every(isGoalStepEvent)) throw new Error('goal steps could not be read');
  return parsed;
}

async function readStored(key: string): Promise<StoredGoalSteps | 'newer' | 'unreadable'> {
  const empty: StoredGoalSteps = { version: GOAL_STEPS_VERSION, steps: [] };
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
  if (typeof version === 'number' && version > GOAL_STEPS_VERSION) return 'newer';
  const stored = readGoalSteps(parsed);
  return stored !== null && (parsed as StoredGoalSteps).steps.every(isGoalStepEvent) ? stored : 'unreadable';
}

/** Write only if the scope this work was bound under still stands. */
async function write(bound: Bound, value: StoredGoalSteps, origin: 'local' | 'adopted'): Promise<PersistAck> {
  if (scopeGeneration() !== bound.generation) return 'failed';
  try {
    await setItemInUserScope(bound.generation, bound.key, JSON.stringify(value));
  } catch {
    return 'failed';
  }
  if (origin === 'local' && scopeGeneration() === bound.generation) markDirty(GOAL_STEPS_SUFFIX);
  return 'durable';
}

/**
 * Every readable row for the signed-in account, one per (kind, id), oldest
 * first. Rejects when the disk cannot be read at all, so a screen can tell a
 * failed read from an empty record. A newer build's disk is also unreadable.
 */
export async function loadGoalSteps(): Promise<GoalStepEvent[]> {
  const stored = await readStored(KEY());
  if (stored === 'unreadable' || stored === 'newer') throw new Error('goal steps could not be read');
  return uniqueGoalSteps(stored.steps);
}

/**
 * Record one row. Idempotent on `(kind, id)`: a row already on disk answers
 * `durable` with no write and no flag. An invalid row, a newer disk, a refused
 * write, a changed account, or a row the cap cut the moment it was added
 * answers `failed` and raises no flag.
 */
function record(row: GoalStepEvent): Promise<PersistAck> {
  if (!isGoalStepEvent(row)) return Promise.resolve('failed');
  return serialized(async (bound) => {
    const stored = await readStored(bound.key);
    if (stored === 'newer' || stored === 'unreadable') return 'failed';
    if (stored.steps.some((held) => held.kind === row.kind && held.id === row.id)) return 'durable';
    const next = withGoalSteps(stored, [row]);
    if (!next.steps.some((held) => held.kind === row.kind && held.id === row.id)) return 'failed';
    return write(bound, next, 'local');
  });
}

/**
 * A conversation opened from a goal became a real room. The session id is the
 * pack id the conversation will be saved under; nothing about how it went.
 */
export function recordGoalStepStarted(input: { sessionId: string; goalKey: string; task: string; at: number }): Promise<PersistAck> {
  return record({ kind: 'step-started', id: input.sessionId, at: input.at, goalKey: input.goalKey, task: input.task });
}

/**
 * The learner said they used this step outside the app. Their word, stored as
 * ids only: no phrase, no outcome, no count, and nothing else is touched.
 */
export function recordUsedOutside(input: { stepId: string; goalKey: string; at: number }): Promise<PersistAck> {
  return record({ kind: 'used-outside', id: usedOutsideId(input.stepId), at: input.at, goalKey: input.goalKey });
}

/**
 * Fold the account's goal steps into this device's, on this store's chain.
 * The folded value is validated exactly as a disk read is, so a row the merge
 * accepts is a row this store keeps.
 */
function adoptGoalSteps(fold: SyncFold): Promise<SyncAdoption> {
  return serialized(async (bound) => {
    let current: unknown;
    try { current = await persisted(bound.key); } catch { return 'declined'; }
    const folded = readGoalSteps(fold(current));
    if (folded === null) return 'declined';
    return (await write(bound, folded, 'adopted')) === 'durable' ? 'adopted' : 'declined';
  });
}

function registerAdopter(): void {
  registerSyncAdopter('goalSteps', adoptGoalSteps);
}

registerAdopter();
onUserScopeReset(registerAdopter);
