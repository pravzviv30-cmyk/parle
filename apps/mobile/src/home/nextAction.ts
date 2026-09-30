/**
 * Which one colour card Today leads with (F438, F602).
 *
 * Home leads with exactly one card, and the screen does not choose it: this
 * does. Three answers, in this order.
 *
 * 1. `plans`, when the free trial's minutes are used. Revamp B draws this as
 *    the sun card on Home (HomeOutOfMinutes), read through the same billing
 *    call Speak makes. Only the trial's `exhausted` state leads with it: a paid
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

import type { HomeMission } from './homeMission.ts';

/** The one lead Home draws. */
export type HomeAction = 'plans' | 'review' | 'conversation';

/** The part of the billing status this rule reads. `BillingStatus` fits it. */
export interface HomeBilling {
  plan: Plan;
  reason: StartRefusal | null;
}

export function homeActionFor(hero: Pick<HomeMission, 'kind'>, dueCount: number, billing: HomeBilling | null): HomeAction {
  if (billing?.plan === 'trial' && billing.reason === 'exhausted') return 'plans';
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
  title: `Your ${PLANS.trial.secondsPerPeriod / 60} free minutes are used.`,
  body: 'Practice and review still work offline. When you want more conversations, a plan adds speaking time every month.',
  keeps: 'Your phrases, recaps and progress stay yours.',
  action: 'See the plans',
} as const;

/** The white review row's title: how many phrases are ready, in words that count nothing else. */
export function dueLine(n: number): string {
  return n === 1 ? 'One phrase ready to recall' : `${n} phrases ready to recall`;
}
