/**
 * Goal steps: that a conversation was opened from one of the learner's goals,
 * and that the learner said they used it outside the app (Stage 4, item 1).
 *
 * Pure, and free of AsyncStorage, for `practice/history.ts`'s reason:
 * `sync/policy.ts` merges this under plain node, and the store validates with
 * the same function the merge does, so the disk and the merge can never
 * disagree about which rows exist.
 *
 * ## What a row may hold is the whole privacy promise
 *
 * Identifiers and a time. A `step-started` row is the LiveKit session id (which
 * is also the pack id), the goal's normalised key, and a task id such as
 * `mission:cafe`. A `used-outside` row is `u.<step id>` and the goal key: no
 * phrase, no outcome, no count. The validator is exact about keys, so a field
 * carrying a sentence can never ride along, even from a future build, and the
 * task's character set has no space in it, so no sentence fits there either.
 * The goal key is the same normalised text the profile envelope already
 * carries (`learnerGoals`), so nothing new leaves the phone.
 *
 * `fit` ("matches your goal" or a starting point) is never stored. It is a
 * projection `next.ts` makes each time, so a stored row cannot claim a match.
 *
 * ## The merge
 *
 * A plain set union on the whole canonical row, sorted by
 * `(at, kind, id, rendering)`, then the newest sixty. A count cap over a sorted
 * set is commutative, associative and idempotent. A union keyed on `(kind, id)`
 * with a canonical pick would not be: the pick is by rendering, which puts `at`
 * first as text, so between two differing copies of one row the older could win
 * and then be cut. Differing copies of one `(kind, id)` only come from a bug or
 * a forged payload; storage keeps both and `uniqueGoalSteps`, the reader view,
 * shows the canonical max, as `uniquePracticeEvents` does.
 *
 * No row's validity depends on another row. A `used-outside` whose step aged
 * out survives on its own; `evidence.ts` shows nothing for it.
 */

import { conversationPackIdOf } from '@luvani/core';

import { factKey, MAX_GOAL_CHARS } from '../profile/memory.ts';
import { stableStringify } from '../sync/envelope.ts';

/** The inner schema version this build writes. `sync/policy.ts` imports it. */
export const GOAL_STEPS_VERSION = 1;

/** Newest rows kept, on disk and in the merge. */
export const MAX_GOAL_STEPS = 60;

export type GoalStepEvent =
  | { kind: 'step-started'; id: string; at: number; goalKey: string; task: string }
  | { kind: 'used-outside'; id: string; at: number; goalKey: string };

export interface StoredGoalSteps {
  version: typeof GOAL_STEPS_VERSION;
  steps: GoalStepEvent[];
}

/** The same id alphabet the practice history accepts, and a pack id besides. */
const EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/;

/** A task family and an id with no whitespace, so no sentence can ride in it. */
const TASK = /^(mission|situation|moment):[A-Za-z0-9][A-Za-z0-9:._-]{0,150}$/;

const STARTED_KEYS = ['kind', 'id', 'at', 'goalKey', 'task'] as const;
const USED_KEYS = ['kind', 'id', 'at', 'goalKey'] as const;

// ─────────────────────────────────────────────────────────────── validation

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactly(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && own.every((key) => keys.includes(key));
}

function isPackId(value: unknown): value is string {
  return typeof value === 'string' && conversationPackIdOf(value) === value;
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** A key `factKey` made: non-empty, bounded, and its own normalisation. */
export function isGoalKey(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_GOAL_CHARS && factKey(value) === value;
}

/** A task id this or a later build could write. Never checked against the catalogue. */
export function isGoalTask(value: unknown): value is string {
  return typeof value === 'string' && TASK.test(value);
}

/** The one strict validator, shared by the store and the sync policy. */
export function isGoalStepEvent(value: unknown): value is GoalStepEvent {
  if (!isRecord(value)) return false;
  if (!isTime(value.at) || !isGoalKey(value.goalKey)) return false;
  switch (value.kind) {
    case 'step-started':
      return (
        hasExactly(value, STARTED_KEYS) &&
        isPackId(value.id) &&
        typeof value.id === 'string' &&
        EVENT_ID.test(value.id) &&
        isGoalTask(value.task)
      );
    case 'used-outside': {
      if (!hasExactly(value, USED_KEYS) || typeof value.id !== 'string') return false;
      return value.id.startsWith('u.') && isPackId(value.id.slice(2));
    }
    default:
      return false;
  }
}

/** The id a `used-outside` row carries for one step. */
export function usedOutsideId(stepId: string): string {
  return `u.${stepId}`;
}

// ──────────────────────────────────────────────────────────────────── merge

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The row with its keys in the fixed order, so a rebuilt row is the same bytes. */
function ordered(row: GoalStepEvent): GoalStepEvent {
  return row.kind === 'step-started'
    ? { kind: row.kind, id: row.id, at: row.at, goalKey: row.goalKey, task: row.task }
    : { kind: row.kind, id: row.id, at: row.at, goalKey: row.goalKey };
}

/** Whole-row union, total order, newest sixty. A function of the union alone. */
function bound(rows: readonly unknown[]): GoalStepEvent[] {
  const held = new Map<string, GoalStepEvent>();
  for (const row of rows) {
    if (!isGoalStepEvent(row)) continue;
    const clean = ordered(row);
    held.set(stableStringify(clean), clean);
  }
  return [...held.entries()]
    .sort(
      ([rx, x], [ry, y]) =>
        x.at - y.at || compareText(x.kind, y.kind) || compareText(x.id, y.id) || compareText(rx, ry),
    )
    .map(([, row]) => row)
    .slice(-MAX_GOAL_STEPS);
}

function stepsOf(side: unknown): unknown[] {
  return isRecord(side) && Array.isArray(side.steps) ? (side.steps as unknown[]) : [];
}

/** The sync policy's merge: two stored blobs, either possibly absent or corrupt. */
export function mergeGoalSteps(local: unknown, remote: unknown): StoredGoalSteps {
  return { version: GOAL_STEPS_VERSION, steps: bound([...stepsOf(local), ...stepsOf(remote)]) };
}

/** Add rows to a stored record, under the same bound. */
export function withGoalSteps(stored: StoredGoalSteps, added: readonly GoalStepEvent[]): StoredGoalSteps {
  return { version: GOAL_STEPS_VERSION, steps: bound([...stored.steps, ...added]) };
}

/** A stored blob this build can read, or null. A newer version is not readable here. */
export function readGoalSteps(value: unknown): StoredGoalSteps | null {
  if (!isRecord(value) || value.version !== GOAL_STEPS_VERSION || !Array.isArray(value.steps)) return null;
  return { version: GOAL_STEPS_VERSION, steps: bound(value.steps) };
}

/**
 * One row per `(kind, id)`, oldest first: the reader view. Where two differing
 * copies exist (never produced by this app), the canonical max is shown, so
 * every device shows the same one.
 */
export function uniqueGoalSteps(rows: readonly GoalStepEvent[]): GoalStepEvent[] {
  const held = new Map<string, GoalStepEvent>();
  for (const row of rows) {
    const key = `${row.kind}\u0000${row.id}`;
    const seen = held.get(key);
    held.set(key, seen === undefined || compareText(stableStringify(row), stableStringify(seen)) > 0 ? row : seen);
  }
  return rows.filter((row) => held.get(`${row.kind}\u0000${row.id}`) === row);
}
