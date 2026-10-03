import { PLANS, lapsedEntitlement, type Entitlement } from '@luvani/core';

export type BillingSnapshot =
  | { kind: 'active'; plan: 'starter' | 'regular'; periodEnd: Date }
  | { kind: 'inactive' }
  | { kind: 'unknown-product' };
export type BillingProjection =
  | { kind: 'active' | 'lapsed'; entitlement: Entitlement }
  | { kind: 'unchanged'; reason: 'unknown-product' | 'not-paid' | 'superseded'; entitlement: Entitlement };

/** Millisecond formatting differences never refill the same paid period. */
export function applyBillingSnapshot(current: Entitlement, snapshot: BillingSnapshot): BillingProjection {
  if (snapshot.kind === 'unknown-product') return { kind: 'unchanged', reason: 'unknown-product', entitlement: current };
  if (snapshot.kind === 'inactive') return current.plan === 'trial'
    ? { kind: 'unchanged', reason: 'not-paid', entitlement: current }
    : { kind: 'lapsed', entitlement: lapsedEntitlement() };
  const end = new Date(Math.floor(snapshot.periodEnd.getTime() / 1000) * 1000);
  const before = current.periodEnd?.getTime();
  if (current.plan !== 'trial' && before !== undefined && end.getTime() < Math.floor(before / 1000) * 1000) {
    return { kind: 'unchanged', reason: 'superseded', entitlement: current };
  }
  const renewed = before === undefined || Math.floor(end.getTime() / 1000) > Math.floor(before / 1000);
  return { kind: 'active', entitlement: { plan: snapshot.plan, periodEnd: end,
    secondsUsed: renewed ? 0 : Math.min(current.secondsUsed, PLANS[snapshot.plan].secondsPerPeriod), lapsed: false } };
}
