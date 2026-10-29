import type { Plan, PlanSpec } from '@luvani/core';

import type { BillingStatus } from '../purchases/billingStatus.ts';
import { dayAndMonthOf, PLAN_LABELS, refillTime } from '../purchases/planStatus.ts';
import { freshMinutesLine, outOfTimeWords, PERIOD_LINES } from '../purchases/outOfTime.ts';
import {
  ACCOUNT_NONE_LEFT,
  ACCOUNT_UNDER_A_MINUTE,
  minutesLeft,
  freeRefill,
  trialAllowance,
} from './wallCopy.ts';
import { CONVERSATION_MINUTES, wallTrial } from './wallPlans.ts';

/**
 * What the plans page says about the account in hand (2026-09-27, notebook
 * Phase 6-E).
 *
 * The redesign asks for minutes left and the day they start fresh, beside the
 * plans, where somebody deciding whether to buy can see what they already have.
 * It reads the server's `/billing/status` answer, the same read the Settings
 * card makes, so nothing here is a phone-side guess.
 *
 * Settings still draws the plan in bands and never a number (F541, held by
 * `planStatus.test.ts`), and this does not change that card. This is the one
 * surface where the number is the point: a learner choosing a plan is owed the
 * size of what they already hold. It is a still line read once when the page
 * opens, never a ticking count, and every count in it is rounded down.
 *
 * Nothing here decides anything about money. It reads a status and says it.
 */

export interface WallAccount {
  /** The plan's name as Settings says it: Free, Core, Max. */
  title: string;
  lines: readonly string[];
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * An instant as a day and a month on this phone's calendar, or null.
 *
 * Spelled here rather than through `Intl`, because the wall's copy is British
 * English whatever the phone's locale is, and a date in another language in the
 * middle of an English sentence reads as a bug. The day is the learner's local
 * one, which is the day they will notice the minutes back.
 */
export function dayAndMonth(iso: string): string | null {
  return dayAndMonthOf(iso);
}

function leftLine(secondsRemaining: number): string {
  if (secondsRemaining <= 0) return ACCOUNT_NONE_LEFT;
  const minutes = Math.floor(secondsRemaining / 60);
  if (minutes < 1) return ACCOUNT_UNDER_A_MINUTE;
  return minutesLeft(minutes, Math.floor(secondsRemaining / (CONVERSATION_MINUTES * 60)));
}

/** Out of time, in the words every screen uses (F911): the refill, then offline. Digits only as handed in. */
function outOfTimeLines(status: BillingStatus, now: number): string[] {
  const words = outOfTimeWords({ plan: status.plan, reason: status.reason, refillsAt: status.periodEnd, now });
  return [...(words.lead === null ? [] : [words.lead]), words.refill, words.offline];
}

export function wallAccount(
  status: BillingStatus | null,
  catalogue: Record<Plan, PlanSpec> | null,
  now: number,
): WallAccount | null {
  if (status === null) return null;

  // The free plan, a lapsed plan included (REV-001: it falls back to the free
  // conversation): its size, what is left, and when it comes back.
  if (status.plan === 'trial') {
    const trial = wallTrial(catalogue);
    const lines = trial === null ? [] : [trialAllowance(trial.minutes, trial.conversations)];
    if (!status.canStart) return { title: PLAN_LABELS.trial, lines: [...lines, ...outOfTimeLines(status, now)] };
    const day = status.periodEnd === null ? null : refillTime(status.periodEnd);
    return { title: PLAN_LABELS.trial, lines: [...lines, leftLine(status.secondsRemaining), ...(day === null ? [] : [freeRefill(day)])] };
  }

  // A paid plan that has ended with no free row behind it: nothing to report,
  // and the page says nothing rather than something it cannot stand behind.
  if (status.lapsed) return null;

  if (!status.canStart) return { title: PLAN_LABELS[status.plan], lines: outOfTimeLines(status, now) };
  const lines = [leftLine(status.secondsRemaining)];
  if (status.periodEnd !== null) {
    const end = new Date(status.periodEnd).getTime();
    const date = dayAndMonth(status.periodEnd);
    // F911: the same words as Subscription and the band, from one formatter.
    if (Number.isFinite(end) && end <= now) lines.push(PERIOD_LINES.freshSoon);
    else if (date !== null) lines.push(freshMinutesLine(date));
  }
  return { title: PLAN_LABELS[status.plan], lines };
}
