/**
 * The native adapter's reading of a store product (F733, founder decision D16).
 *
 * adapter.native.ts imports React Native and the store SDK, which Node cannot
 * load, so this runs the adapter's own text for the three functions that turn
 * a store package into a `StoreProduct`, against a fake SDK. What it proves is
 * that every number on a product is the store's: the period comes from the
 * store's own subscription period, the free trial from the store's own intro
 * price, and eligibility from the store's own answer, with every unknown read
 * as no.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const native = readFileSync(new URL('./adapter.native.ts', import.meta.url), 'utf8');
const text = native.slice(native.indexOf("/** The store's own words"), native.indexOf('function actionFrom'));

const ELIGIBLE = 2;
function load(answer: (ids: string[]) => Promise<Record<string, { status: number }>>) {
  const asked: string[][] = [];
  const Purchases = {
    INTRO_ELIGIBILITY_STATUS: { INTRO_ELIGIBILITY_STATUS_UNKNOWN: 0, INTRO_ELIGIBILITY_STATUS_INELIGIBLE: 1, INTRO_ELIGIBILITY_STATUS_ELIGIBLE: ELIGIBLE },
    checkTrialOrIntroductoryPriceEligibility: async (ids: string[]) => { asked.push(ids); return answer(ids); },
  };
  const made = new Function('Purchases', `${stripTypeScriptTypes(text)}\nreturn { productOf, freeTrialOf, introEligibleIds };`)(Purchases) as {
    productOf(plan: string, found: unknown, eligible: ReadonlySet<string>): Record<string, unknown> | null;
    freeTrialOf(found: unknown): Record<string, unknown> | null;
    introEligibleIds(packages: readonly { found: unknown }[]): Promise<ReadonlySet<string>>;
  };
  return { ...made, asked };
}

const week = { price: 0, priceString: '£0.00', cycles: 1, period: 'P1W', periodUnit: 'WEEK', periodNumberOfUnits: 1 };
const pkg = (identifier: string, subscriptionPeriod: string, introPrice: unknown = null, priceString = '£149.99') => ({
  product: { identifier, subscriptionPeriod, introPrice, priceString, title: 'Max' },
});

test('a store free trial is read only as the store describes it, and offered only to an eligible account', async () => {
  const { productOf, freeTrialOf, introEligibleIds, asked } = load(async (ids) =>
    Object.fromEntries(ids.map((id) => [id, { status: id === 'yearly' ? ELIGIBLE : 1 }])));

  // The period is the store's own subscription period.
  const year = pkg('yearly', 'P1Y', week);
  const month = pkg('monthly', 'P1M', week, '£24.99');
  const eligible = await introEligibleIds([{ found: year }, { found: month }]);
  assert.deepEqual(asked, [['yearly', 'monthly']], 'eligibility was asked about something other than the products with a free trial');
  assert.deepEqual(productOf('regular', year, eligible), {
    plan: 'regular', productId: 'yearly', title: 'Max', localizedPrice: '£149.99', period: 'year',
    intro: { priceString: '£0.00', periodUnit: 'WEEK', periodNumberOfUnits: 1, cycles: 1 }, introEligible: true,
  });
  const monthly = productOf('regular', month, eligible)!;
  assert.equal(monthly.period, 'month');
  assert.equal(monthly.introEligible, false, 'an account the store called ineligible was offered the trial');

  // A paid introductory price is not a free trial; a half-described offer is none.
  assert.equal(freeTrialOf(pkg('monthly', 'P1M', { ...week, price: 0.99, priceString: '£0.99' })), null);
  assert.equal(freeTrialOf(pkg('monthly', 'P1M', { ...week, periodUnit: 'FORTNIGHT' })), null);
  assert.equal(freeTrialOf(pkg('monthly', 'P1M', { ...week, periodNumberOfUnits: 0 })), null);
  assert.equal(freeTrialOf(pkg('monthly', 'P1M', { ...week, priceString: ' ' })), null);
  assert.equal(productOf('starter', pkg('monthly', 'P1M'), new Set(['monthly']))!.introEligible, false, 'no offer, yet eligible for it');

  // No offer means no question asked; a store that cannot answer means no.
  const quiet = load(async () => { throw new Error('store unavailable'); });
  assert.deepEqual([...(await quiet.introEligibleIds([{ found: pkg('monthly', 'P1M') }]))], []);
  assert.deepEqual(quiet.asked, []);
  assert.deepEqual([...(await quiet.introEligibleIds([{ found: year }]))], [], 'an unanswered eligibility check read as yes');
  // And no price, no product.
  assert.equal(productOf('regular', pkg('yearly', 'P1Y', week, '  '), eligible), null);
});
