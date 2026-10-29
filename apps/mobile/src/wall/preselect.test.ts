/**
 * The plans page chooses for the learner once, and says so nowhere (F772,
 * founder decision D16, come alive README Part 5.G).
 *
 * The yearly product of the cheapest plan whose minutes a day cover the
 * learner's own daily goal arrives chosen. That is the page's suggestion, not
 * the learner's choice, so it fires no `plan_selected`: the funnel still means
 * "the learner chose". Every number it reads is the server's catalogue and the
 * store's products; with no catalogue, nothing is chosen.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { PLANS } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import type { PaidPlan, StoreOffering, StoreProduct } from '../purchases/adapter.ts';
import { goalFitLine } from './wallCopy.ts';
import { chosenOffer, dailyMinutes, preselectedOffer, wallPlanRows, wallSuggestion, type GoalRead } from './wallPlans.ts';
import { effectiveSelection } from './trialPaywall.ts';

const product = (plan: PaidPlan, period: 'month' | 'year', price: string, perMonth: string | null = null): StoreProduct => ({
  plan,
  productId: `luvani_${plan}_${period}`,
  title: 'Store title',
  localizedPrice: price,
  period,
  localizedPricePerMonth: perMonth,
  intro: null,
  introEligible: false,
});

const monthly = [product('starter', 'month', '£14.99'), product('regular', 'month', '£24.99')];
const yearly = [product('starter', 'year', '£119.99', '£10.00'), product('regular', 'year', '£179.99', '£15.00')];
const offering: StoreOffering = { available: true, products: monthly, yearly };
const FREE = { plan: 'trial', lapsed: false } as const;

const screen = readFileSync(new URL('./WallScreen.tsx', import.meta.url), 'utf8');

describe('the plans page chooses once, for a learner with a goal', () => {
  test('the plans page suggests the same plan however its data arrives', () => {
    const rows = wallPlanRows(offering, PLANS);
    assert.ok(rows);
    // WallScreen locks in the first suggestion it sees (the learner has not chosen).
    const settle = (steps: readonly { goal: GoalRead; status: typeof FREE | null }[]) => {
      let selected: string | null = null;
      for (const step of steps) {
        const suggestion = wallSuggestion(rows, step.goal, step.status);
        if (selected === null && suggestion !== null) selected = suggestion;
      }
      return effectiveSelection(rows, selected, null);
    };
    const unread: GoalRead = { loaded: false, target: null };
    for (const target of [null, 10, 20]) {
      const goal: GoalRead = { loaded: true, target };
      const statusFirst = settle([{ goal: unread, status: null }, { goal: unread, status: FREE }, { goal, status: FREE }]);
      const goalFirst = settle([{ goal: unread, status: null }, { goal, status: null }, { goal, status: FREE }]);
      const together = settle([{ goal, status: FREE }]);
      assert.equal(statusFirst, goalFirst, `goal ${target}: the plan depended on which read landed first`);
      assert.equal(statusFirst, together, `goal ${target}: the plan depended on which read landed first`);
    }
    // No goal: nothing is suggested, so the page shows its default, Core yearly.
    assert.equal(settle([{ goal: { loaded: true, target: null }, status: FREE }]), 'luvani_starter_year');
    assert.equal(settle([{ goal: { loaded: true, target: 20 }, status: FREE }]), 'luvani_regular_year');
  });

  test("the plans page pre-selects the yearly plan that covers the learner's goal and fires no selection event", () => {
    const rows = wallPlanRows(offering, PLANS);
    assert.ok(rows);
    // Each plan is paid yearly or monthly, yearly first, every price the store's.
    assert.deepEqual(rows.map((row) => row.offers.map((offer) => [offer.productId, offer.period, offer.price])), [
      [['luvani_starter_month', 'month', '£14.99'], ['luvani_starter_year', 'year', '£119.99']],
      [['luvani_regular_month', 'month', '£24.99'], ['luvani_regular_year', 'year', '£179.99']],
    ]);
    // Minutes a day from the server's catalogue, rounded down (REV-001): Core
    // 300 over 30 days is 10, Max 600 over 30 days is 20.
    assert.deepEqual(rows.map((row) => row.daily), [10, 20]);
    assert.equal(dailyMinutes(180, null), null, 'a plan with no period has no day to divide by');

    // The cheapest plan that covers the goal, paid yearly.
    assert.equal(preselectedOffer(rows, 20, FREE)?.productId, 'luvani_regular_year');
    assert.equal(preselectedOffer(rows, 15, FREE)?.productId, 'luvani_regular_year');
    assert.equal(preselectedOffer(rows, 10, FREE)?.productId, 'luvani_starter_year', 'a dearer plan was chosen when a cheaper one covers the goal');
    // No goal, or a goal no plan covers: nothing is chosen.
    // F907 (2026-10-29): no goal used to answer Core monthly, which flipped the page's plan as its reads landed.
    assert.equal(preselectedOffer(rows, null, FREE), null);
    assert.equal(preselectedOffer(rows, 25, FREE), null);
    // A learner who holds a paid plan came to manage it, and is not steered; a lapsed one may be.
    assert.equal(preselectedOffer(rows, 10, { plan: 'starter', lapsed: false }), null);
    assert.equal(preselectedOffer(rows, 10, { plan: 'regular', lapsed: false }), null);
    assert.equal(preselectedOffer(rows, 20, { plan: 'starter', lapsed: true })?.productId, 'luvani_regular_year');
    // The covering plan not sold yearly: nothing, never the monthly in its place.
    assert.equal(preselectedOffer(wallPlanRows({ available: true, products: monthly }, PLANS), 20, FREE), null);
    // No catalogue from the server: no minutes a day, so nothing is chosen.
    assert.equal(preselectedOffer(wallPlanRows(offering, null), 10, FREE), null);

    // What is chosen is a product, named for its plan.
    assert.deepEqual(chosenOffer(rows, 'luvani_regular_year'), {
      plan: 'regular', productId: 'luvani_regular_year', period: 'year', price: '£179.99', perMonth: '£15.00', annualSavingsPercent: null, trialDays: null, hasFreeTrial: false, name: PLANS.regular.label,
    });
    assert.equal(chosenOffer(rows, 'luvani_gone'), null);
    assert.equal(chosenOffer(rows, null), null);

    // The goal line says what fits, or what covers the rest, in the learner's own goal.
    assert.equal(goalFitLine(10, 10), 'Fits your 10-minute daily goal.');
    assert.equal(goalFitLine(15, 10), 'About 10 minutes of conversation a day. Free practice covers the rest of your 15-minute goal.');
    for (const goal of [5, 10, 15, 20]) for (const daily of [6, 10]) assert.equal(guiltIn(goalFitLine(goal, daily)), undefined);

    // The screen applies the suggestion with setSelected alone, once, while
    // nothing is chosen and the learner has not chosen, after the server has
    // said what they hold. `plan_selected` is fired only by a tap.
    const at = screen.indexOf('const suggestion = ');
    const effect = screen.slice(at, screen.indexOf('}, [suggestion, selected]);', at));
    // F907: the suggestion waits for both the goal and the status (`wallSuggestion`).
    assert.match(effect, /const suggestion = wallSuggestion\(planRows, goal, status, entry === 'locked' \? feature : null, entry === 'locked' && unlock === 'collections' \? 'starter' : null\);/);
    assert.match(effect, /if \(touched\.current \|\| selected !== null \|\| suggestion === null\) return;\s*setSelected\(suggestion\);/);
    assert.doesNotMatch(effect, /trackProductEvent|plan_selected/, 'the suggestion records a selection');
    assert.equal((screen.match(/name: 'plan_selected'/g) ?? []).length, 1, 'a selection is recorded somewhere other than the tap');
    const tap = screen.slice(screen.indexOf('onSelect={(offer) => {'), screen.indexOf("name: 'plan_selected'"));
    assert.match(tap, /touched\.current = true;\s*setSelected\(offer\.productId\);/, 'a tap does not stop the page choosing again');
    assert.match(screen, /const goal: GoalRead = \{ loaded: game\.view !== null \|\| game\.failed, target: game\.view\?\.goal\?\.target \?\? null \};/, 'the goal is not the learner\'s own, or is read before the game layer answers');
    // Above every early return, so the hooks run in one order on every render.
    assert.ok(at > 0 && at < screen.indexOf('if (!ownsWall) return ('), 'the suggestion sits below an early return');

    // Run the effect's own lines: the suggestion lands once, and never over a choice.
    const body = effect.slice(effect.indexOf('if (touched.current'));
    const run = (world: { touched: boolean; selected: string | null; suggestion: string | null }) => {
      const chosen: string[] = [];
      new Function('touched', 'selected', 'suggestion', 'setSelected', body)({ current: world.touched }, world.selected, world.suggestion, (id: string) => chosen.push(id));
      return chosen;
    };
    assert.deepEqual(run({ touched: false, selected: null, suggestion: 'luvani_regular_year' }), ['luvani_regular_year']);
    assert.deepEqual(run({ touched: true, selected: null, suggestion: 'luvani_regular_year' }), [], 'the page chose over the learner');
    assert.deepEqual(run({ touched: false, selected: 'luvani_starter_month', suggestion: 'luvani_regular_year' }), []);
    assert.deepEqual(run({ touched: false, selected: null, suggestion: null }), []);
  });
});
