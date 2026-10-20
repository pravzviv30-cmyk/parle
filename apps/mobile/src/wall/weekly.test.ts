import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLANS } from '@luvani/core';
import { wallPlanRows, chosenOffer, offerMinutes } from './wallPlans.ts';
import { billedPrice } from './wallCopy.ts';
import { wallSuccess } from './wallSuccess.ts';
import { billingPairMatches } from '../purchases/billingReadiness.ts';
import type { StoreProduct } from '../purchases/contract.ts';
const month: StoreProduct = { plan: 'starter', period: 'month', productId: 'month', title: 'Core', localizedPrice: '£14.99', intro: null, introEligible: false };
const week: StoreProduct = { ...month, period: 'week', productId: 'week', localizedPrice: '$5.49' };
test('weekly is an explicit localized choice with its own allowance and no free trial', () => {
 const rows = wallPlanRows({ available: true, products: [month], weekly: [week] }, PLANS)!;
 const chosen = chosenOffer(rows, 'week')!;
 assert.equal(chosen.period, 'week'); assert.equal(chosen.price, '$5.49'); assert.equal(chosen.trialDays, null);
 assert.equal(offerMinutes(rows[0]!, chosen), 45);
 assert.equal(billedPrice(chosen.price, chosen.period), '$5.49 every 7 days');
 assert.equal(chosenOffer(wallPlanRows({ available: true, products: [month] }, PLANS), 'week'), null);
});
test('readiness verifies weekly id and allowance before opening the store', () => {
 const expected = { entitlementId: 'live', products: { starter: 'month', regular: 'max' }, weeklyStarterProduct: 'week' };
 const body = { ready: true, projectionVersion: 1, entitlementId: 'live', products: expected.products, weeklyStarterProduct: 'week', weeklyStarterSeconds: 2700 };
 assert.equal(billingPairMatches(body, expected), true);
 assert.equal(billingPairMatches({ ...body, weeklyStarterSeconds: 10800 }, expected), false);
 assert.equal(billingPairMatches({ ...body, weeklyStarterProduct: 'other' }, expected), false);
});
test('weekly confirmation never promises 180 minutes or a free trial', () => {
 const success = wallSuccess({ plan: 'starter', secondsRemaining: 2700, allowanceSeconds: 2700, periodEnd: '2026-10-16T00:00:00Z', canStart: true, reason: null, lapsed: false }, PLANS, false, Date.parse('2026-10-09T00:00:00Z'))!;
 assert.equal(success.minutes, 45); assert.equal(success.trial, undefined); assert.ok(success.until);
});
