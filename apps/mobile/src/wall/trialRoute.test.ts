/**
 * F932 (product review LR-26, founder decision 6): the trial page is redrawn in
 * Luvani's own form, a route through the first week with one of Luvani's scene
 * drawings, and keeps every fact the old timeline said.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { PLANS } from '@luvani/core';

import type { StoreIntroOffer, StoreProduct } from '../purchases/adapter.ts';
import * as paywall from './trialPaywall.ts';
import { trialTimeline } from './trialTimeline.ts';
import { chosenOffer, storeTrialMinutes, wallPlanRows } from './wallPlans.ts';

const page = readFileSync(new URL('./WallPlansPage.tsx', import.meta.url), 'utf8');
const WEEK: StoreIntroOffer = { priceString: '£0.00', periodUnit: 'WEEK', periodNumberOfUnits: 1, cycles: 1 };
const core = (intro: StoreIntroOffer): StoreProduct => ({
  plan: 'starter', productId: 'core_year', title: 'Luvani Core (store title)', localizedPrice: '£99.99', period: 'year', localizedPricePerMonth: '£8.33', intro, introEligible: true,
});
const view = (intro: StoreIntroOffer, remind: boolean) => {
  const offer = chosenOffer(wallPlanRows({ available: true, products: [], yearly: [core(intro)] }, PLANS), 'core_year')!;
  return trialTimeline({ offer, minutes: storeTrialMinutes(PLANS, 'starter'), remind })!;
};

test("the trial page walks the first week as a route with Luvani's own scene art", () => {
  const week = view(WEEK, false);
  // The title names the plan from Luvani's catalogue, and "week" only for a seven-day trial.
  assert.equal(week.title, 'Your first week with Core');
  assert.equal(view({ ...WEEK, periodNumberOfUnits: 2 }, false).title, 'Your first 14 days with Core');
  assert.equal(view({ ...WEEK, periodUnit: 'DAY', periodNumberOfUnits: 3 }, false).title, 'Your first 3 days with Core');

  // Stops on one path: today (sun), the week's scenes, the day to cancel by, the charge day.
  const stops = paywall.timelineRows(week) as ReadonlyArray<{ key: string; mark?: string; line: string }>;
  assert.deepEqual(stops.map(stop => stop.key), ['today', 'walk', 'cancel', 'then']);
  assert.deepEqual(stops.map(stop => stop.mark), ['start', 'stop', 'stop', 'end']);
  // The learning stop claims no number the code cannot prove.
  assert.doesNotMatch(stops[1]!.line, /\d|caf/i);

  // No glyph timeline is left: no glyph table, no icons on the page.
  assert.equal('TIMELINE_GLYPHS' in paywall, false, 'the lock, bell, calendar and star glyphs are still exported');
  assert.doesNotMatch(page, /<Icon\b|TIMELINE_GLYPHS/);
  // Luvani's cafe counter scene, drawn only on the trial page, through the shared Illustration component.
  assert.match(page, /offer\.kind === 'trial' && <View \{\.\.\.decorative\} style=\{st\.art\}>\s*<Illustration name="place-cafe-counter"/);
  assert.ok(page.indexOf('name="place-cafe-counter"') < page.indexOf('{offer.headline}'), 'the scene is not at the top of the trial page');
  // Theme colours only, and nothing moves beyond the shared stagger (which honours reduced motion).
  assert.match(page, /st\.route, \{ backgroundColor: b\.brand \}/);
  assert.doesNotMatch(page, /#[0-9A-Fa-f]{6}|Animated\./);
});

test('the redrawn trial page still names the charge date, the price, how to cancel and that nothing is charged today', () => {
  for (const remind of [false, true]) {
    const stops = paywall.timelineRows(view(WEEK, remind));
    const said = stops.map(stop => `${stop.title ?? ''} ${stop.line}`);
    assert.match(said[0]!, /^Today Core starts free\. Nothing is charged today\. During the trial: up to 70 minutes with your tutor\.$/);
    if (remind) assert.equal(said[2], 'Day 5 We will remind you two days before your trial ends.');
    else assert.equal(said[2], 'Before day 7 Cancel in your App Store settings before day 7 and you pay nothing.');
    assert.equal(said.at(-1), 'Day 7 Core continues at £99.99 a year.');
  }
  const offer = chosenOffer(wallPlanRows({ available: true, products: [], yearly: [core(WEEK)] }, PLANS), 'core_year')!;
  const trial = view(WEEK, false);
  const shown = paywall.paywallOffer(offer, trial);
  assert.equal(shown.headline, 'Your first week with Core');
  assert.equal(shown.cta, 'Start 7-day free trial');
  assert.equal(trial.terms, 'Free for 7 days, then £99.99 a year until you cancel.');
  assert.match(shown.disclosure, /£99\.99/);
  // No countdown, and Not now and the links stay with the button.
  assert.doesNotMatch(page, /countdown|setInterval/i);
  assert.match(page, /<WallLinks onRestore=\{onRestore\}/);
});
