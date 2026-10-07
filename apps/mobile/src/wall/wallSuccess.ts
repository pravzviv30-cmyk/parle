import type { Plan, PlanSpec } from '@luvani/core';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { endsWithinATrialWeek } from '../purchases/planStatus.ts';
import { dayAndMonth } from './wallAccount.ts';
import { SUCCESS_MONTH, SUCCESS_TRIAL, heldUntil } from './wallCopy.ts';
import { conversationsAWeek, storeTrialMinutes } from './wallPlans.ts';

/**
 * What the success page names. The minutes are the catalogue's month unless
 * one of the two markers says otherwise:
 *
 * - `trial`: a store free trial this wall just bought. `minutes` is the
 *   server's own week and there is no weekly count.
 * - `until`: a grant the client cannot tell from a trial (a restore, or a
 *   purchase confirmed after the wall was reopened). `minutes` is what the
 *   server holds, said with the day it runs to and no period at all.
 */
export interface WallSuccess {
  name: string;
  minutes: number;
  perWeek: number | null;
  trial?: true;
  /** The day and month the held minutes run to, already spelled. */
  until?: string;
}

/**
 * A refreshed server grant, never the selected card, names the bought allowance.
 *
 * The server grants a store trial a week of the plan (F742) and reports it as
 * the plan itself, and `/billing/status` says nothing that tells a trial from
 * a month. So the server's own grant decides, never the client's guess: a
 * grant holding no more than a trial's week is never said as the catalogue's
 * month.
 *
 * - After a purchase this wall made of a product carrying a free trial
 *   (`boughtTrial`, whatever the store said about eligibility, because the
 *   store applies the trial it has), such a grant is the trial: the server's
 *   minutes, "during the free trial".
 * - Any other grant that small whose period ends within a trial's week (a
 *   restore during a trial, a trial purchase confirmed after the app was
 *   reopened) is said as the minutes held and the day they run to, which is
 *   true of a trial and of a month's last week alike.
 *
 * A grant holding more is a paid period, whatever the store was expected to
 * apply, and is said as the month it is.
 */
export function wallSuccess(
  status: BillingStatus | null,
  catalogue: Record<Plan, PlanSpec> | null,
  boughtTrial = false,
  now: number = Date.now(),
): WallSuccess | null {
  if (status === null || catalogue === null || status.plan === 'trial' || status.lapsed || !status.canStart) return null;
  const spec = catalogue[status.plan];
  if (!spec || !Number.isFinite(spec.secondsPerPeriod) || spec.secondsPerPeriod <= 0) return null;
  const week = storeTrialMinutes(catalogue, status.plan);
  const held = Math.floor(status.secondsRemaining / 60);
  if (week !== null && held <= week) {
    if (boughtTrial) return { name: spec.label, minutes: held, perWeek: null, trial: true };
    const until = status.periodEnd !== null && endsWithinATrialWeek(status.periodEnd, now) ? dayAndMonth(status.periodEnd) : null;
    if (until !== null) return { name: spec.label, minutes: held, perWeek: null, until };
  }
  const minutes = Math.floor(spec.secondsPerPeriod / 60);
  return { name: spec.label, minutes, perWeek: conversationsAWeek(minutes, spec.periodDays) };
}

/** The line under the success page's minutes: the trial's, the held minutes' day, or the month's. */
export function successLine(success: WallSuccess): string {
  if (success.trial) return SUCCESS_TRIAL;
  if (success.until !== undefined) return heldUntil(success.until);
  return SUCCESS_MONTH;
}

/**
 * The plans page pill while it answers the purchase it started (README Part
 * 5.G): `busy` while the store, and then the server, answer; `done`, the check,
 * only once the server has confirmed the entitlement the success page names,
 * after a purchase the store accepted. A restore never gets the check, and a
 * cancel or a failure is `idle` again: the words come back, nothing shakes.
 */
export function purchasePill(input: {
  /** The pill started a purchase it is still answering. */
  closing: boolean;
  /** The store's sheet, or the settling after it, is still in flight. */
  busy: boolean;
  /** The store action ended in a grant (the wall's WALL_READY). */
  granted: boolean;
  /** The store accepted a purchase this wall made, not a restore. */
  purchaseAccepted: boolean;
  /** The server is still being asked for the granted allowance. */
  grantReadPending: boolean;
  /** What the success page would name, from the confirmed grant, or null. */
  success: WallSuccess | null;
}): 'idle' | 'busy' | 'done' {
  if (!input.closing) return 'idle';
  if (input.granted && input.purchaseAccepted && input.success !== null) return 'done';
  if (input.busy || (input.granted && input.grantReadPending)) return 'busy';
  return 'idle';
}
