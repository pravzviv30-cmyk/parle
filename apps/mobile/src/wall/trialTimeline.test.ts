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

  test('with a free trial chosen, no word of the trial is drawn larger than the billed price', () => {
    // Apple Guideline 3.1.2: the billed amount is the most prominent price on a
    // subscription page, and a free trial is said no larger than it. The
    // billed amount is in the trial's terms at the pill and is each way to
    // pay's own title. apps/mobile has no renderer, so this reads the sizes
    // the source asks for from the type scale it asks them of.
    const theme = read('../theme.ts');
    const scale = theme.slice(theme.indexOf('export const type = {'), theme.indexOf('} as const;', theme.indexOf('export const type = {')));
    const sizes = new Map([...scale.matchAll(/^\s*(\w+): \{ fontFamily: [^}\n]*fontSize: (\d+)/gm)].map((m) => [m[1]!, Number(m[2])]));
    const size = (token: string): number => {
      const at = sizes.get(token);
      assert.ok(at !== undefined, `type.${token} has no size the test can read`);
      return at;
    };

    const page = read('./WallPlansPage.tsx');
    const sheet = page.slice(page.indexOf('const st = StyleSheet.create({'));
    const styles = new Map([...sheet.matchAll(/^\s*(\w+): \{ \.\.\.type\.(\w+)([^\n]*)\},?$/gm)].map((m) => [m[1]!, { token: m[2]!, rest: m[3]! }]));
    const style = (name: string) => {
      const at = styles.get(name);
      assert.ok(at, `st.${name} is not drawn from the type scale`);
      return at;
    };

    // The terms at the pill carry the billed amount, in ink and weight.
    const button = page.slice(page.indexOf('export function WallPlansAtButton('), page.indexOf('const DISC ='));
    assert.match(button, /\{trialTerms !== null && <Text style=\{st\.terms\}>\{trialTerms\}<\/Text>\}/, 'the trial terms are not drawn at the pill');
    const terms = style('terms');
    assert.match(terms.rest, /color: paper\.ink\b/, 'the billed amount at the pill is in a quiet colour');
    assert.ok(size(terms.token) >= size('bodyStrong'), 'the billed amount at the pill is small print');

    // Every word the timeline draws is no larger than those terms.
    const timeline = page.slice(page.indexOf('function TrialTimeline('), page.indexOf('export function WallPlansAtButton('));
    const drawn = [...timeline.matchAll(/<Text\b[^>]*style=\{st\.(\w+)\}/g)].map((m) => m[1]!);
    assert.deepEqual([...new Set(drawn)].sort(), ['nodeLine', 'nodeTitle', 'trialTitle'], 'the timeline draws a line this test does not weigh');
    for (const name of drawn) {
      assert.ok(size(style(name).token) <= size(terms.token), `st.${name} (type.${style(name).token}) is larger than the billed amount`);
    }
    // The pill's own words ("Start 7-day free trial") are no larger either.
    const shared = read('../components.tsx');
    const pill = shared.slice(shared.indexOf('export function PillButton('), shared.indexOf('export function', shared.indexOf('export function PillButton(') + 1));
    assert.match(pill, /<Text style=\{\[type\.button,/);
    assert.ok(size('button') <= size(terms.token), 'the free trial pill is larger than the billed amount');

    // Each way to pay is titled by its billed amount, with how often and the
    // store's monthly figure under it, smaller.
    assert.match(page, /const billed = billedPrice\(offer\.price, offer\.period\);/);
    assert.match(page, /title=\{billed\}\s+detail=\{payDetail\(offer\.period, offer\.perMonth\)\}/);
    const choice = shared.slice(shared.indexOf('export function Choice('), shared.indexOf('const ic = StyleSheet.create('));
    assert.match(choice, /compact \? type\.label : type\.bodyStrong/);
    assert.match(choice, /<Text style=\{\[type\.small, \{ color: quiet \}/);
    assert.ok(size('label') > size('small'), 'the store\'s monthly figure is as large as the billed amount');
    assert.equal(billedPrice('£179.99', 'year'), '£179.99 a year');
    assert.equal(billedPrice('£24.99', 'month'), '£24.99 a month');
    assert.equal(payDetail('year', '£15.00'), 'Yearly, about £15.00 a month');
    assert.equal(payDetail('year', null), 'Yearly');
    assert.equal(payDetail('month', null), 'Monthly');
  });
});
