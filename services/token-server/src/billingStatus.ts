/**
 * What the learner holds, read and never changed (F540).
 *
 * The meter is server-side. Until now the app could learn its own plan only as
 * the answer to `/billing/refresh`, which exists to project subscriber state and
 * cannot be asked without RevenueCat configured, so F377 kept every balance row
 * off Profile: a number the phone cannot verify is the dead switch F239 refused.
 * This is the read F377 said it was waiting for.
 *
 * It answers from the entitlement store alone. No vendor is asked, no minutes
 * move, no trial is claimed. The seconds travel as a fact for the app to fold
 * into words (`purchases/planStatus.ts`); nothing here decides what a learner is
 * shown, and the decision about whether a session may start is core's
 * `canStartSession`, called here exactly as the grant calls it, so the status
 * and the start can never disagree about the same row.
 */

import {
  MIN_VIABLE_SESSION_SEC,
  canStartSession,
  secondsRemaining,
  type Entitlement,
  type Plan,
  type StartRefusal,
} from '@luvani/core';

export interface BillingStatus {
  plan: Plan;
  /** Seconds left in the period. A fact, never a countdown: the app says it in words. */
  secondsRemaining: number;
  /**
   * The instant the current allowance period ends, when the minutes start
   * fresh, or null for the non-renewing trial. For a yearly product that is
   * the current 30-day window, not the paid year (F733); the wire meaning is
   * unchanged, because every caller reads it as when the minutes come back.
   */
  periodEnd: string | null;
  /** The exhausted trial that stands where a paid period used to. */
  lapsed: boolean;
  /** Core's own answer to "may a session start right now". */
  canStart: boolean;
  reason: StartRefusal | null;
}

/**
 * The period end as an instant, or null.
 *
 * The store hands back a `Date`; a row read straight from the wire may carry a
 * string. Either is answered as an ISO instant, and an unparseable value reads
 * as no period rather than as a throw, because a status that cannot be read is
 * worse than a status with one field missing.
 */
function periodEndOf(value: unknown): string | null {
  const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null;
  if (date === null || !Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

export function billingStatusFor(entitlement: Entitlement): BillingStatus {
  const decision = canStartSession(entitlement, MIN_VIABLE_SESSION_SEC);
  return {
    plan: entitlement.plan,
    secondsRemaining: secondsRemaining(entitlement),
    periodEnd: periodEndOf(entitlement.windowEnd ?? entitlement.periodEnd),
    lapsed: entitlement.lapsed === true,
    canStart: decision.allowed,
    reason: decision.allowed ? null : decision.reason,
  };
}
