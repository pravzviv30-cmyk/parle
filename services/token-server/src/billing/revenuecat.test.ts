import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { PLANS, type Entitlement } from '@luvani/core';
import { InMemoryEntitlementStore } from '../store.ts';
import {
  projectSubscriber,
  refreshSubscriber,
  revenueCatConfiguration,
  webhookAuthorised,
  type RevenueCatConfiguration,
} from './revenuecat.ts';

const config: RevenueCatConfiguration = {
  secretApiKey: 'secret-api-key',
  webhookSecret: 'Bearer webhook-secret',
  entitlementId: 'luvani',
  products: { starter: 'luvani_starter_monthly', regular: 'luvani_regular_monthly' },
};
const now = new Date('2026-08-30T12:00:00.000Z');
const subscriber = (product: string, expires = '2026-09-30T12:00:00.000Z') => ({
  subscriber: { entitlements: { luvani: { product_identifier: product, expires_date: expires } } },
});

describe('RevenueCat subscriber projection — F247', () => {
  test('an active starter subscriber projects to a fresh starter period', () => {
    const result = projectSubscriber(subscriber('luvani_starter_monthly'), { plan: 'trial', secondsUsed: 300 }, config, now);
    assert.equal(result.kind, 'active');
    if (result.kind !== 'active') return;
    assert.equal(result.entitlement.plan, 'starter');
    assert.equal(result.entitlement.secondsUsed, 0);
    assert.equal(result.entitlement.periodEnd?.toISOString(), '2026-09-30T12:00:00.000Z');
    assert.equal(result.entitlement.lapsed, false);
  });

  test('the same paid period preserves usage and a renewed period resets it', () => {
    const current: Entitlement = {
      plan: 'starter',
      secondsUsed: 1200,
      periodEnd: new Date('2026-09-30T12:00:00.000Z'),
    };
    const repeat = projectSubscriber(subscriber('luvani_starter_monthly'), current, config, now);
    assert.equal(repeat.kind === 'active' && repeat.entitlement.secondsUsed, 1200);
    const renewed = projectSubscriber(subscriber('luvani_starter_monthly', '2026-10-30T12:00:00.000Z'), current, config, now);
    assert.equal(renewed.kind === 'active' && renewed.entitlement.secondsUsed, 0);
  });

  test('a lapsed subscriber projects to an exhausted trial', () => {
    const current: Entitlement = {
      plan: 'starter',
      secondsUsed: 900,
      periodEnd: new Date('2026-08-01T00:00:00.000Z'),
    };
    const result = projectSubscriber({ subscriber: { entitlements: {} } }, current, config, now);
    assert.equal(result.kind, 'lapsed');
    if (result.kind !== 'lapsed') return;
    assert.deepEqual(result.entitlement, {
      plan: 'trial',
      secondsUsed: PLANS.trial.secondsPerPeriod,
      lapsed: true,
    });
  });

  test('an unknown product identifier changes nothing and is logged loudly', async () => {
    const store = new InMemoryEntitlementStore('starter');
    await store.save('5a18f595-9d67-4e34-b620-d410ba4335b1', {
      plan: 'starter',
      secondsUsed: 450,
      periodEnd: new Date('2026-09-30T12:00:00.000Z'),
    });
    const errors: unknown[][] = [];
    const result = await refreshSubscriber('5a18f595-9d67-4e34-b620-d410ba4335b1', store, config, {
      now,
      logger: { error: (...args: unknown[]) => errors.push(args) },
      request: async () => new Response(JSON.stringify(subscriber('some_future_plan')), { status: 200 }),
    });
    // The projection carries the entitlement that stands, so this can assert the
    // row came back untouched rather than only that the kind said so.
    assert.deepEqual(result, {
      kind: 'unchanged',
      reason: 'unknown-product',
      entitlement: { plan: 'starter', secondsUsed: 450, periodEnd: new Date('2026-09-30T12:00:00.000Z') },
    });
    assert.equal(errors.length, 1);
    assert.match(String(errors[0]?.[0]), /UNKNOWN_PRODUCT/);
    assert.equal((await store.get('5a18f595-9d67-4e34-b620-d410ba4335b1')).secondsUsed, 450);
  });
});

describe('billing configuration and webhook authentication', () => {
  test('no billing keys leaves the purchase path dark and a partial set is refused', () => {
    assert.equal(revenueCatConfiguration({}), null);
    assert.throws(() => revenueCatConfiguration({ REVENUECAT_SECRET_API_KEY: 'only-one' }), /incomplete/);
    assert.deepEqual(revenueCatConfiguration({
      REVENUECAT_SECRET_API_KEY: 'api',
      LUVANI_REVENUECAT_WEBHOOK_SECRET: 'hook',
      REVENUECAT_ENTITLEMENT_ID: 'luvani',
      REVENUECAT_STARTER_PRODUCT_ID: 'starter',
      REVENUECAT_REGULAR_PRODUCT_ID: 'regular',
    })?.products, { starter: 'starter', regular: 'regular' });
  });

  test('the webhook secret must match in full', () => {
    assert.equal(webhookAuthorised('Bearer webhook-secret', config.webhookSecret), true);
    assert.equal(webhookAuthorised('Bearer webhook-secreu', config.webhookSecret), false);
    assert.equal(webhookAuthorised(undefined, config.webhookSecret), false);
  });
});

describe('the refresh endpoint reports what it did — F265', () => {
  const server = readFileSync(path.join(import.meta.dirname, '..', 'server.ts'), 'utf8');

  test('a refresh that granted nothing does not report success', async () => {
    const userId = '9f2c1d4e-3b5a-4c6d-8e7f-0a1b2c3d4e5f';
    const store = new InMemoryEntitlementStore('trial');
    const before = await store.get(userId);

    // Nobody home at the vendor: this learner owns nothing and never did.
    const result = await refreshSubscriber(userId, store, config, {
      now,
      request: async () => new Response(JSON.stringify({ subscriber: { entitlements: {} } }), { status: 200 }),
    });

    assert.equal(result.kind, 'unchanged', 'a learner who owns nothing has had nothing granted');
    assert.equal(result.kind === 'unchanged' && result.reason, 'not-paid');
    // The entitlement rides along, so a caller can answer with the plan that stands
    // rather than inferring one from an HTTP status.
    assert.equal(result.entitlement.plan, before.plan);
    assert.deepEqual(await store.get(userId), before, 'nothing was written');

    // And the handler answers from that kind rather than from having run at all.
    // `return json(res, 200, { refreshed: true })` was the whole defect: a learner
    // was told their speaking time was ready and the paywall then hid the buy and
    // restore buttons behind that sentence.
    const opens = server.indexOf("url.pathname === '/billing/refresh'");
    assert.ok(opens > 0, 'there is no /billing/refresh handler');
    // Comments stripped: the handler's own comment quotes the defect it fixed, and a
    // scan that reads prose would be satisfied by an apology for the bug.
    const handler = server.slice(opens, server.indexOf('\n    if (req.method', opens)).replace(/\/\/[^\n]*/g, '');
    assert.match(handler, /refreshed: projection\.kind === 'active'/);
    assert.doesNotMatch(handler, /refreshed: true/, 'the endpoint claims success without asking what it did');
  });

  test('the grant carries the plan catalogue, so a learner need not be refused to learn the price', () => {
    assert.match(server, /return json\(res, 200, \{ \.\.\.result\.grant, livekitUrl, plans: PLANS \}/);
  });
});

describe('a plan change inside a paid period is not a new allowance', () => {
  const periodEnd = new Date('2026-09-30T12:00:00.000Z');

  test('crossgrading with the period untouched carries the seconds over rather than clearing them', () => {
    // 250 minutes of a 300-minute Max month already spent, then a move to Starter
    // that leaves the expiry where it was. This read `current.plan === plan`, so any
    // change of tier reset the counter: on a store whose proration keeps the expiry,
    // switching tiers was a fresh allowance, as often as a learner cared to switch.
    const current: Entitlement = { plan: 'regular', secondsUsed: 15_000, periodEnd };
    const result = projectSubscriber(subscriber('luvani_starter_monthly'), current, config, now);

    assert.equal(result.kind, 'active');
    if (result.kind !== 'active') return;
    assert.equal(result.entitlement.plan, 'starter');
    assert.notEqual(result.entitlement.secondsUsed, 0, 'a crossgrade inside a paid period is not a refill');
    assert.equal(
      result.entitlement.secondsUsed,
      PLANS.starter.secondsPerPeriod,
      'seconds already spent carry over, clamped to the cap of the plan now held',
    );
  });

  test('the same move at a new expiry does grant the new allowance, because that period was paid for', () => {
    const current: Entitlement = { plan: 'regular', secondsUsed: 15_000, periodEnd };
    const result = projectSubscriber(
      subscriber('luvani_starter_monthly', '2026-10-30T12:00:00.000Z'),
      current,
      config,
      now,
    );
    assert.equal(result.kind === 'active' && result.entitlement.secondsUsed, 0);
  });

  test('a first purchase from the trial grants a full allowance', () => {
    const current: Entitlement = { plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod };
    const result = projectSubscriber(subscriber('luvani_regular_monthly'), current, config, now);
    assert.equal(result.kind === 'active' && result.entitlement.plan, 'regular');
    assert.equal(result.kind === 'active' && result.entitlement.secondsUsed, 0, 'a trial has no period to be inside');
  });
});
