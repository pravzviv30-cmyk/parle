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
  PLANS,
  canStartSession,
  refillTaste,
  secondsRemaining,
  type Entitlement,
  type Plan,
  type StartRefusal,
} from '@luvani/core';

export interface BillingStatus {
  plan: Plan;
  allowanceSeconds?: number;
  /** Seconds left in the period. A fact, never a countdown: the app says it in words. */
  secondsRemaining: number;
  /**
   * The instant the current allowance period ends, when the minutes start
   * fresh. For a yearly product that is the current 30-day window, not the
   * paid year (F733). For the free plan it is when the free conversation refills, 44 hours after
   * the window's first debit (REV-001): null until the first minute of a window is spent, because the
   * window starts at first use. The wire meaning is the same for every plan:
   * every caller reads it as when the minutes come back ("comes back on Thursday at 4:10 pm").
   */
  periodEnd: string | null;
  /** The free plan stands where a paid period used to (D24, REV-001: a free conversation that refills, not an exhausted trial). */
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

export function billingStatusFor(stored: Entitlement, now: Date | number = Date.now()): BillingStatus {
  // A taste whose window has passed reads as refilled even before the store
  // writes the refill back, so the status and the next start agree.
  const entitlement = refillTaste(stored, now);
  const decision = canStartSession(entitlement, MIN_VIABLE_SESSION_SEC);
  return {
    plan: entitlement.plan,
    secondsRemaining: secondsRemaining(entitlement),
    ...(entitlement.withheldSeconds ? { allowanceSeconds: PLANS[entitlement.plan].secondsPerPeriod - entitlement.withheldSeconds } : {}),
    periodEnd: periodEndOf(entitlement.windowEnd ?? entitlement.periodEnd),
    lapsed: entitlement.lapsed === true,
    canStart: decision.allowed,
    reason: decision.allowed ? null : decision.reason,
  };
}
