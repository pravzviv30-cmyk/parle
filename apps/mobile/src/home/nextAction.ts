/**
 * Which one colour card Today leads with (F438, F602).
 *
 * Home leads with exactly one card, and the screen does not choose it: this
 * does. Three answers, in this order.
 *
 * 1. `plans`, when the free plan's conversation is used (REV-001). Revamp B draws this as
 *    the sun card on Home (HomeOutOfMinutes), read through the same billing
 *    call Speak makes. A trial without enough time to start leads with it: a paid
 *    plan out of minutes, or a lapsed subscription, is F607's with revenue. An
 *    unknown plan (`billing` null: signed out, offline, or a read that failed)
 *    never leads with plans, because a purchase surface that guesses is the
 *    failure F265 was.
 * 2. `review`, when the hero is the day's scene and phrases are due. Recall
 *    can only stand in for the day's scene, never for the next one on the
 *    spine (2026-09-27, notebook Phase 3).
 * 3. `conversation`, the next scene.
 */

import { PLANS, type Plan, type StartRefusal } from '@luvani/core';

import { freeBackLine, refillTime } from '../purchases/planStatus.ts';
import type { HomeMission } from './homeMission.ts';

/** The one lead Home draws. */
export type HomeAction = 'plans' | 'review' | 'conversation' | 'local';

/** The part of the billing status this rule reads. `BillingStatus` fits it. */
export interface HomeBilling {
  plan: Plan;
  reason: StartRefusal | null;
  /** On the free plan, when the free conversation comes back (REV-001); null before first use. */
  periodEnd?: string | null;
}

export function homeActionFor(hero: Pick<HomeMission, 'kind'>, dueCount: number, billing: HomeBilling | null, live = true): HomeAction {
  if (!live) return dueCount > 0 ? 'review' : 'local';
  if (billing?.plan === 'trial' && (billing.reason === 'exhausted' || billing.reason === 'insufficient-for-session')) return 'plans';
  return hero.kind === 'today' && dueCount > 0 ? 'review' : 'conversation';
}

/**
 * The sun card's words (HomeOutOfMinutes).
 *
 * The minutes are read off the trial's own allowance, so the card cannot say
 * thirty on the day the trial becomes something else. It says what still works
 * before it says what a plan adds, and it says what the learner keeps: running
 * out of speaking time takes nothing they made away from them.
 */
export const PLANS_LEAD = {
  title: `Ready for more speaking time?`,
  body: 'Practice and review still work offline. When you want more conversations, a plan adds speaking time every month.',
  keeps: 'Your phrases, recaps and progress stay yours.',
  action: 'See the plans',
} as const;

/**
 * The sun card's body for this learner: on the free plan with a refill time,
 * it says when the free conversation comes back first (REV-001). A day and a
 * time, never a countdown.
 */
export function plansLeadBody(billing: HomeBilling | null): string {
  const when = billing?.plan === 'trial' && billing.periodEnd ? refillTime(billing.periodEnd) : null;
  return when === null ? PLANS_LEAD.body : `${freeBackLine(when)} ${PLANS_LEAD.body}`;
}

/** The white review row's title: how many phrases are ready, in words that count nothing else. */
export function dueLine(n: number): string {
  return n === 1 ? 'One phrase ready to recall' : `${n} phrases ready to recall`;
}
