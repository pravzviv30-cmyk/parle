import assert from 'node:assert/strict';
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
    assert.deepEqual(result, { kind: 'unchanged', reason: 'unknown-product' });
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
