import type { Plan, PlanSpec } from '@luvani/core';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { conversationsAWeek } from './wallPlans.ts';

/** A refreshed server grant, never the selected card, names the bought allowance. */
export function wallSuccess(status: BillingStatus | null, catalogue: Record<Plan, PlanSpec> | null): { name: string; minutes: number; perWeek: number | null } | null {
  if (status === null || catalogue === null || status.plan === 'trial' || status.lapsed || !status.canStart) return null;
  const spec = catalogue[status.plan];
  if (!spec || !Number.isFinite(spec.secondsPerPeriod) || spec.secondsPerPeriod <= 0) return null;
  const minutes = Math.floor(spec.secondsPerPeriod / 60);
  return { name: spec.label, minutes, perWeek: conversationsAWeek(minutes, spec.periodDays) };
}
