import { PLANS, lapsedEntitlement, type Entitlement } from '@luvani/core';

/**
 * What the vendor says a learner holds, reduced to what the meter needs.
 *
 * `periodStart` is when the vendor says that period began (its purchase date),
 * when it says. `periodEnd` is the end of the paid period the vendor holds: a monthly
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
  | { kind: 'active'; plan: 'starter' | 'regular'; periodStart?: Date; periodEnd: Date; windowEnd?: Date; grantSeconds: number }
  | { kind: 'inactive' }
  /**
   * Nothing this server may act on. `hold` says why, when it is not a product
   * id nobody configured: a store billing grace period, which is not a paid
   * period, or a subscriber who holds something this server's entitlement id
   * does not name, which must never read as holding nothing (F733 second review).
   */
  | { kind: 'unknown-product'; hold?: 'grace-period' | 'entitlement-missing' };
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
 * Which of two vendor answers is newer: 1 a new period or window, 0 the same
 * window, -1 an older answer read late. Exactly the ordering
 * apply_billing_projection_v2 applies in the database.
 *
 * A later start is a new period whatever its end: Apple applies an upgrade at
 * once and refunds the rest of the old plan, so Starter yearly to Max monthly
 * ends eleven months before the year on record and is still the newer answer.
 * An earlier start is older whatever its end, which is the refunded year read
 * late. With the same start, a later window is the next window and a later end
 * with the same window is the same period lengthened. With either start
 * unknown (a row from before starts were recorded) the end decides, as it
 * always has (F733 second review, 2026-10-06).
 */
function billingOrder(current: Entitlement, start: number | undefined, end: number, window: number): -1 | 0 | 1 {
  if (current.plan === 'trial' || !current.periodEnd) return 1;
  const before = second(current.periodEnd);
  const beforeWindow = current.windowEnd ? second(current.windowEnd) : before;
  const beforeStart = current.periodStart ? second(current.periodStart) : undefined;
  if (start !== undefined && beforeStart !== undefined) {
    if (start !== beforeStart) return start > beforeStart ? 1 : -1;
    if (window !== beforeWindow) return window > beforeWindow ? 1 : -1;
    return end < before ? -1 : 0;
  }
  if (end < before || (end === before && window < beforeWindow)) return -1;
  return end > before || window > beforeWindow ? 1 : 0;
}

/**
 * A later paid period, or a later window of the same one, starts from what it
 * grants. The same window keeps what was spent in it: the part it withheld
 * before is swapped for the part it withholds now, so a trial read that lagged
 * a conversion is made whole by the paid read that follows (F733 second
 * review). An older period or an older window of the same period, read late,
 * moves nothing.
 */
export function applyBillingSnapshot(current: Entitlement, snapshot: BillingSnapshot): BillingProjection {
  if (snapshot.kind === 'unknown-product') return { kind: 'unchanged', reason: 'unknown-product', entitlement: current };
  if (snapshot.kind === 'inactive') return current.plan === 'trial'
    ? { kind: 'unchanged', reason: 'not-paid', entitlement: current }
    : { kind: 'lapsed', entitlement: lapsedEntitlement() };
  const withheld = withheldSeconds(snapshot.plan, snapshot.grantSeconds);
  const end = second(snapshot.periodEnd);
  const window = grantedWindowEnd(snapshot, end);
  const start = snapshot.periodStart === undefined ? undefined : second(snapshot.periodStart);
  if (start !== undefined && (!Number.isFinite(start) || start >= end)) throw new RangeError('a billing period must start before it ends');
  const order = billingOrder(current, start, end, window);
  if (order < 0) return { kind: 'unchanged', reason: 'superseded', entitlement: current };
  const allowance = PLANS[snapshot.plan].secondsPerPeriod;
  const spent = order > 0 ? withheld
    : Math.min(allowance, Math.max(current.secondsUsed - (current.withheldSeconds ?? 0) + withheld, withheld));
  const kept = start ?? (order === 0 && current.periodStart ? second(current.periodStart) : undefined);
  return { kind: 'active', entitlement: { plan: snapshot.plan,
    ...(kept !== undefined ? { periodStart: new Date(kept) } : {}),
    periodEnd: new Date(end),
    ...(window < end ? { windowEnd: new Date(window) } : {}),
    ...(withheld > 0 ? { withheldSeconds: withheld } : {}),
    secondsUsed: spent, lapsed: false } };
}
