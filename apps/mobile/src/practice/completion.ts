/**
 * Finishing a practice sitting: grades, XP and history, each at most once, with
 * nothing claimed that did not reach the disk.
 *
 * The existing seams have no idempotency of their own. `gradeCards` applies
 * whatever it is handed and swallows a failed write; `recordActivity` appends.
 * So this file does not rely on either. It uses a durable plan instead:
 *
 * 1. **Freeze.** Compute everything from the answered work, once: the grades
 *    (core's `practiceGrades`, with every target treated as unscheduled after the
 *    warm-up), per-card fingerprints read off the durable deck, the XP (core's
 *    `drillXp`), an activity stamp no identical entry already holds, and the
 *    history event with a fixed completion time. Write that plan into the local
 *    `practiceSession` record. If that write fails, nothing has been applied and
 *    the answer is `failed`.
 * 2. **Apply.** Grades through `applyPracticeGrades` (compare-and-set on the
 *    fingerprint: a card already graded by an earlier try is left alone, a card
 *    moved for another reason is skipped and reported, never forced), activity
 *    through `recordActivityOnce` at the frozen stamp, the event through
 *    `recordPracticeEvent` (idempotent on the sitting id). All three are tried
 *    even after one fails, as `bankPractice` does.
 * 3. **Settle.** Only when all three say `durable`: drop the plan and the
 *    sitting and keep a small receipt of the sitting id.
 *
 * A crash or a refused write anywhere in 2 or 3 leaves the plan on disk. The
 * next `completePracticeSitting` for the same id, or `recoverPracticeCompletion`
 * at launch, replays the SAME plan, and every step is a no-op where it already
 * landed. That is the whole duplicate-safety argument, and it holds only on
 * this device: the plan is local, so an uninstall between freeze and settle
 * loses what had not landed yet (see docs/STATE_AND_STORAGE.md).
 *
 * Every step checks the account it was bound to. A sign-out or a data reset
 * between steps stops the run with `account-changed`; the stores refuse a write
 * whose scope moved, so nothing lands in another account or after a deletion.
 *
 * The game layer settles the sitting here, at the one place that knows a plan
 * has completed, whoever ran it: the screen's finish, its retry, or the
 * recovery Practice, the next-task card and the drill screen run at launch
 * (Come alive F744, review finding 9). The settle's snapshot is taken before
 * the plan's first write in this launch and kept across a `kept` answer, so a
 * retry is measured against the learner's state before the sitting rather than
 * after half of it landed; it settles only on `completed`, never on
 * `already-completed`, and always at the plan's frozen instant, so a retry
 * after midnight cannot make a second practice day.
 */

import {
  drillXp,
  practiceGrades,
  practiceOutcomeOf,
  summariseDrill,
  type DrillExercise,
  type DrillSessionState,
  type PracticeOutcome,
  type PracticeTarget,
} from '@luvani/core';

import { beginSettle, finishSettle, releaseSettle, type SettleToken } from '../game/settle.ts';
import { claimActivityInstant, recordActivityOnce } from '../progress/activity.ts';
import { cleanActiveMs } from '../progress/activeTime.ts';
import { applyPracticeGrades, planPracticeGrades, type CardGrade } from '../review/store.ts';
import { onUserScopeReset, scopeGeneration } from '../storage/scope.ts';
import { MAX_ATTEMPTS, isPracticeEvent, type PracticeEventTarget, type SessionCompletedEvent } from './history.ts';
import { hasRecordedSitting, recordPracticeEventOutcome } from './historyStore.ts';
import {
  bindPracticeScope,
  freezeCompletionPlan,
  readCompletionSlot,
  settleCompletionPlan,
  type Bound,
  type CompletionPlan,
} from './sessionStore.ts';

export type PracticeCompletionStatus =
  | 'completed'
  | 'already-completed'
  | 'kept'
  | 'failed'
  | 'nothing-to-save'
  | 'account-changed';

export type PracticeCompletionStep = 'grades' | 'activity' | 'history' | 'cleanup';

export interface PracticeCompletionResult {
  status: PracticeCompletionStatus;
  sittingId: string;
  outcomes: PracticeEventTarget[];
  xp: number;
  grades: {
    /** Graded by this call or found already graded by an earlier try of this sitting. */
    applied: string[];
    /** Not graded: the card moved for another reason or is gone. Reported, never forced. */
    skipped: string[];
  };
  /** Steps still to land. Non-empty only for `kept` and `account-changed`. */
  pending: PracticeCompletionStep[];
  /**
   * What happened to the history row, for a status that ran the plan.
   * `recorded`: on disk. `aged-out`: the sitting is older than everything the
   * bounded history keeps, so there is no row and My French will not show it;
   * grades and XP still landed. `pending`: not yet. `unknown`: this call did
   * not run the plan (already completed elsewhere, failed, nothing to save).
   */
  history: 'recorded' | 'aged-out' | 'pending' | 'unknown';
  /**
   * The instant this call settled the sitting into the game layer at (the
   * plan's frozen activity instant), when it completed the plan; null when it
   * settled nothing. A page that shows the sitting's end card waits for the
   * settle pipeline's delta for exactly this sitting (`practice/sittingDelta.ts`),
   * because the settle runs on its own chain and its delta is not this answer.
   */
  settlesAt: number | null;
}

export interface CompletePracticeInput {
  sittingId: string;
  state: DrillSessionState;
  /** Resolved targets, from `buildPracticeSession` or `restorePracticeSession`. */
  targets: readonly PracticeTarget[];
  /** The exercises this sitting played, twins as played. Used only to read each outcome. */
  exercises: readonly DrillExercise[];
  /** The sitting followed the recognition warm-up. */
  exposed: boolean;
  /** Exercise ids where help or a reveal was used. */
  assisted?: readonly string[];
  /** Wall-clock milliseconds, open to finish. Legacy meaning, unchanged. */
  durationMs?: number;
  /**
   * Active learning milliseconds from the screen's clock (Phase 1B). Frozen
   * into the plan with everything else, so a replay credits the first call's
   * value. Not clipped to `durationMs`: a wall clock that moved backwards must
   * not cost the learner a completion or the time they really worked.
   */
  activeMs?: number;
  now: number;
}

function result(
  status: PracticeCompletionStatus,
  sittingId: string,
  extra: Partial<Omit<PracticeCompletionResult, 'status' | 'sittingId'>> = {},
): PracticeCompletionResult {
  return { status, sittingId, outcomes: [], xp: 0, grades: { applied: [], skipped: [] }, pending: [], history: 'unknown', settlesAt: null, ...extra };
}

/**
 * What each played target honestly showed, in target order. Pure.
 *
 * One row per target the sitting actually answered; a target never reached is
 * left out, not counted. `unresolved` wins over anything else for the phrase.
 * `recalled` is core's claim and only core's (`practiceOutcomeOf`), and it is
 * downgraded to `practised` after the warm-up or when help was used. An answer
 * whose exercise cannot be found is `practised` at most.
 */
export function practiceOutcomes(input: {
  state: DrillSessionState;
  targets: readonly PracticeTarget[];
  exercises: readonly DrillExercise[];
  exposed: boolean;
  assisted?: readonly string[];
}): PracticeEventTarget[] {
  const assisted = new Set(input.assisted ?? []);
  const out: PracticeEventTarget[] = [];
  const seen = new Set<string>();
  for (const target of input.targets) {
    if (seen.has(target.phraseKey)) continue;
    seen.add(target.phraseKey);
    const answers = input.state.answered.filter((a) => a.phraseKey === target.phraseKey);
    if (answers.length === 0) continue;
    let outcome: PracticeOutcome = 'recalled';
    for (const answer of answers) {
      const exercise = input.exercises.find((e) => e.id === answer.id);
      let one: PracticeOutcome = answer.outcome === 'unresolved' ? 'unresolved' : exercise ? practiceOutcomeOf(answer, exercise) : 'practised';
      if (one === 'recalled' && (input.exposed || assisted.has(answer.id))) one = 'practised';
      if (one === 'unresolved') outcome = 'unresolved';
      else if (one === 'practised' && outcome === 'recalled') outcome = 'practised';
    }
    const attempts = Math.min(MAX_ATTEMPTS, answers.reduce((sum, a) => sum + Math.max(1, a.attempts), 0));
    if (outcome === 'recalled' && attempts !== 1) outcome = 'practised';
    out.push({
      phraseKey: target.phraseKey,
      source: target.source.kind === 'pack' ? { kind: 'pack', packId: target.source.packId } : { kind: 'review' },
      outcome,
      attempts,
    });
  }
  return out;
}

/**
 * The grades a sitting owes, as the review store takes them.
 *
 * A target is a spaced return only if the learner met it cold. After the
 * warm-up every target is early rehearsal, and so is any target whose played
 * exercise (twin ids included, read off the answered records) had help or a
 * reveal: a success there moves no schedule and carries no transfer mark, and
 * a miss is still core's 'again'.
 */
export function practiceCardGrades(
  state: DrillSessionState,
  targets: readonly PracticeTarget[],
  exposed: boolean,
  assisted: readonly string[] = [],
): CardGrade[] {
  const helped = new Set(assisted);
  const helpedPhrases = new Set(state.answered.filter((a) => helped.has(a.id)).map((a) => a.phraseKey));
  const effective = targets.map((t) => (exposed || helpedPhrases.has(t.phraseKey) ? { ...t, scheduled: false } : t));
  return practiceGrades(state, effective).map(({ phraseKey, grade, transfer, assisted: retried }) => ({
    id: phraseKey,
    grade,
    ...(transfer === true ? { transfer: true } : {}),
    ...(retried === true ? { assisted: true } : {}),
  }));
}

/**
 * One completion at a time on this device. Two calls for the same sitting (a
 * double tap, a recover racing a finish) then see each other's frozen plan
 * instead of both computing one.
 */
let completionChain: Promise<unknown> = Promise.resolve();

function oneAtATime<T>(work: () => Promise<T>): Promise<T> {
  const next = completionChain.then(work, work);
  completionChain = next.catch(() => {});
  return next;
}

function moved(bound: Bound): boolean {
  return scopeGeneration() !== bound.generation;
}

/** Replay a frozen plan. Each step is a no-op where it already landed. */
async function runPlan(bound: Bound, plan: CompletionPlan, status: 'completed' | 'already-completed'): Promise<PracticeCompletionResult> {
  const base = { outcomes: plan.event.targets, xp: plan.xp };
  const pending: PracticeCompletionStep[] = [];
  const changed = () =>
    result('account-changed', plan.sittingId, { ...base, pending: ['grades', 'activity', 'history', 'cleanup'] });

  if (moved(bound)) return changed();
  const grades = await applyPracticeGrades(plan.grades, plan.at);
  if (grades.ack !== 'durable') pending.push('grades');

  if (moved(bound)) return changed();
  const activity = await recordActivityOnce(
    'drill',
    plan.xp,
    plan.activityAt,
    {
      ...(plan.durationMs === null ? {} : { durationMs: plan.durationMs }),
      // Absent on a plan an older build froze: that sitting credits no active time.
      ...(plan.activeMs === undefined || plan.activeMs === null ? {} : { activeMs: plan.activeMs }),
      // A plan is frozen only for a finished sitting with answered work, so a
      // practice that earned no XP still records its day (D3, F731, F744).
      finished: true,
    },
  );
  if (activity !== 'durable') pending.push('activity');

  if (moved(bound)) return changed();
  // An aged-out event is settled, not pending: retrying cannot make the bounded
  // history keep it, and holding the plan would block every later sitting.
  const history = await recordPracticeEventOutcome(plan.event);
  if (history === 'failed') pending.push('history');
  const historyState = history === 'failed' ? 'pending' : history === 'aged-out' ? 'aged-out' : 'recorded';

  const gradeReport = { applied: [...grades.applied, ...grades.alreadyApplied], skipped: grades.skipped };
  if (pending.length > 0) {
    return result('kept', plan.sittingId, { ...base, grades: gradeReport, history: historyState, pending: [...pending, 'cleanup'] });
  }

  if (moved(bound)) return changed();
  const settled = await settleCompletionPlan(bound, plan.sittingId);
  if (settled !== 'durable') return result('kept', plan.sittingId, { ...base, grades: gradeReport, history: historyState, pending: ['cleanup'] });
  return result(status, plan.sittingId, { ...base, grades: gradeReport, history: historyState });
}

/**
 * The game layer's snapshot for a sitting whose plan answered `kept`, held
 * until a later run of the same plan in this launch completes it. Only this
 * launch: after a restart the recovery takes a fresh one, which can only
 * under-report a sitting, never count it twice.
 */
const heldSettles = new Map<string, SettleToken>();
onUserScopeReset(() => {
  for (const token of heldSettles.values()) releaseSettle(token);
  heldSettles.clear();
});

/**
 * Run a frozen plan and settle the sitting into the game layer once it has
 * completed. The snapshot comes before the plan writes anything (or is the one
 * a `kept` run of this plan already took); the settle itself runs on the game
 * layer's own chain afterwards and never holds this answer back.
 */
async function runAndSettle(bound: Bound, plan: CompletionPlan): Promise<PracticeCompletionResult> {
  let token = heldSettles.get(plan.sittingId);
  heldSettles.delete(plan.sittingId);
  if (token !== undefined && token.scope !== bound.generation) {
    releaseSettle(token);
    token = undefined;
  }
  token ??= await beginSettle();
  let done: PracticeCompletionResult;
  try {
    done = await runPlan(bound, plan, 'completed');
  } catch (error) {
    releaseSettle(token);
    throw error;
  }
  if (done.status === 'completed') {
    void finishSettle(token, {
      source: 'drill',
      at: plan.activityAt,
      xpEarned: plan.xp,
      ...(plan.activeMs === undefined || plan.activeMs === null ? {} : { activeMs: plan.activeMs }),
    });
  } else if (done.status === 'kept') {
    heldSettles.set(plan.sittingId, token);
  } else {
    releaseSettle(token);
  }
  return done.status === 'completed' ? { ...done, settlesAt: plan.activityAt } : done;
}

/**
 * Finish a practice sitting. Resolves only after every write it reports has
 * been acknowledged. Safe to call again with the same sitting id: a pending
 * plan is replayed, never recomputed, and a settled sitting answers
 * `already-completed`.
 *
 * Only a finished sitting (empty queue) with answered work completes. An
 * unfinished one answers `failed` and writes nothing; save it with
 * `savePracticeSession` instead. A finished one with nothing answered answers
 * `nothing-to-save` and writes nothing. Do not also call `gradeCards` or
 * `recordActivity` for a practice sitting.
 */
export function completePracticeSitting(input: CompletePracticeInput): Promise<PracticeCompletionResult> {
  return oneAtATime(() => completeNow(input));
}

async function completeNow(input: CompletePracticeInput): Promise<PracticeCompletionResult> {
  const bound = bindPracticeScope();
  const slot = await readCompletionSlot(bound, input.sittingId);
  if (slot.kind === 'unreadable') return result(moved(bound) ? 'account-changed' : 'failed', input.sittingId);
  if (slot.kind === 'completed') return result('already-completed', input.sittingId);
  if (slot.kind === 'pending') return runAndSettle(bound, slot.plan);
  if (slot.kind === 'other-pending') {
    // Another sitting's plan must land first: two plans at once would let two
    // activity stamps be claimed against the same disk state.
    const other = await runAndSettle(bound, slot.plan);
    if (other.status !== 'completed') return result('failed', input.sittingId);
  }

  // The receipt ring is bounded, so the retained history is asked too. A
  // history that cannot be read cannot prove the sitting is new: refuse.
  const recorded = await hasRecordedSitting(input.sittingId);
  if (recorded === null) return result(moved(bound) ? 'account-changed' : 'failed', input.sittingId);
  if (recorded) return result('already-completed', input.sittingId);
  if (moved(bound)) return result('account-changed', input.sittingId);

  // Only a finished sitting completes. A Leave mid-sitting saves the resume
  // record and nothing else: no grade, no XP, no history.
  if (!input.state.finished || input.state.queue.length > 0) return result('failed', input.sittingId);
  const outcomes = practiceOutcomes(input);
  if (outcomes.length === 0) return result('nothing-to-save', input.sittingId);
  const packs = new Set(outcomes.flatMap((o) => (o.source.kind === 'pack' ? [o.source.packId] : [])));
  const event: SessionCompletedEvent = {
    kind: 'session-completed',
    id: input.sittingId,
    at: Math.floor(input.now),
    packId: packs.size === 1 ? [...packs][0]! : null,
    targets: outcomes,
  };
  if (!isPracticeEvent(event)) return result('failed', input.sittingId, { outcomes });

  const summary = summariseDrill(input.state);
  const xp = drillXp({ clean: summary.resolved - summary.typos, typoCorrected: summary.typos });

  if (moved(bound)) return result('account-changed', input.sittingId, { outcomes, xp });
  const grades = await planPracticeGrades(practiceCardGrades(input.state, input.targets, input.exposed, input.assisted), event.at);
  if (grades === null) return result(moved(bound) ? 'account-changed' : 'failed', input.sittingId, { outcomes, xp });

  if (moved(bound)) return result('account-changed', input.sittingId, { outcomes, xp });
  const activityAt = xp > 0 ? await claimActivityInstant('drill', xp, event.at) : event.at;
  if (activityAt === null) return result(moved(bound) ? 'account-changed' : 'failed', input.sittingId, { outcomes, xp });

  const plan: CompletionPlan = {
    sittingId: input.sittingId,
    at: event.at,
    grades,
    xp,
    activityAt,
    durationMs:
      input.durationMs !== undefined && Number.isFinite(input.durationMs) && input.durationMs >= 0 ? input.durationMs : null,
    activeMs: cleanActiveMs(input.activeMs) ?? null,
    event,
  };
  if (moved(bound)) return result('account-changed', input.sittingId, { outcomes, xp });
  const frozen = await freezeCompletionPlan(bound, plan);
  if (frozen === null) return result('failed', input.sittingId, { outcomes, xp });
  // Whatever is held on disk is the plan, even if a racing call froze first.
  return runAndSettle(bound, frozen);
}

/**
 * Finish whatever completion a previous launch left pending, or null when
 * there is none. Call once after the account scope resolves, and on Practice
 * focus; it is cheap when there is nothing to do.
 */
export function recoverPracticeCompletion(): Promise<PracticeCompletionResult | null> {
  return oneAtATime(async () => {
    const bound = bindPracticeScope();
    const slot = await readCompletionSlot(bound, null);
    if (slot.kind !== 'pending') return null;
    return runAndSettle(bound, slot.plan);
  });
}
