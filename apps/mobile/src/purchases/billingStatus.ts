/**
 * The learner's own plan, as the server answers it (F540).
 *
 * Pure on purpose. `client.ts` does the fetch and reaches the auth adapter,
 * which a Node test cannot load; this file reads a body and nothing else, so
 * the validation can be asked questions directly. Every field is checked and a
 * body that fails any of them reads as `null`, the same shape `refreshBilling`
 * settled on: a purchase surface that guesses is the failure F265 was.
 *
 * The seconds arrive as a fact and leave this module untouched. Nothing here
 * turns them into words. The plan card's fold is `planStatus.ts`'s, and it
 * speaks in bands. The one exception (2026-09-27, F541) is the wall, where a
 * learner deciding what to buy is owed the size of what is left:
 * `wall/wallAccount.ts` says it once, rounded down, and it never ticks.
 */

import type { Plan, StartRefusal } from '@luvani/core';

export interface BillingStatus {
  plan: Plan;
  secondsRemaining: number;
  /** An ISO instant, or null for the non-renewing trial. */
  periodEnd: string | null;
  lapsed: boolean;
  canStart: boolean;
  reason: StartRefusal | null;
}

/** The plan ids the server is allowed to answer with. Anything else is a wire fault. */
const PLAN_IDS: readonly string[] = ['trial', 'starter', 'regular'];

/** The refusals core names. A fourth reason is a build newer than this one, and reads as null. */
const REFUSALS: readonly string[] = ['exhausted', 'insufficient-for-session', 'subscription-lapsed'];

export function billingStatusIn(body: unknown): BillingStatus | null {
  if (typeof body !== 'object' || body === null) return null;
  const { plan, secondsRemaining, periodEnd, lapsed, canStart, reason } = body as Record<string, unknown>;
  if (typeof plan !== 'string' || !PLAN_IDS.includes(plan)) return null;
  if (typeof secondsRemaining !== 'number' || !Number.isFinite(secondsRemaining) || secondsRemaining < 0) return null;
  if (periodEnd !== null && (typeof periodEnd !== 'string' || !Number.isFinite(new Date(periodEnd).getTime()))) return null;
  if (typeof lapsed !== 'boolean' || typeof canStart !== 'boolean') return null;
  if (reason !== null && (typeof reason !== 'string' || !REFUSALS.includes(reason))) return null;
  if (canStart && reason !== null) return null;
  if (!canStart && reason === null) return null;
  return {
    plan: plan as Plan,
    secondsRemaining,
    periodEnd: periodEnd as string | null,
    lapsed,
    canStart,
    reason: reason as StartRefusal | null,
  };
}
