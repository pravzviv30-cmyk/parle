import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { PLANS, lapsedEntitlement } from '@luvani/core';

import { billingStatusFor } from './billingStatus.ts';
import { RATE_LIMITS } from './rateLimit.ts';

const server = readFileSync(path.join(import.meta.dirname, 'server.ts'), 'utf8');

/** The whole `if (req.method ...)` block that owns a path, and nothing of its neighbours. */
function routeFor(pathname: string): string {
  const at = server.indexOf(`url.pathname === '${pathname}'`);
  assert.ok(at > 0, `the ${pathname} route does not exist`);
  const start = server.lastIndexOf('if (req.method', at);
  const end = server.indexOf('if (req.method', at);
  return server.slice(start, end);
}

describe('billing status — what the learner holds, read and never changed (F540)', () => {
  test('billing status answers the plan and the period for the signed-in learner, and refuses everyone else', () => {
    const route = routeFor('/billing/status');
    // Identity is resolved exactly as the start resolves it: the bearer when
    // auth is live, an asserted id only under the local-development opt-in.
    assert.match(route, /req\.method === 'POST'/);
    assert.match(route, /RATE_LIMITS\.billingStatusIp/);
    assert.match(route, /users\.resolve\(req\.headers\.authorization, asserted\)/);
    assert.match(route, /if \(!resolved\.ok\) return json\(res, resolved\.status/, 'a learner the server cannot name is refused');
    assert.match(route, /RATE_LIMITS\.billingStatusUser/);
    assert.match(route, /billingStatusFor\(await store\.get\(resolved\.userId\)\)/, 'the answer is the store row through the one rule');
    // Read and never changed: nothing on this route moves minutes, claims a
    // trial, or asks the vendor.
    assert.doesNotMatch(route, /store\.consume\(|store\.save\(|claimTrial\(|refreshSubscriber\(/);
    assert.doesNotMatch(route, /searchParams\.get\(['"]userId/);
    // Placed after the start, so the refresh route's own contract test, which
    // slices from the refresh to the start's comment, never reads this block.
    assert.ok(
      server.indexOf("url.pathname === '/billing/status'") > server.indexOf('// What the app calls to begin'),
      'the status route sits inside the slice the refresh contract test reads',
    );
    // Its own rules, distinct from the refresh so one cannot starve the other.
    assert.equal(RATE_LIMITS.billingStatusIp.name, 'billing-status-ip');
    assert.equal(RATE_LIMITS.billingStatusUser.name, 'billing-status-user');
    assert.ok(RATE_LIMITS.billingStatusUser.limit >= 10, 'two tabs read this on focus; the bound must let a learner look twice');
  });

  test('a fresh trial can start and a spent one cannot, and the reason is core’s', () => {
    const fresh = billingStatusFor({ plan: 'trial', secondsUsed: 0 });
    assert.equal(fresh.plan, 'trial');
    assert.equal(fresh.secondsRemaining, PLANS.trial.secondsPerPeriod);
    assert.equal(fresh.canStart, true);
    assert.equal(fresh.reason, null);
    assert.equal(fresh.periodEnd, null, 'an unspent taste has no refill time yet: its window starts at first use');
    assert.equal(fresh.lapsed, false);

    const spent = billingStatusFor({ plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod });
    assert.equal(spent.canStart, false);
    assert.equal(spent.reason, 'exhausted');
    assert.equal(spent.secondsRemaining, 0);

    const thin = billingStatusFor({ plan: 'starter', secondsUsed: PLANS.starter.secondsPerPeriod - 30 });
    assert.equal(thin.canStart, false);
    assert.equal(thin.reason, 'insufficient-for-session', 'thirty seconds is not a conversation, and core says so');
  });

  test('a lapsed plan reads as lapsed and never as a fresh trial', () => {
    // D24: a lapse lands on the free conversation every free learner holds. It still
    // reads as lapsed, so the app never greets a former subscriber as new.
    const lapsed = billingStatusFor(lapsedEntitlement());
    assert.equal(lapsed.plan, 'trial');
    assert.equal(lapsed.lapsed, true);
    assert.equal(lapsed.canStart, true, 'a lapsed learner cannot spend the free conversation');
    assert.equal(lapsed.reason, null);
    assert.equal(lapsed.secondsRemaining, PLANS.trial.secondsPerPeriod);

    // Only once that conversation is spent too is the answer the lapse.
    const spent = billingStatusFor({ ...lapsedEntitlement(), secondsUsed: PLANS.trial.secondsPerPeriod });
    assert.equal(spent.canStart, false);
    assert.equal(spent.reason, 'subscription-lapsed');
    assert.equal(spent.secondsRemaining, 0);
  });

  test('a free conversation reports when it refills, and a passed window reads as refilled', () => {
    const now = new Date('2026-10-20T09:00:00.000Z');
    const refillsAt = new Date('2026-10-22T05:00:00.000Z'); // 44 hours after the first debit (REV-001)
    const spent = { plan: 'trial' as const, secondsUsed: PLANS.trial.secondsPerPeriod, weeklyTaste: true, periodEnd: refillsAt };
    const before = billingStatusFor(spent, now);
    assert.equal(before.periodEnd, refillsAt.toISOString(), 'the app could not say when the free conversation comes back');
    assert.equal(before.canStart, false);
    assert.equal(before.reason, 'exhausted');

    const after = billingStatusFor(spent, refillsAt);
    assert.equal(after.canStart, true, 'a passed window still read as spent');
    assert.equal(after.secondsRemaining, PLANS.trial.secondsPerPeriod);
    assert.equal(after.periodEnd, null, 'the next window starts at the next debit, not at the refill');

    // A free row without the device claim behind it never refills.
    const unclaimed = billingStatusFor({ ...spent, weeklyTaste: false }, refillsAt);
    assert.equal(unclaimed.canStart, false);
    assert.equal(unclaimed.secondsRemaining, 0);
  });

  test('the period end travels as an instant, from a date or a string, and junk reads as none', () => {
    const end = new Date('2026-10-12T09:00:00.000Z');
    assert.equal(billingStatusFor({ plan: 'starter', secondsUsed: 0, periodEnd: end }).periodEnd, end.toISOString());
    assert.equal(
      billingStatusFor({ plan: 'regular', secondsUsed: 0, periodEnd: '2026-10-12T09:00:00.000Z' as unknown as Date }).periodEnd,
      end.toISOString(),
    );
    assert.equal(billingStatusFor({ plan: 'regular', secondsUsed: 0, periodEnd: 'soon' as unknown as Date }).periodEnd, null);
  });

  test('a yearly plan reports when its minutes start fresh, which is the window and not the year', () => {
    // F733 review (2026-10-05): the paid year is the period a plan lapses from,
    // and the 30-day window is when the minutes come back. Every screen that
    // reads periodEnd says the second, so the status answers the second.
    const yearEnd = new Date('2027-10-05T09:00:00.000Z');
    const windowEnd = new Date('2026-11-04T09:00:00.000Z');
    const yearly = billingStatusFor({ plan: 'regular', secondsUsed: 600, periodEnd: yearEnd, windowEnd });
    assert.equal(yearly.periodEnd, windowEnd.toISOString(), 'the plan card would promise fresh minutes at the end of the year');
    assert.equal(yearly.lapsed, false);
    assert.equal(billingStatusFor({ plan: 'regular', secondsUsed: 600, periodEnd: yearEnd }).periodEnd, yearEnd.toISOString());
  });
});
