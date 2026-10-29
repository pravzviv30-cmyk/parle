/**
 * The plan, said in words (F541).
 *
 * `/billing/status` answers seconds, and PRODUCT.md refuses a countdown: a
 * falling number is a scarcity mechanic, and the learner most likely to be
 * looking is the one with the least left. So the seconds never reach a screen.
 * This folds them into one of three bands and hands the card sentences, and
 * the test holds that no digit can come out of it, whatever goes in.
 *
 * The period used to follow the same rule, as a distance in words. Founder
 * decision 9 (F909, 2026-10-29) reversed that for paid plans: a subscriber told
 * to cancel 24 hours before renewal needs the date. So a paid plan says when its
 * minutes are fresh ("Fresh minutes on 27 November", the server's window), and
 * `renewalLines` says the store's own renewal date and price apart from it. A
 * date is printed only when it was handed in; nothing here invents one.
 *
 * One exception, by founder decision REV-001 (2026-10-23, replacing D24): the
 * free plan is one ten-minute conversation, back 44 hours after the window's
 * first use, and its band says the whole minutes left and when they come back
 * ("4 free minutes left, refills on Thursday at 4:10 pm"). A few whole minutes and
 * a day are a size and a time, not a ticking number. Founder decision 21
 * (F935, 2026-10-29) gives a paid plan the same honesty: its band says the
 * pool, "412 of 600 minutes left.", beside "Fresh minutes on 27 November.".
 *
 * Nothing here decides whether a session may start. `canStart` is core's
 * answer, carried through untouched, and the band `none` is drawn from it
 * rather than from a second reading of the seconds.
 */

import { PLANS, refillWhen, STORE_TRIAL_DAYS, storeTrialSeconds } from '@luvani/core';

import type { BillingStatus } from './billingStatus.ts';
import { dayAndMonthOf, endsOutOfTime, freshMinutesLine, outOfTimeWords, PERIOD_LINES, type OutOfTimeWords } from './outOfTime.ts';

// Said in `outOfTime.ts`, a leaf, so the two never import each other (F911).
export { dayAndMonthOf, freeBackLine, freshMinutesLine, PERIOD_LINES } from './outOfTime.ts';
import type { StoreHeldPlan, StoreOffering, StoreProduct } from './contract.ts';

export type PlanBand = 'plenty' | 'a-little' | 'none';

export type PlanStatusView =
  | {
      known: true;
      /** The plan's name, in the words a learner reads: Free, Core, Max. */
      planLabel: string;
      /** The period. On a paid plan, when the minutes are fresh (the server's window), never the billing date. */
      periodLine: string;
      band: PlanBand;
      bandLine: string;
      canStart: boolean;
      /** The shared out-of-time words when a session cannot start for lack of time (F911). */
      outOfTime?: OutOfTimeWords;
    }
  | { known: false; line: string };

/** Below a quarter of the allowance, the card says so. Above it, nothing is counted. */
const A_LITTLE_SHARE = 0.25;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The free plan is "Free" (D24, core's PLANS.trial.label), never "Free trial"
 * (come alive, README Part 5.G): a free trial is the store's own offer now, and
 * it reads as the plan it is a trial of.
 */
export const PLAN_LABELS = {
  trial: PLANS.trial.label,
  starter: PLANS.starter.label,
  regular: PLANS.regular.label,
} as const;

/** Where the renewal date lives when the store did not answer (F909). Never a guessed date. */
export const RENEWAL_POINTERS = {
  ios: 'Your renewal date is in your App Store subscriptions.',
  android: 'Your renewal date is in your Google Play subscriptions.',
  web: 'Your renewal date is in the App Store or Google Play, wherever you subscribed.',
} as const;

const PERIOD_WORDS: Record<StoreProduct['period'], { adverb: string; noun: string }> = {
  week: { adverb: 'weekly', noun: 'week' },
  month: { adverb: 'monthly', noun: 'month' },
  year: { adverb: 'yearly', noun: 'year' },
};

export type StorePlatform = 'ios' | 'android' | 'web';

/**
 * The renewal line, from the store's own answer (F909). `full` is the plan
 * screen's ("Core, yearly, £119.99. Renews on 27 November."; the
 * punctuation gate refuses the middot the founder's sketch used), `short` the plan
 * rows' ("Renews on 27 November."), null when there is no date to give.
 *
 * Only a product the store offered, for the tier the server says this account
 * holds, with an expiry and a renew answer, gets a date. Anything less is the
 * pointer to the store. Free, lapsed and unread plans have no renewal: null.
 */
export function renewalLines(status: BillingStatus | null, offering: StoreOffering | null, held: StoreHeldPlan | null, platform: StorePlatform): { full: string; short: string | null } | null {
  if (status === null || status.plan === 'trial' || status.lapsed) return null;
  const pointer = { full: RENEWAL_POINTERS[platform], short: null };
  if (held === null || offering === null || !offering.available) return pointer;
  const product = [...offering.products, ...(offering.yearly ?? []), ...(offering.weekly ?? [])]
    .find((candidate) => candidate.productId === held.productId);
  const date = held.expiresAt === null ? null : dayAndMonthOf(held.expiresAt);
  if (!product || product.plan !== status.plan || date === null || held.willRenew === null) return pointer;
  const words = PERIOD_WORDS[product.period];
  if (held.inTrial === true && held.willRenew) return { full: `Free until ${date}, then ${product.localizedPrice} a ${words.noun}.`, short: `Free until ${date}.` };
  const name = `${PLAN_LABELS[product.plan]}, ${words.adverb}, ${product.localizedPrice}.`;
  return held.willRenew
    ? { full: `${name} Renews on ${date}.`, short: `Renews on ${date}.` }
    : { full: `${name} Ends on ${date}.`, short: `Ends on ${date}.` };
}

export const BAND_LINES = {
  plenty: 'Plenty of speaking time left.',
  aLittle: 'A little speaking time left.',
  exhausted: 'No speaking time left for now.',
  insufficient: 'Not quite enough speaking time for a whole conversation.',
  lapsed: 'No speaking time until a plan is chosen.',
} as const;

export const PLAN_UNKNOWN = 'Luvani could not check your plan just now.';

/**
 * "on Thursday at 4:10 pm": when the free conversation comes back, as core says
 * it, in this phone's own time zone. Null for an instant that does not parse.
 */
export function refillTime(periodEnd: string): string | null {
  const at = new Date(periodEnd);
  return Number.isFinite(at.getTime()) ? refillWhen(at) : null;
}

/** The out-of-time paragraph for a status that cannot start (F911): one source for every screen. */
export function outOfTimeLine(status: BillingStatus, now: number): string {
  return outOfTimeWords({ plan: status.plan, reason: status.reason, refillsAt: status.periodEnd, now }).message;
}

/** The free plan's band (REV-001): whole minutes left, and when they come back. */
export function freeBandLine(status: BillingStatus, now: number = Date.now()): string {
  const when = status.periodEnd === null ? null : refillTime(status.periodEnd);
  const minutes = Math.floor(status.secondsRemaining / 60);
  if (!status.canStart || minutes <= 0) return outOfTimeLine(status, now);
  const size = `${minutes} free ${minutes === 1 ? 'minute' : 'minutes'} left`;
  return when === null ? size : `${size}, refills ${when}`;
}

/** The band and the period as one sentence, for a row with one subtitle. */
export function planSentence(bandLine: string, periodLine: string): string {
  // An out-of-time band already says when time comes back (F911); the period adds a second, softer answer.
  if (endsOutOfTime(bandLine)) return bandLine;
  return /[.!?]$/.test(bandLine) ? `${bandLine} ${periodLine}` : `${bandLine}. ${periodLine}`;
}

/** Every sentence this module can say, for the guilt and em dash sweeps. */
export const PLAN_STATUS_COPY: readonly string[] = [
  ...Object.values(PLAN_LABELS),
  ...Object.values(PERIOD_LINES),
  ...Object.values(RENEWAL_POINTERS),
  ...Object.values(BAND_LINES),
  PLAN_UNKNOWN,
];

function periodLineFor(status: BillingStatus, now: number): string {
  if (status.lapsed) return PERIOD_LINES.lapsed;
  if (status.plan === 'trial') return PERIOD_LINES.trial;
  if (status.periodEnd === null) return PERIOD_LINES.monthly;
  const left = new Date(status.periodEnd).getTime() - now;
  if (!Number.isFinite(left)) return PERIOD_LINES.monthly;
  if (left <= 0) return PERIOD_LINES.freshSoon;
  const date = dayAndMonthOf(status.periodEnd);
  return date === null ? PERIOD_LINES.monthly : freshMinutesLine(date);
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

/**
 * A paid plan's band (F935, founder decision 21): the 30-day pool with
 * numbers, "412 of 600 minutes left.", whole minutes and never a per-day
 * figure, because a plan is a pool. The pool is the server's allowance when it
 * gave one, else the plan's own minutes.
 */
export function paidPoolLine(status: BillingStatus): string {
  const pool = Math.max(0, Math.floor((status.allowanceSeconds ?? PLANS[status.plan].secondsPerPeriod) / 60));
  const left = Math.min(pool, Math.max(0, Math.floor(status.secondsRemaining / 60)));
  return `${left} of ${pool} minutes left.`;
}

function bandFor(status: BillingStatus, now: number): { band: PlanBand; line: string } {
  if (status.plan === 'trial') {
    const band: PlanBand = !status.canStart ? 'none' : status.secondsRemaining < measureFor(status, now) * A_LITTLE_SHARE ? 'a-little' : 'plenty';
    return { band, line: freeBandLine(status, now) };
  }
  if (!status.canStart) {
    if (status.reason === 'subscription-lapsed') return { band: 'none', line: BAND_LINES.lapsed };
    return { band: 'none', line: outOfTimeLine(status, now) };
  }
  const allowance = measureFor(status, now);
  const line = paidPoolLine(status);
  if (status.secondsRemaining < allowance * A_LITTLE_SHARE) return { band: 'a-little', line };
  return { band: 'plenty', line };
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
    ...(!status.canStart && !(status.plan !== 'trial' && status.lapsed)
      ? { outOfTime: outOfTimeWords({ plan: status.plan, reason: status.reason, refillsAt: status.periodEnd, now }) } : {}),
  };
}
