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
import { trialReminderPromised } from '../reminders/trialReminder.ts';
import { trialTimeline } from './trialTimeline.ts';
import { paywallOffer } from './trialPaywall.ts';
import { billedPrice, buyLabel, payDetail } from './wallCopy.ts';
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
    assert.equal(buyLabel('Max', '£179.99', 'year'), 'Subscribe yearly');

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
      ['during', null, 'During the trial: up to 140 minutes with your tutor.'],
      ['cancel', 'Before day 7', 'Cancel in your App Store settings before day 7 and you pay nothing.'],
      ['then', 'Day 7', 'Max continues at £179.99 a year.'],
    ]);
    assert.equal(view.terms, 'Free for 7 days, then £179.99 a year until you cancel.');

    // The minutes are the server's: a week of the plan from the catalogue it
    // sent, exactly what the projection grants, and none without a catalogue.
    assert.equal(storeTrialMinutes(PLANS, 'regular'), Math.floor(storeTrialSeconds('regular') / 60));
    assert.equal(storeTrialMinutes(PLANS, 'starter'), Math.floor(storeTrialSeconds('starter') / 60));
    assert.equal(storeTrialMinutes(PLANS, 'starter'), 70);
    assert.equal(storeTrialMinutes(null, 'regular'), null);
    const blind = trialTimeline({ offer: chosen(yearly(WEEK, true)), minutes: null, remind: false });
    assert.ok(blind && !blind.nodes.some((node) => node.key === 'during'), 'the trial\'s minutes were guessed with no catalogue');

    // The reminder is promised only when it will be kept: the build schedules,
    // the learner's setting is on, and permission is already granted.
    const remindWhen = (permission: 'granted' | 'denied' | 'undetermined', enabled = true, available = true) =>
      trialTimeline({ offer: chosen(yearly(WEEK, true)), minutes, remind: trialReminderPromised({ available, enabled, permission }) });
    const promised = remindWhen('granted');
    assert.deepEqual(promised?.nodes.find((node) => node.title === 'Day 5'), { key: 'remind', title: 'Day 5', line: 'We will remind you two days before your trial ends.' });
    for (const refused of [remindWhen('denied'), remindWhen('undetermined'), remindWhen('granted', false), remindWhen('granted', true, false)]) {
      const middle = refused?.nodes.find((node) => node.key === 'remind' || node.key === 'cancel');
      assert.equal(middle?.key, 'cancel', 'a reminder is promised that will not be scheduled');
      // "Day 5" belongs to the reminder alone; the cancel step names its deadline.
      assert.equal(middle?.title, 'Before day 7');
    }
    // The constant is gone: the screen reads the hook's real state.
    assert.doesNotMatch(read('./trialTimeline.ts'), /TRIAL_REMINDER_SCHEDULED/, 'a reminder is promised by a constant');
    assert.match(read('./WallScreen.tsx'), /const trialReminder = useTrialReminder\(\);/);

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
    assert.match(screen, /const trial = trialTimeline\(\{\s*offer: chosen,\s*minutes: chosen === null \? null : storeTrialMinutes\(latestCatalogue\(\), chosen\.plan\),\s*remind: trialReminder\.promised,\s*\}\);/);
    assert.match(screen, /const offerView = chosen === null \? null : paywallOffer\(chosen, trial\);/);
    assert.match(screen, /paywallCta\(\{ offer: offerView, busy, morphLabel, notice \}\)/);
    assert.equal(paywallOffer(chosen(yearly(WEEK, true))!, view).cta, view.cta, 'the button does not say the trial\'s own call to action');
    assert.match(screen, /<WallPlansAtButton disclosure=\{offerView\?\.disclosure \?\? null\}/);
    const page = read('./WallPlansPage.tsx');
    assert.match(page, /\{trial !== null && <View style=\{st\.trialSummary\}>[\s\S]*?<TrialTimeline view=\{trial\} \/>/);
  });

  test('with a free trial chosen, no word of the trial is drawn larger than the billed price', () => {
    // Apple Guideline 3.1.2: the billed amount is the most prominent price on a
    // subscription page, and a free trial is said no larger than it. There is
    // no renderer, so this reads the sizes the source asks for.
    const page = read('./WallPlansPage.tsx');
    const parts = read('./WallParts.tsx');
    const theme = read('../theme.ts');
    const tokenSize = (token: string): number => Number(theme.match(new RegExp(`^\\s*${token}: \\{ fontFamily: [^}\\n]*fontSize: (\\d+)`, 'm'))![1]);
    const sizeOf = (source: string, name: string): number => {
      const at = source.match(new RegExp(`\\b${name}: \\{ \\.\\.\\.type\\.(\\w+)`));
      assert.ok(at, `${name} is not drawn from the type scale`);
      return tokenSize(at[1]!);
    };
    // A trial draws the billed amount bold inside its offer line; a standard
    // page draws it as its own price, the largest price text on the page.
    assert.match(page, /\{offer.lead\}<Text style=\{wallType.bold\}>\{offer.billed\}<\/Text>/, 'the trial does not draw the billed amount bold');
    assert.match(page, /<Text style=\{\[wallType.price, st.price, \{ color: colors.text \}\]\}>\{offer.billed\}<\/Text>/);
    assert.match(parts, /bold: \{ fontFamily: font.bold \}/);
    const billed = sizeOf(parts, 'body');
    for (const [source, name] of [[page, 'nodeTitle'], [page, 'nodeLine'], [parts, 'detail'], [parts, 'ctaLabel']] as const) {
      assert.ok(sizeOf(source, name) <= billed, `${name} is drawn larger than the billed amount`);
    }
    assert.ok(sizeOf(parts, 'price') > sizeOf(parts, 'detail'), 'the monthly figure is as large as the billed amount');
    // Each way to pay is titled by its billed amount, with how often and the
    // store's monthly figure under it, smaller.
    assert.equal(billedPrice('£179.99', 'year'), '£179.99 a year');
    assert.equal(billedPrice('£24.99', 'month'), '£24.99 a month');
    assert.equal(payDetail('year', '£15.00'), 'Yearly, about £15.00 a month');
    assert.equal(payDetail('year', null), 'Yearly');
    assert.equal(payDetail('month', null), 'Monthly');
  });
});
