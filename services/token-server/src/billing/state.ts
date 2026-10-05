import { PLANS, lapsedEntitlement, type Entitlement } from '@luvani/core';

/**
 * What the vendor says a learner holds, reduced to what the meter needs.
 *
 * `periodEnd` is the end of the allowance window being granted, which for a
 * monthly product is the store period itself, for a store trial is the trial's
 * end, and for a yearly product is the end of the current 30-day window inside
 * the paid year (core's `allowanceWindowEnd`). `grantSeconds` is what that
 * window grants: the plan's whole allowance, or a store trial's week of it
 * (D16, 2026-10-05). It never exceeds the plan's allowance.
 */
export type BillingSnapshot =
  | { kind: 'active'; plan: 'starter' | 'regular'; periodEnd: Date; grantSeconds: number }
  | { kind: 'inactive' }
  | { kind: 'unknown-product' };
export type BillingProjection =
  | { kind: 'active' | 'lapsed'; entitlement: Entitlement }
  | { kind: 'unchanged'; reason: 'unknown-product' | 'not-paid' | 'superseded'; entitlement: Entitlement };

/**
 * The part of a plan's allowance a window does not grant.
 *
 * A store trial grants a week of the plan, and the rest of the allowance is
 * recorded as already spent. That is deliberate: every debit, reservation,
 * refusal, refund and lapse rule, here and in the database, reads
 * `allowance - secondsUsed`, so withholding seconds this way caps the trial
 * through the code that already enforces every other cap, and no second
 * allowance column can disagree with the first. A grant that is not a whole
 * number of seconds inside the allowance is refused rather than rounded into
 * minutes nobody paid for.
 */
export function withheldSeconds(plan: 'starter' | 'regular', grantSeconds: number): number {
  const allowance = PLANS[plan].secondsPerPeriod;
  if (!Number.isInteger(grantSeconds) || grantSeconds < 1 || grantSeconds > allowance) {
    throw new RangeError('a billing grant must be whole seconds within the plan allowance');
  }
  return allowance - grantSeconds;
}

/** Millisecond formatting differences never refill the same paid period. */
export function applyBillingSnapshot(current: Entitlement, snapshot: BillingSnapshot): BillingProjection {
  if (snapshot.kind === 'unknown-product') return { kind: 'unchanged', reason: 'unknown-product', entitlement: current };
  if (snapshot.kind === 'inactive') return current.plan === 'trial'
    ? { kind: 'unchanged', reason: 'not-paid', entitlement: current }
    : { kind: 'lapsed', entitlement: lapsedEntitlement() };
  const withheld = withheldSeconds(snapshot.plan, snapshot.grantSeconds);
  const end = new Date(Math.floor(snapshot.periodEnd.getTime() / 1000) * 1000);
  const before = current.periodEnd?.getTime();
  if (current.plan !== 'trial' && before !== undefined && end.getTime() < Math.floor(before / 1000) * 1000) {
    return { kind: 'unchanged', reason: 'superseded', entitlement: current };
  }
  const renewed = before === undefined || Math.floor(end.getTime() / 1000) > Math.floor(before / 1000);
  const allowance = PLANS[snapshot.plan].secondsPerPeriod;
  return { kind: 'active', entitlement: { plan: snapshot.plan, periodEnd: end,
    secondsUsed: renewed ? withheld : Math.min(allowance, Math.max(current.secondsUsed, withheld)), lapsed: false } };
}
