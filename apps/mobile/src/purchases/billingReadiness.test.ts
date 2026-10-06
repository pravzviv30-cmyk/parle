import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { billingPairMatches } from './billingReadiness.ts';
const expected = { entitlementId: 'luvani', products: { starter: 'starter', regular: 'regular' } };
const ready = { ...expected, ready: true, projectionVersion: 1 };

test('a client configured for purchases refuses to run against a server that is not', () => {
  assert.equal(billingPairMatches(ready, expected), true);
  for (const body of [null, {}, { ...ready, ready: false }, { ...ready, projectionVersion: 0 }, { ...ready, entitlementId: 'other' }, { ...ready, products: { starter: 'other', regular: 'regular' } }]) assert.equal(billingPairMatches(body, expected), false);
  assert.equal(billingPairMatches(ready, { ...expected, entitlementId: undefined }), false);
  const native = readFileSync(new URL('./adapter.native.ts', import.meta.url), 'utf8');
  const readiness = native.slice(native.indexOf('async function ready'), native.indexOf('async function paidPackages'));
  assert.match(readiness, /serverBillingReady\(userId\)/);
  assert.match(native, /const match = \(await paidPackages\(userId\)\)/);
  const wall = readFileSync(new URL('../wall/WallScreen.tsx', import.meta.url), 'utf8');
  assert.match(wall, /purchases.offering\(user.id\)/);
  assert.doesNotMatch(wall, /purchases.offering\('wall'\)/);
  assert.match(wall, /\[retry, user\?\.id\]/);
});

test('a yearly product opens the store only when the server names the same yearly id', () => {
  // F733 (D16): a yearly purchase the server cannot map is refused after the
  // learner has paid, so the build that sells one checks the pair first.
  const server = { ...ready, yearlyProducts: { starter: 'starter_year', regular: 'regular_year' } };
  const both = { ...expected, yearly: { starter: 'starter_year', regular: 'regular_year' } };
  assert.equal(billingPairMatches(server, both), true);
  assert.equal(billingPairMatches(server, { ...expected, yearly: { starter: 'starter_year', regular: undefined } }), true, 'a build may sell one tier yearly');
  assert.equal(billingPairMatches(server, expected), true, 'a build that sells no yearly product ignores the server list');
  assert.equal(billingPairMatches(ready, both), false, 'a server that names no yearly product was trusted with one');
  assert.equal(billingPairMatches({ ...server, yearlyProducts: { starter: 'other', regular: 'regular_year' } }, both), false);
  assert.equal(billingPairMatches({ ...server, yearlyProducts: { starter: 'starter', regular: 'regular_year' } },
    { ...expected, yearly: { starter: 'starter', regular: 'regular_year' } }), false, 'a yearly id equal to a monthly one is two products in one');
  const client = readFileSync(new URL('./client.ts', import.meta.url), 'utf8');
  assert.match(client, /yearly: \{ starter: process\.env\.EXPO_PUBLIC_REVENUECAT_STARTER_YEARLY_PRODUCT_ID, regular: process\.env\.EXPO_PUBLIC_REVENUECAT_REGULAR_YEARLY_PRODUCT_ID \}/);
  const native = readFileSync(new URL('./adapter.native.ts', import.meta.url), 'utf8');
  assert.match(native, /if \(found\?\.product\.subscriptionPeriod === 'P1Y'\) out\.push\(\{ plan, found \}\);/, 'a yearly id is offered for a period other than a year');
  assert.match(native, /const products = priced\.filter\(\(product\) => product\.period === 'month'\);/, 'a yearly product can reach a monthly screen');
});
