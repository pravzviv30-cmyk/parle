import type { Plan, PlanSpec } from '@luvani/core';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { conversationsAWeek, storeTrialMinutes } from './wallPlans.ts';

/**
 * What the success page names. `trial` is present only for a store free
 * trial: then `minutes` is the server's own week and there is no weekly count.
 */
export interface WallSuccess {
  name: string;
  minutes: number;
  perWeek: number | null;
  trial?: true;
}

/**
 * A refreshed server grant, never the selected card, names the bought allowance.
 *
 * `trial` says this wall just bought a product with a free trial the store
 * called this account eligible for. The server grants a trial a week of the
 * plan (F742), so a grant that holds no more than that week is said as the
 * server's own minutes for the trial, never the catalogue's month. A grant
 * holding more is a paid period, whatever the store was expected to apply, and
 * is said as the month it is.
 */
export function wallSuccess(status: BillingStatus | null, catalogue: Record<Plan, PlanSpec> | null, trial = false): WallSuccess | null {
  if (status === null || catalogue === null || status.plan === 'trial' || status.lapsed || !status.canStart) return null;
  const spec = catalogue[status.plan];
  if (!spec || !Number.isFinite(spec.secondsPerPeriod) || spec.secondsPerPeriod <= 0) return null;
  const week = trial ? storeTrialMinutes(catalogue, status.plan) : null;
  const held = Math.floor(status.secondsRemaining / 60);
  if (week !== null && held <= week) return { name: spec.label, minutes: held, perWeek: null, trial: true };
  const minutes = Math.floor(spec.secondsPerPeriod / 60);
  return { name: spec.label, minutes, perWeek: conversationsAWeek(minutes, spec.periodDays) };
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
