import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { storeHeldPlanFrom, storeTrialFactsFrom } from './storeTrialFacts.ts';
import { purchases } from './adapter.ts';

const END = '2026-10-26T12:00:00Z';
const END_MS = new Date(END).getTime();
const info = (e: Record<string, unknown>, active = true) => ({
  entitlements: { all: { luvani: { isActive: active, ...e } }, active: active ? { luvani: { isActive: true, ...e } } : {} },
});

test('TRIAL reads as in trial, with willRenew and the expiry', () => {
  assert.deepEqual(storeTrialFactsFrom(info({ periodType: 'TRIAL', willRenew: true, expirationDate: END }), 'luvani'),
    { inTrial: true, willRenew: true, expiresAt: END_MS });
  assert.deepEqual(storeTrialFactsFrom(info({ periodType: 'trial', willRenew: true, expirationDateMillis: END_MS }), 'luvani'),
    { inTrial: true, willRenew: true, expiresAt: END_MS });
});

test('NORMAL, INTRO and PREPAID are not a free trial', () => {
  for (const periodType of ['NORMAL', 'INTRO', 'PREPAID']) {
    assert.equal(storeTrialFactsFrom(info({ periodType, willRenew: true, expirationDate: END }), 'luvani')?.inTrial, false, periodType);
  }
});

test('auto-renew turned off reads as willRenew false', () => {
  assert.equal(storeTrialFactsFrom(info({ periodType: 'TRIAL', willRenew: false, expirationDate: END }), 'luvani')?.willRenew, false);
});

test('an inactive entitlement is no longer in a trial', () => {
  assert.deepEqual(storeTrialFactsFrom(info({ periodType: 'TRIAL', willRenew: false, expirationDate: END }, false), 'luvani'),
    { inTrial: false, willRenew: false, expiresAt: END_MS });
});

test('unknown is null, never a guess', () => {
  assert.equal(storeTrialFactsFrom(info({ periodType: 'TRIAL' }), undefined), null, 'no entitlement id configured');
  assert.equal(storeTrialFactsFrom(info({ periodType: 'TRIAL' }), 'other'), null, 'another entitlement is not read');
  assert.equal(storeTrialFactsFrom(null, 'luvani'), null);
  assert.equal(storeTrialFactsFrom({}, 'luvani'), null);
  assert.deepEqual(storeTrialFactsFrom(info({ periodType: 'MYSTERY', willRenew: 'yes', expirationDate: 'soon' }), 'luvani'),
    { inTrial: null, willRenew: null, expiresAt: null });
});

test('the unconfigured (web and test) adapter has no store facts', async () => {
  assert.equal(await purchases.trialFacts('u1'), null);
  const off = purchases.onStoreChange(() => { throw new Error('never fires'); });
  off();
});

test('store facts never reach a grant: the reader and the native read touch no billing write', () => {
  const pure = readFileSync(new URL('./storeTrialFacts.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(pure, /^import (?!type)/m, 'the mapper imports nothing at runtime');
  const native = readFileSync(new URL('./adapter.native.ts', import.meta.url), 'utf8');
  const body = native.slice(native.indexOf('async trialFacts('), native.indexOf('onStoreChange(listener)'));
  assert.ok(body.length > 0);
  assert.doesNotMatch(body, /refreshBilling|billingChanged|save\(|fetch\(|purchasePackage|restorePurchases/);
});

test('an Android held id already joined as sub:base is never joined twice', () => {
  const held = (productIdentifier: string, productPlanIdentifier?: string) => storeHeldPlanFrom({
    entitlements: { active: { pro: { isActive: true, productIdentifier, productPlanIdentifier, periodType: 'NORMAL', willRenew: true, expirationDate: '2026-11-27T10:00:00.000Z' } } },
  } as never, 'pro');
  assert.equal(held('luvani_core:monthly', 'monthly')?.productId, 'luvani_core:monthly');
  assert.equal(held('luvani_core', 'monthly')?.productId, 'luvani_core:monthly');
  assert.equal(held('luvani_core')?.productId, 'luvani_core');
});
