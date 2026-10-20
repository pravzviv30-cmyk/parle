import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLANS } from '@luvani/core';
import type { StoreProduct } from '../purchases/contract.ts';
import { chosenOffer, wallPlanRows } from './wallPlans.ts';
import { trialTimeline } from './trialTimeline.ts';

const month: StoreProduct = { plan: 'starter', productId: 'starter-month', title: 'Core', localizedPrice: '£19.99',
  period: 'month', price: 19.99, currencyCode: 'GBP', intro: null, introEligible: false };
const year: StoreProduct = { ...month, productId: 'starter-year', period: 'year', price: 149.99, localizedPrice: '£149.99' };
function annual(monthly: StoreProduct, yearly: StoreProduct) {
  return wallPlanRows({ available: true, products: [monthly], yearly: [yearly] }, PLANS)?.[0]?.offers.find(offer => offer.period === 'year');
}

test('monthly and yearly eligible trials use store duration while preserving server trial allowances', () => {
  const intro = { priceString: '£0.00', periodUnit: 'WEEK' as const, periodNumberOfUnits: 1, cycles: 1 };
  for (const plan of ['starter', 'regular'] as const) {
    const monthly = { ...month, plan, intro, introEligible: true };
    const yearly = { ...year, plan, intro, introEligible: true };
    const rows = wallPlanRows({ available: true, products: [monthly], yearly: [yearly] }, PLANS)!;
    for (const productId of [monthly.productId, yearly.productId]) {
      const chosen = chosenOffer(rows, productId)!;
      assert.equal(chosen.trialDays, 7);
      assert.equal(chosen.hasFreeTrial, true);
      const view = trialTimeline({ offer: chosen, minutes: plan === 'starter' ? 42 : 70, remind: false })!;
      assert.equal(view.days, 7);
      assert.match(view.terms, chosen.period === 'month' ? /a month/ : /a year/);
    }
    const ineligible = wallPlanRows({ available: true, products: [{ ...monthly, introEligible: false }], yearly: [{ ...yearly, introEligible: false }] }, PLANS)!;
    for (const offer of ineligible[0]!.offers) {
      assert.equal(offer.trialDays, null);
      assert.equal(offer.hasFreeTrial, true, 'store trial presence was lost when eligibility was unknown');
    }
  }
});

test('annual savings compare the same tier and currency using numeric store prices and round down', () => {
  assert.equal(annual(month, year)?.annualSavingsPercent, 37);
  assert.equal(annual({ ...month, localizedPrice: 'not a number' }, { ...year, localizedPrice: 'not a number' })?.annualSavingsPercent, 37);
  assert.equal(annual({ ...month, price: 10 }, { ...year, price: 60 })?.annualSavingsPercent, 50);
  const mixed = wallPlanRows({ available: true, products: [month, { ...month, plan: 'regular', productId: 'max-month', price: 50 }], yearly: [year] }, PLANS)!;
  assert.equal(mixed[0]!.offers.find(offer => offer.period === 'year')!.annualSavingsPercent, 37);
  assert.equal(mixed[0]!.offers.find(offer => offer.period === 'month')!.annualSavingsPercent, null);
});

test('missing, mismatched, invalid or non-saving store comparisons show no annual savings claim', () => {
  for (const price of [undefined, NaN, Infinity, 0, -1, 239.88, 250]) {
    assert.equal(annual(month, { ...year, price })?.annualSavingsPercent, null);
  }
  for (const price of [undefined, NaN, Infinity, 0, -1]) {
    assert.equal(annual({ ...month, price }, year)?.annualSavingsPercent, null);
  }
  for (const currencyCode of [undefined, '', 'USD', 'gbp', 'GBP/EUR']) {
    assert.equal(annual(month, { ...year, currencyCode })?.annualSavingsPercent, null);
  }
  assert.equal(annual({ ...month, currencyCode: undefined }, year)?.annualSavingsPercent, null);
  assert.equal(annual({ ...month, price: 10 }, { ...year, price: 119.5 })?.annualSavingsPercent, null, 'a saving below one percent became a claim');
});
