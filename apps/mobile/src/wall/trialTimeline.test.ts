/**
 * The store free trial is described only when it is real (F772, founder
 * decision D16, come alive README Part 5.G).
 *
 * A timeline, a "free" button and the trial's terms appear only for a chosen
 * product the store says carries a free trial this account may still take.
 * Its days are the store's, its minutes the server's week of the plan, and its
 * price the store's for the product's own period.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { PLANS, storeTrialSeconds } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import type { StoreIntroOffer, StoreProduct } from '../purchases/adapter.ts';
import { TRIAL_REMINDER_SCHEDULED, trialTimeline } from './trialTimeline.ts';
import { buyLabel } from './wallCopy.ts';
import { chosenOffer, storeTrialDays, storeTrialMinutes, wallPlanRows } from './wallPlans.ts';

const WEEK: StoreIntroOffer = { priceString: '£0.00', periodUnit: 'WEEK', periodNumberOfUnits: 1, cycles: 1 };

const monthly: StoreProduct = {
  plan: 'regular', productId: 'max_month', title: 'Max', localizedPrice: '£24.99', period: 'month', intro: null, introEligible: false,
};
const yearly = (intro: StoreIntroOffer | null, introEligible: boolean): StoreProduct => ({
  plan: 'regular', productId: 'max_year', title: 'Max', localizedPrice: '£179.99', period: 'year', localizedPricePerMonth: '£15.00', intro, introEligible,
});
const chosen = (product: StoreProduct) =>
  chosenOffer(wallPlanRows({ available: true, products: [monthly], yearly: [product] }, PLANS), product.productId);

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

describe('the store free trial, said only when it is real', () => {
  test('a free trial timeline appears only with a real eligible offer', () => {
    const minutes = storeTrialMinutes(PLANS, 'regular');

    // No offer, or one this account cannot take, or one the page cannot name in
    // days: no timeline, and the button says the plain price.
    assert.equal(trialTimeline({ offer: null, minutes, remind: false }), null);
    assert.equal(trialTimeline({ offer: chosen(yearly(null, false)), minutes, remind: false }), null, 'a trial was described with no offer');
    assert.equal(trialTimeline({ offer: chosen(yearly(WEEK, false)), minutes, remind: false }), null, 'a trial was described to an account the store called ineligible');
    assert.equal(trialTimeline({ offer: chosen(yearly(null, true)), minutes, remind: false }), null);
    assert.equal(trialTimeline({ offer: chosen(yearly({ ...WEEK, periodUnit: 'MONTH' }, true)), minutes, remind: false }), null, 'a month was counted out in days');
    assert.equal(trialTimeline({ offer: chosen(yearly({ ...WEEK, cycles: 2 }, true)), minutes, remind: false }), null);
    assert.equal(trialTimeline({ offer: chosen(yearly({ ...WEEK, periodUnit: 'DAY', periodNumberOfUnits: 2 }, true)), minutes, remind: false }), null);
    assert.equal(chosen(yearly(WEEK, false))?.trialDays, null);
    assert.equal(buyLabel('Max', '£179.99', 'year'), 'Max, £179.99 a year');

    // The store's days, in days or weeks only.
    assert.equal(storeTrialDays({ intro: WEEK, introEligible: true }), 7);
    assert.equal(storeTrialDays({ intro: { ...WEEK, periodNumberOfUnits: 2 }, introEligible: true }), 14);
    assert.equal(storeTrialDays({ intro: { ...WEEK, periodUnit: 'DAY', periodNumberOfUnits: 3 }, introEligible: true }), 3);
    assert.equal(storeTrialDays({ intro: { ...WEEK, periodUnit: 'YEAR' }, introEligible: true }), null);

    // A real, eligible seven-day trial on Max yearly.
    const view = trialTimeline({ offer: chosen(yearly(WEEK, true)), minutes, remind: false });
    assert.ok(view, 'a real eligible offer drew no timeline');
    assert.equal(view.days, 7);
    assert.equal(view.cta, 'Start 7-day free trial');
    assert.deepEqual(view.nodes.map((node) => [node.key, node.title, node.line]), [
      ['today', 'Today', 'Max starts free. Nothing is charged today.'],
      ['during', null, 'During the trial: up to 70 minutes with your AI tutor.'],
      ['cancel', 'Day 5', 'Cancel in your App Store settings before day 7 and you pay nothing.'],
      ['then', 'Day 7', 'Max continues at £179.99 a year.'],
    ]);
    assert.equal(view.terms, 'Free for 7 days, then £179.99 a year until you cancel.');

    // The minutes are the server's: a week of the plan from the catalogue it
    // sent, exactly what the projection grants, and none without a catalogue.
    assert.equal(storeTrialMinutes(PLANS, 'regular'), Math.floor(storeTrialSeconds('regular') / 60));
    assert.equal(storeTrialMinutes(PLANS, 'starter'), Math.floor(storeTrialSeconds('starter') / 60));
    assert.equal(storeTrialMinutes(PLANS, 'starter'), 42);
    assert.equal(storeTrialMinutes(null, 'regular'), null);
    const blind = trialTimeline({ offer: chosen(yearly(WEEK, true)), minutes: null, remind: false });
    assert.ok(blind && !blind.nodes.some((node) => node.key === 'during'), 'the trial\'s minutes were guessed with no catalogue');

    // The reminder is promised only when it will be kept. Nothing schedules one
    // yet, so the screen never promises it.
    const promised = trialTimeline({ offer: chosen(yearly(WEEK, true)), minutes, remind: true });
    assert.deepEqual(promised?.nodes.find((node) => node.title === 'Day 5'), { key: 'remind', title: 'Day 5', line: 'We will remind you two days before your trial ends.' });
    assert.equal(TRIAL_REMINDER_SCHEDULED, false, 'a reminder is promised that nothing schedules');

    // Every line is warm, plain and true: no guilt, no dash, no countdown, never a month of minutes.
    for (const line of [view.title, view.cta, view.terms, ...view.nodes.map((node) => node.line), ...(promised?.nodes.map((node) => node.line) ?? [])]) {
      assert.equal(guiltIn(line), undefined, `guilt in the trial timeline: ${line}`);
      assert.doesNotMatch(line, /[—–·]/, `a dash or a middot in the trial timeline: ${line}`);
      assert.doesNotMatch(line, /\bhurry\b|\blast chance\b|\bexpires?\b|\bonly \w+ left\b/i, `urgency in the trial timeline: ${line}`);
    }
    assert.doesNotMatch(view.nodes.find((node) => node.key === 'during')!.line, /month/, 'the trial is described as a month');

    // The screen draws only what this decides: the timeline from the chosen
    // product, the button from its call to action, the terms at the button.
    const screen = read('./WallScreen.tsx');
    assert.match(screen, /const trial = trialTimeline\(\{\s*offer: chosen,\s*minutes: chosen === null \? null : storeTrialMinutes\(latestCatalogue\(\), chosen\.plan\),\s*remind: TRIAL_REMINDER_SCHEDULED,\s*\}\);/);
    assert.match(screen, /chosen === null \? PLANS_CHOOSE : trial !== null \? trial\.cta : buyLabel\(chosen\.name, chosen\.price, chosen\.period\)/);
    assert.match(screen, /<WallPlansAtButton trialTerms=\{trial\?\.terms \?\? null\} \/>/);
    const page = read('./WallPlansPage.tsx');
    assert.match(page, /\{trial !== null && <TrialTimeline view=\{trial\} \/>\}/);
  });
});
