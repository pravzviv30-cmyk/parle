import { PLANS, lapsedEntitlement, type Entitlement } from '@luvani/core';

/**
 * What the vendor says a learner holds, reduced to what the meter needs.
 *
 * `periodEnd` is the end of the paid period the vendor holds: a monthly
 * product's store period, a store trial's end, or a yearly product's whole paid
 * year. It is the instant a plan lapses from, so it is never cut short.
 * `windowEnd` is set only for a yearly product: the end of the current 30-day
 * allowance window inside that year (core's `allowanceWindowEnd`). `grantSeconds`
 * is what the window grants: the plan's whole allowance, or a store trial's
 * week of it (D16, 2026-10-05). It never exceeds the plan's allowance.
 *
 * F733 review (2026-10-05): the window used to be written as the period end,
 * so a yearly learner read as lapsed a day after any window the renewal sweep
 * did not refill in time, and stayed lapsed. The paid year is the period now,
 * and a late refill costs minutes for a while, never the plan.
 */
export type BillingSnapshot =
  | { kind: 'active'; plan: 'starter' | 'regular'; periodEnd: Date; windowEnd?: Date; grantSeconds: number }
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

/** Whole seconds, as the database stores them, so millisecond formatting never refills a period. */
function second(date: Date): number {
  return Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Where the snapshot's allowance window ends: its own window when it has one,
 * otherwise the paid period. A window that is not an instant inside the paid
 * period is a caller fault, refused like a grant outside the allowance.
 */
function grantedWindowEnd(snapshot: Extract<BillingSnapshot, { kind: 'active' }>, end: number): number {
  if (snapshot.windowEnd === undefined) return end;
  const window = second(snapshot.windowEnd);
  if (!Number.isFinite(window) || window > end) throw new RangeError('a billing window must end inside its paid period');
  return window;
}

/**
 * A later paid period, or a later window of the same one, starts from what it
 * grants. The same window keeps what was spent in it. An older period or an
 * older window of the same period, read late, moves nothing.
 */
export function applyBillingSnapshot(current: Entitlement, snapshot: BillingSnapshot): BillingProjection {
  if (snapshot.kind === 'unknown-product') return { kind: 'unchanged', reason: 'unknown-product', entitlement: current };
  if (snapshot.kind === 'inactive') return current.plan === 'trial'
    ? { kind: 'unchanged', reason: 'not-paid', entitlement: current }
    : { kind: 'lapsed', entitlement: lapsedEntitlement() };
  const withheld = withheldSeconds(snapshot.plan, snapshot.grantSeconds);
  const end = second(snapshot.periodEnd);
  const window = grantedWindowEnd(snapshot, end);
  const before = current.periodEnd ? second(current.periodEnd) : undefined;
  const beforeWindow = current.windowEnd ? second(current.windowEnd) : before;
  if (current.plan !== 'trial' && before !== undefined && beforeWindow !== undefined
    && (end < before || (end === before && window < beforeWindow))) {
    return { kind: 'unchanged', reason: 'superseded', entitlement: current };
  }
  const renewed = before === undefined || beforeWindow === undefined || end > before || window > beforeWindow;
  const allowance = PLANS[snapshot.plan].secondsPerPeriod;
  return { kind: 'active', entitlement: { plan: snapshot.plan, periodEnd: new Date(end),
    ...(window < end ? { windowEnd: new Date(window) } : {}),
    secondsUsed: renewed ? withheld : Math.min(allowance, Math.max(current.secondsUsed, withheld)), lapsed: false } };
}
