/**
 * Home's plans-card words and the billing shape the lead rule reads (F438, F602).
 *
 * The lead itself is chosen by `practice/nextTask.ts` (`todayLead`, over
 * `nextTaskKind`): the plans card when a trial cannot start a session
 * (exhausted or insufficient, F651), the starter card, offline practice, else
 * the next scene. An unknown plan (`billing` null) never leads with plans,
 * because a purchase surface that guesses is the failure F265 was. The old
 * `homeActionFor` was never called in production and was deleted 2026-10-29.
 */

import { type Plan, type StartRefusal } from '@luvani/core';

import { outOfTimeWords } from '../purchases/outOfTime.ts';

/** The part of the billing status this rule reads. `BillingStatus` fits it. */
export interface HomeBilling {
  plan: Plan;
  reason: StartRefusal | null;
  /** On the free plan, when the free conversation comes back (REV-001); null before first use. */
  periodEnd?: string | null;
}

/**
 * The sun card's words (HomeOutOfMinutes).
 *
 * The minutes are read off the trial's own allowance, so the card cannot say
 * thirty on the day the trial becomes something else. It says what still works
 * before it says what a plan adds, and it says what the learner keeps: running
 * out of speaking time takes nothing they made away from them.
 */
/** What a plan adds, said after the out-of-time words on the free plan (F911). */
export const PLANS_LEAD_MORE = 'When you want more conversations, a plan adds speaking time every month.';

export const PLANS_LEAD = {
  title: `Ready for more speaking time?`,
  body: `Practice and review still work offline. ${PLANS_LEAD_MORE}`,
  keeps: 'Your phrases, recaps and progress stay yours.',
  action: 'See the plans',
} as const;

/**
 * The sun card's body for this learner: on the free plan it says the shared
 * out-of-time words first (F911, `purchases/outOfTime.ts`), with when the free
 * conversation comes back (REV-001). A day and a time, never a countdown.
 */
export function plansLeadBody(billing: HomeBilling | null, now: number = Date.now()): string {
  if (billing?.plan !== 'trial') return PLANS_LEAD.body;
  const words = outOfTimeWords({ plan: 'trial', reason: billing.reason, refillsAt: billing.periodEnd ?? null, now });
  return `${words.message} ${PLANS_LEAD_MORE}`;
}

/** The white review row's title: how many phrases are ready, in words that count nothing else. */
export function dueLine(n: number): string {
  return n === 1 ? 'One phrase ready to recall' : `${n} phrases ready to recall`;
}
