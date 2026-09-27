/**
 * The one unfinished practice sitting on this phone, and the frozen plan that
 * finishes it. Device-local (`practiceSession`, excluded from sync with a
 * written reason), account-scoped, serialised, acknowledged.
 *
 * What it holds is identifiers and settled facts only: the sitting id and
 * start, which exercises remain and in what order (the silent twin's id when
 * the sitting went quiet, so resume keeps the same exercise and position), the
 * answered records core produced (id, phrase key, outcome, attempts), miss
 * counts, the resolved targets, and whether the sitting followed the warm-up.
 * No French is copied from an exercise, and nothing the learner typed or said.
 *
 * It is also the durable half of completion's at-most-once rule. A completion
 * first freezes its plan here (see `completion.ts`); while a plan is pending,
 * nothing else can be saved over it, a resume is not offered, and a replay reads
 * the same plan back. `completed` keeps the last few finished sitting ids, so a
 * late duplicate call is answered `already-completed` rather than run again.
 *
 * Account binding: every call binds the key and the scope generation when it is
 * made, and a write is refused if the account changed or was reset since, so a
 * mid-await sign-out or deletion can neither redirect nor resurrect a record.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isDue,
  suppressMic,
  type AnsweredExercise,
  type DrillExercise,
  type DrillSessionState,
  type PracticeTarget,
  type ReviewCard,
} from '@luvani/core';

import type { PersistAck } from '../storage/ack.ts';
import { cleanActiveMs } from '../progress/activeTime.ts';
import { scopeGeneration, userKey } from '../storage/scope.ts';
import type { PlannedPracticeGrade } from '../review/store.ts';
import { isEventId, isPracticeEvent, mintPracticeId, type SessionCompletedEvent } from './history.ts';

export const PRACTICE_SESSION_VERSION = 1;

/** Bounds on a record this store will hold. A sitting is six targets; these are generous. */
export const MAX_QUEUE_IDS = 40;
export const MAX_ANSWERED = 80;
/**
 * Finished sitting ids kept on this device. Backed by the retained history,
 * which completion also consults; together they refuse a replay until a sitting
 * is both 200 sittings old here and aged out of the 150-event history.
 */
export const MAX_COMPLETED_RECEIPTS = 200;

export type PracticeOrigin = 'recommended' | 'pack' | 'review';

export interface PracticeSessionRecord {
  sittingId: string;
  startedAt: number;
  origin: PracticeOrigin;
  packId: string | null;
  /** The sitting followed the recognition warm-up, which showed the French. */
  exposed: boolean;
  micSuppressed: boolean;
  /** Exercise ids where help or a reveal was used. Their outcome is never 'recalled'. */
  assisted: string[];
  targets: PracticeTarget[];
  /** Remaining exercise ids, head first. Silent twin ids when the sitting went quiet. */
  queue: string[];
  answered: AnsweredExercise[];
  missesById: Record<string, number>;
  /**
   * Active learning milliseconds credited so far (Phase 1B). Absent on records
   * saved before it existed; a resume then starts from zero, and never credits
   * the gap between leaving and coming back.
   */
  activeMs?: number;
}

/** Everything completion needs to finish a sitting, frozen before any write it guards. */
export interface CompletionPlan {
  sittingId: string;
  /** The completion instant. Grades are applied at it; the history event carries it. */
  at: number;
  grades: PlannedPracticeGrade[];
  xp: number;
  /** The activity log stamp claimed for this sitting, unique on disk for `(drill, xp)`. */
  activityAt: number;
  durationMs: number | null;
  /**
   * Active learning milliseconds (Phase 1B), or null when not measured.
   * Optional because plans frozen by an older build have no such field, and
   * those must still replay; they credit no active time.
   */
  activeMs?: number | null;
  event: SessionCompletedEvent;
}

interface StoredDoc {
  version: typeof PRACTICE_SESSION_VERSION;
  session: PracticeSessionRecord | null;
  completion: CompletionPlan | null;
  completed: string[];
}

const KEY = () => userKey('practiceSession');

let chain: Promise<unknown> = Promise.resolve();

export interface Bound {
  key: string;
  generation: number;
}

function bind(): Bound {
  return { key: KEY(), generation: scopeGeneration() };
}

function serialized<T>(bound: Bound, mutation: (bound: Bound) => Promise<T>): Promise<T> {
  const run = () => mutation(bound);
  const next = chain.then(run, run);
  chain = next.catch(() => {});
  return next;
}

// ─────────────────────────────────────────────────────────────── validation

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A measured duration this store will hold: finite and at or above zero. */
function isMeasure(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isText(value: unknown, max = 200): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function isTarget(value: unknown): value is PracticeTarget {
  if (!isRecord(value)) return false;
  const source = value.source;
  const sourceOk =
    isRecord(source) &&
    (source.kind === 'review' || (source.kind === 'pack' && isText(source.packId, 100)));
  return isText(value.phraseKey, 2000) && isText(value.exerciseId) && typeof value.scheduled === 'boolean' && sourceOk;
}

function isAnswered(value: unknown): value is AnsweredExercise {
  if (!isRecord(value)) return false;
  return (
    isText(value.id) &&
    isText(value.phraseKey, 2000) &&
    (value.outcome === 'good' || value.outcome === 'typo' || value.outcome === 'unresolved') &&
    typeof value.attempts === 'number' &&
    Number.isInteger(value.attempts) &&
    value.attempts >= 1 &&
    (value.transfer === undefined || value.transfer === true)
  );
}

function isMisses(value: unknown): value is Record<string, number> {
  return (
    isRecord(value) &&
    Object.values(value).every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 20)
  );
}

export function isSessionRecord(value: unknown): value is PracticeSessionRecord {
  if (!isRecord(value)) return false;
  return (
    isEventId(value.sittingId) &&
    isTime(value.startedAt) &&
    (value.origin === 'recommended' || value.origin === 'pack' || value.origin === 'review') &&
    (value.packId === null || isText(value.packId, 100)) &&
    typeof value.exposed === 'boolean' &&
    typeof value.micSuppressed === 'boolean' &&
    Array.isArray(value.assisted) &&
    value.assisted.length <= MAX_ANSWERED &&
    value.assisted.every((id) => isText(id)) &&
    Array.isArray(value.targets) &&
    value.targets.length <= 12 &&
    value.targets.every(isTarget) &&
    Array.isArray(value.queue) &&
    value.queue.length <= MAX_QUEUE_IDS &&
    value.queue.every((id) => isText(id)) &&
    Array.isArray(value.answered) &&
    value.answered.length <= MAX_ANSWERED &&
    value.answered.every(isAnswered) &&
    isMisses(value.missesById) &&
    (value.activeMs === undefined || isMeasure(value.activeMs))
  );
}

function isPlannedGrade(value: unknown): value is PlannedPracticeGrade {
  if (!isRecord(value)) return false;
  return (
    isText(value.id, 2000) &&
    (value.grade === 'again' || value.grade === 'good' || value.grade === 'easy') &&
    (value.transfer === undefined || value.transfer === true) &&
    (value.before === null || typeof value.before === 'string') &&
    (value.after === null || typeof value.after === 'string')
  );
}

function isPlan(value: unknown): value is CompletionPlan {
  if (!isRecord(value)) return false;
  return (
    isEventId(value.sittingId) &&
    isTime(value.at) &&
    Array.isArray(value.grades) &&
    value.grades.every(isPlannedGrade) &&
    typeof value.xp === 'number' &&
    Number.isFinite(value.xp) &&
    value.xp >= 0 &&
    isTime(value.activityAt) &&
    (value.durationMs === null || isMeasure(value.durationMs)) &&
    (value.activeMs === undefined || value.activeMs === null || isMeasure(value.activeMs)) &&
    isPracticeEvent(value.event) &&
    value.event.kind === 'session-completed' &&
    value.event.id === value.sittingId
  );
}

const EMPTY: StoredDoc = { version: PRACTICE_SESSION_VERSION, session: null, completion: null, completed: [] };

/**
 * The doc on disk. 'unreadable' when the platform refused the read, which is
 * different from a corrupt or old blob (read as empty: nothing to resume).
 * A pending plan that fails validation is also 'unreadable', never silently
 * dropped, because dropping it would let the same sitting complete twice.
 */
async function readDoc(key: string): Promise<StoredDoc | 'unreadable'> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch {
    return 'unreadable';
  }
  if (!raw) return { ...EMPTY };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ...EMPTY };
  }
  if (!isRecord(parsed) || parsed.version !== PRACTICE_SESSION_VERSION) return { ...EMPTY };
  if (parsed.completion !== null && parsed.completion !== undefined && !isPlan(parsed.completion)) return 'unreadable';
  const completed = Array.isArray(parsed.completed) ? parsed.completed.filter(isEventId).slice(-MAX_COMPLETED_RECEIPTS) : [];
  return {
    version: PRACTICE_SESSION_VERSION,
    session: isSessionRecord(parsed.session) ? parsed.session : null,
    completion: isPlan(parsed.completion) ? parsed.completion : null,
    completed,
  };
}

async function writeDoc(bound: Bound, doc: StoredDoc): Promise<PersistAck> {
  if (scopeGeneration() !== bound.generation) return 'failed';
  try {
    await AsyncStorage.setItem(bound.key, JSON.stringify(doc));
    return 'durable';
  } catch {
    return 'failed';
  }
}

// ─────────────────────────────────────────────────────────────── public API

/** A stable sitting id. Mint once when the sitting starts; never re-mint on resume. */
export function mintSittingId(now: number): string {
  return mintPracticeId(now, 's');
}

export interface SavePracticeSessionInput {
  sittingId: string;
  startedAt: number;
  origin: PracticeOrigin;
  packId: string | null;
  exposed: boolean;
  micSuppressed: boolean;
  targets: readonly PracticeTarget[];
  state: DrillSessionState;
  assisted?: readonly string[];
  /** Active learning milliseconds so far, from the screen's clock. A malformed value is dropped. */
  activeMs?: number;
}

/** The record this store would hold for a live sitting. Pure; ids and settled facts only. */
export function toSessionRecord(input: SavePracticeSessionInput): PracticeSessionRecord {
  const activeMs = cleanActiveMs(input.activeMs);
  return {
    ...(activeMs === undefined ? {} : { activeMs }),
    sittingId: input.sittingId,
    startedAt: input.startedAt,
    origin: input.origin,
    packId: input.packId,
    exposed: input.exposed,
    micSuppressed: input.micSuppressed,
    assisted: [...new Set(input.assisted ?? [])],
    targets: input.targets.map((t) => ({
      phraseKey: t.phraseKey,
      source: t.source.kind === 'pack' ? { kind: 'pack', packId: t.source.packId } : { kind: 'review' },
      exerciseId: t.exerciseId,
      scheduled: t.scheduled,
    })),
    queue: input.state.queue.map((e) => e.id),
    answered: input.state.answered.map((a) => ({
      id: a.id,
      phraseKey: a.phraseKey,
      outcome: a.outcome,
      attempts: a.attempts,
      ...(a.transfer === true ? { transfer: true } : {}),
    })),
    missesById: { ...input.state.missesById },
  };
}

/**
 * Save the unfinished sitting. Call after each settled answer and on Leave.
 * Saves no grade and no XP. `failed` when the record is invalid, the disk
 * refused, the account changed, this sitting already completed, or any
 * completion is still pending (recover it first).
 */
export function savePracticeSession(input: SavePracticeSessionInput): Promise<PersistAck> {
  const record = toSessionRecord(input);
  if (!isSessionRecord(record)) return Promise.resolve('failed');
  return serialized(bind(), async (bound) => {
    const doc = await readDoc(bound.key);
    if (doc === 'unreadable') return 'failed';
    if (doc.completion !== null) return 'failed';
    if (doc.completed.includes(record.sittingId)) return 'failed';
    return writeDoc(bound, { ...doc, session: record });
  });
}

/** The unfinished sitting to offer for resume, or null. Null while a completion is pending. */
export function loadPracticeSession(): Promise<PracticeSessionRecord | null> {
  return serialized(bind(), async (bound) => {
    const doc = await readDoc(bound.key);
    if (doc === 'unreadable' || doc.completion !== null) return null;
    return doc.session;
  });
}

/**
 * Abandon a sitting. `durable` when it is gone or was never this one. `failed`
 * while a completion is pending, because that record is the only thing stopping
 * a double award.
 */
export function clearPracticeSession(sittingId: string): Promise<PersistAck> {
  return serialized(bind(), async (bound) => {
    const doc = await readDoc(bound.key);
    if (doc === 'unreadable' || doc.completion !== null) return 'failed';
    if (doc.session === null || doc.session.sittingId !== sittingId) return 'durable';
    return writeDoc(bound, { ...doc, session: null });
  });
}

export interface RestoredPracticeSession {
  state: DrillSessionState;
  targets: PracticeTarget[];
  /** Exercise ids the bank no longer has. Dropped from the queue, never counted done. */
  missing: string[];
}

/** An exercise by id, including a repeat-this's silent twin. */
function findExercise(bank: readonly DrillExercise[], id: string): DrillExercise | null {
  for (const exercise of bank) {
    if (exercise.id === id) return exercise;
    if (exercise.kind === 'repeat-this' && exercise.noMicTwin.id === id) return exercise.noMicTwin;
  }
  return null;
}

/**
 * Rebuild a live sitting from its record. Pure.
 *
 * Queue order and exercise identity are kept exactly, twin ids included, and a
 * sitting that went quiet stays quiet. An id the bank no longer has is dropped
 * and reported. A target is only still `scheduled` if its card is still due,
 * so a card graded elsewhere since cannot be graded as a spaced return twice.
 * Null when nothing is left to play and nothing was answered: that sitting
 * cannot honestly resume, and the caller should say so and clear it.
 */
export function restorePracticeSession(
  record: PracticeSessionRecord,
  bank: readonly DrillExercise[],
  deck: readonly ReviewCard[],
  now: number,
): RestoredPracticeSession | null {
  const queue: DrillExercise[] = [];
  const missing: string[] = [];
  for (const id of record.queue) {
    const exercise = findExercise(bank, id);
    if (exercise === null || !record.targets.some((t) => t.phraseKey === exercise.phraseKey)) missing.push(id);
    else queue.push(exercise);
  }
  if (queue.length === 0 && record.answered.length === 0) return null;
  const targets = record.targets.map((t) => {
    const card = deck.find((c) => c.id === t.phraseKey);
    return { ...t, scheduled: t.scheduled && card !== undefined && isDue(card, now) };
  });
  let state: DrillSessionState = {
    queue,
    missesById: { ...record.missesById },
    answered: record.answered.map((a) => ({ ...a })),
    startedAt: record.startedAt,
    finished: queue.length === 0,
  };
  if (record.micSuppressed) state = suppressMic(state);
  return { state, targets, missing };
}

// ───────────────────────────────────────────── completion's durable half (internal)

/** Bind now, for a caller that must use the same account across several steps. */
export function bindPracticeScope(): Bound {
  return bind();
}

export type PlanSlot =
  | { kind: 'completed' }
  | { kind: 'pending'; plan: CompletionPlan }
  | { kind: 'other-pending'; plan: CompletionPlan }
  | { kind: 'free' }
  | { kind: 'unreadable' };

/** What the store holds for this sitting's completion. */
export function readCompletionSlot(bound: Bound, sittingId: string | null): Promise<PlanSlot> {
  return serialized(bound, async () => {
    const doc = await readDoc(bound.key);
    if (doc === 'unreadable') return { kind: 'unreadable' };
    if (sittingId !== null && doc.completed.includes(sittingId)) return { kind: 'completed' };
    if (doc.completion !== null) {
      return sittingId === null || doc.completion.sittingId === sittingId
        ? { kind: 'pending', plan: doc.completion }
        : { kind: 'other-pending', plan: doc.completion };
    }
    return { kind: 'free' };
  });
}

/**
 * Freeze a plan, and answer the plan that is now held, or null.
 *
 * The same sitting already pending answers the HELD plan, never the caller's,
 * so a racing second completion replays the first one's stamps and grades.
 * Refused (null) when another sitting's plan is pending, this sitting already
 * completed, the disk refused, or the account moved. The session record is
 * kept until settle, so nothing about the sitting is lost if the rest fails.
 */
export function freezeCompletionPlan(bound: Bound, plan: CompletionPlan): Promise<CompletionPlan | null> {
  if (!isPlan(plan)) return Promise.resolve(null);
  return serialized(bound, async () => {
    const doc = await readDoc(bound.key);
    if (doc === 'unreadable') return null;
    if (doc.completed.includes(plan.sittingId)) return null;
    if (doc.completion !== null) return doc.completion.sittingId === plan.sittingId ? doc.completion : null;
    return (await writeDoc(bound, { ...doc, completion: plan })) === 'durable' ? plan : null;
  });
}

/** Every destination said durable: drop the plan and the sitting, keep a receipt. */
export function settleCompletionPlan(bound: Bound, sittingId: string): Promise<PersistAck> {
  return serialized(bound, async () => {
    const doc = await readDoc(bound.key);
    if (doc === 'unreadable') return 'failed';
    if (doc.completed.includes(sittingId) && doc.completion?.sittingId !== sittingId) return 'durable';
    const completed = [...doc.completed.filter((id) => id !== sittingId), sittingId].slice(-MAX_COMPLETED_RECEIPTS);
    return writeDoc(bound, {
      version: PRACTICE_SESSION_VERSION,
      session: doc.session?.sittingId === sittingId ? null : doc.session,
      completion: doc.completion?.sittingId === sittingId ? null : doc.completion,
      completed,
    });
  });
}
