import assert from 'node:assert/strict';
import { test } from 'node:test';
import { secondsRemaining, recordUsage, type Entitlement } from '@luvani/core';
import { projectSubscriber, revenueCatConfiguration, type RevenueCatConfiguration } from './revenuecat.ts';
import { billingStatusFor } from '../billingStatus.ts';
const config: RevenueCatConfiguration = { secretApiKey: 'test', webhookSecret: 'test', entitlementId: 'live', products: { starter: 'month', regular: 'max' }, weeklyStarterProduct: 'week' };
const now = new Date('2026-10-09T12:00:00Z');
const body = (start = '2026-10-09T00:00:00Z', end = '2026-10-16T00:00:00Z', type = 'normal') => ({ subscriber: { entitlements: { live: { product_identifier: 'week', purchase_date: start, expires_date: end } }, subscriptions: { week: { period_type: type } } } });
const fresh: Entitlement = { plan: 'trial', secondsUsed: 1800 };
test('weekly grants 45 minutes, replay preserves usage and renewal never rolls over', () => {
 const first = projectSubscriber(body(), fresh, config, now);
 assert.equal(first.kind, 'active'); if (first.kind !== 'active') return;
 assert.equal(secondsRemaining(first.entitlement), 2700);
 assert.equal(billingStatusFor(first.entitlement).allowanceSeconds, 2700);
 const spent = recordUsage(first.entitlement, 600);
 const replay = projectSubscriber(body(), spent, config, now);
 assert.equal(secondsRemaining(replay.entitlement), 2100);
 const next = projectSubscriber(body('2026-10-16T00:00:00Z', '2026-10-23T00:00:00Z'), spent, config, new Date('2026-10-16T12:00:00Z'));
 assert.equal(secondsRemaining(next.entitlement), 2700);
 const late = projectSubscriber(body(), next.entitlement, config, now);
 assert.equal(late.kind, 'unchanged');
 assert.equal(secondsRemaining(late.entitlement), 2700);
});
test('weekly trials and unconfigured products grant nothing; cancellation retains paid access until expiry', () => {
 assert.equal(projectSubscriber(body(undefined, undefined, 'trial'), fresh, config, now).kind, 'unchanged');
 assert.equal(projectSubscriber(body(), fresh, { ...config, weeklyStarterProduct: undefined }, now).kind, 'unchanged');
 const paid = projectSubscriber(body(), fresh, config, now);
 assert.equal(secondsRemaining(paid.entitlement), 2700);
 const cancelled = body(); Object.assign(cancelled.subscriber.subscriptions.week, { unsubscribe_detected_at: now.toISOString() });
 assert.equal(secondsRemaining(projectSubscriber(cancelled, paid.entitlement, config, now).entitlement), 2700);
 assert.equal(projectSubscriber({ subscriber: { entitlements: {} } }, paid.entitlement, config, now).kind, 'lapsed');
});
test('weekly product configuration rejects ambiguous ids', () => {
 assert.throws(() => revenueCatConfiguration({ REVENUECAT_SECRET_API_KEY: 'test', LUVANI_REVENUECAT_WEBHOOK_SECRET: 'test', REVENUECAT_ENTITLEMENT_ID: 'live', REVENUECAT_STARTER_PRODUCT_ID: 'same', REVENUECAT_REGULAR_PRODUCT_ID: 'max', REVENUECAT_STARTER_WEEKLY_PRODUCT_ID: 'same' }), /ambiguous/);
});
