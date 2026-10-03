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
