/**
 * The plan, said in words (F541).
 *
 * `/billing/status` answers seconds, and PRODUCT.md refuses a countdown: a
 * falling number is a scarcity mechanic, and the learner most likely to be
 * looking is the one with the least left. So the seconds never reach a screen.
 * This folds them into one of three bands and hands the card sentences, and
 * the test holds that no digit can come out of it, whatever goes in.
 *
 * The same rule covers the period. "Renews on the 12th" is a date a learner can
 * read as a deadline, so the period is said as a distance in words, and the
 * trial, which does not renew, is said as what it is: a welcome, once.
 *
 * Nothing here decides whether a session may start. `canStart` is core's
 * answer, carried through untouched, and the band `none` is drawn from it
 * rather than from a second reading of the seconds.
 */

import { PLANS, STORE_TRIAL_DAYS, storeTrialSeconds } from '@luvani/core';

import type { BillingStatus } from './billingStatus.ts';

export type PlanBand = 'plenty' | 'a-little' | 'none';

export type PlanStatusView =
  | {
      known: true;
      /** The plan's name, in the words a learner reads: Free minutes, Starter, Max. */
      planLabel: string;
      /** The period, as a distance in words. Never a date. */
      periodLine: string;
      band: PlanBand;
      bandLine: string;
      canStart: boolean;
    }
  | { known: false; line: string };

/** Below a quarter of the allowance, the card says so. Above it, nothing is counted. */
const A_LITTLE_SHARE = 0.25;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The free minutes every account starts with are "Free minutes", never "Free
 * trial" (come alive, README Part 5.G): a free trial is the store's own offer
 * now, and it reads as the plan it is a trial of.
 */
export const PLAN_LABELS = {
  trial: 'Free minutes',
  starter: PLANS.starter.label,
  regular: PLANS.regular.label,
} as const;

export const PERIOD_LINES = {
  trial: 'Your free minutes, once.',
  lapsed: 'Your paid plan has ended.',
  renewingNow: 'Renewing about now.',
  renewsThisWeek: 'Renews within the week.',
  renewsLater: 'Renews in the coming weeks.',
  monthly: 'Renews monthly.',
} as const;

export const BAND_LINES = {
  plenty: 'Plenty of speaking time left.',
  aLittle: 'A little speaking time left.',
  exhausted: 'No speaking time left for now.',
  insufficient: 'Not quite enough speaking time for a whole conversation.',
  lapsed: 'No speaking time until a plan is chosen.',
} as const;

export const PLAN_UNKNOWN = 'Luvani could not check your plan just now.';

/** Every sentence this module can say, for the guilt and em dash sweeps. */
export const PLAN_STATUS_COPY: readonly string[] = [
  ...Object.values(PLAN_LABELS),
  ...Object.values(PERIOD_LINES),
  ...Object.values(BAND_LINES),
  PLAN_UNKNOWN,
];

function periodLineFor(status: BillingStatus, now: number): string {
  if (status.lapsed) return PERIOD_LINES.lapsed;
  if (status.plan === 'trial') return PERIOD_LINES.trial;
  if (status.periodEnd === null) return PERIOD_LINES.monthly;
  const left = new Date(status.periodEnd).getTime() - now;
  if (!Number.isFinite(left)) return PERIOD_LINES.monthly;
  if (left <= 0) return PERIOD_LINES.renewingNow;
  if (left <= 7 * DAY_MS) return PERIOD_LINES.renewsThisWeek;
  return PERIOD_LINES.renewsLater;
}

/**
 * Whether a paid period ends within a store trial's week of `now`.
 *
 * A day of slack on top of the week (7 October 2026, P4-C review): the phone's
 * clock is not the store's, and a phone a minute slow on a trial's first day
 * read the trial's end as a little more than a week away, so a fresh trial was
 * measured against the month again. The wall's success page asks the same
 * question with the same slack (`wall/wallSuccess.ts`), so the two never
 * disagree about which periods are a week long.
 */
export function endsWithinATrialWeek(periodEnd: string | null, now: number): boolean {
  if (periodEnd === null) return false;
  const left = new Date(periodEnd).getTime() - now;
  return Number.isFinite(left) && left > 0 && left <= (STORE_TRIAL_DAYS + 1) * DAY_MS;
}

/**
 * What "a little" is measured against: the period's allowance, or in a paid
 * period's last week a week of the plan.
 *
 * A store free trial is a week of the plan (allowance x 7/30, F742), and the
 * server reports it as the plan itself with the trial's end as its period end,
 * so measured against the month it read "A little speaking time left" from its
 * first minute. The last week of any paid period is the same case: a week is
 * all the time left to use the minutes in, so a week of the plan is the
 * measure. Before that, the month is.
 */
function measureFor(status: BillingStatus, now: number): number {
  if (status.allowanceSeconds !== undefined) return status.allowanceSeconds;
  const month = PLANS[status.plan].secondsPerPeriod;
  if (status.plan === 'trial' || !endsWithinATrialWeek(status.periodEnd, now)) return month;
  return Math.min(month, storeTrialSeconds(status.plan));
}

function bandFor(status: BillingStatus, now: number): { band: PlanBand; line: string } {
  if (!status.canStart) {
    if (status.reason === 'subscription-lapsed') return { band: 'none', line: BAND_LINES.lapsed };
    if (status.reason === 'insufficient-for-session') return { band: 'none', line: BAND_LINES.insufficient };
    return { band: 'none', line: BAND_LINES.exhausted };
  }
  const allowance = measureFor(status, now);
  if (status.secondsRemaining < allowance * A_LITTLE_SHARE) return { band: 'a-little', line: BAND_LINES.aLittle };
  return { band: 'plenty', line: BAND_LINES.plenty };
}

export function planStatusFor(status: BillingStatus | null, now: number): PlanStatusView {
  if (status === null) return { known: false, line: PLAN_UNKNOWN };
  const { band, line } = bandFor(status, now);
  return {
    known: true,
    planLabel: PLAN_LABELS[status.plan],
    periodLine: periodLineFor(status, now),
    band,
    bandLine: line,
    canStart: status.canStart,
  };
}
