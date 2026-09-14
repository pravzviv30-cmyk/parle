/**
 * Page four: two plans, and every number on it off the wire.
 *
 * The two tests worth reading are the last ones. One holds the page to exactly
 * what the store is selling, which is the refusal of the decoy the third video
 * recommends: a decoy is a plan that exists in order not to be bought, and this
 * page cannot invent one because it has nothing to invent from. The other holds
 * the softness the same video is right about, and which this wall had without
 * ever saying so.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import { PLANS, type Plan, type PlanSpec } from '@luvani/core';

import type { PaidPlan, StoreOffering, StoreProduct } from '../purchases/adapter.ts';
import { WALL_LEAVE, PLANS_TRUST } from './wallCopy.ts';
import { wallPlanRows } from './wallPlans.ts';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/**
 * A file with its prose removed.
 *
 * Every scan below reads this. The modules explain at length which words they
 * deliberately do NOT use, so a scan that reads comments is satisfied by the
 * explanation instead of the absence. This has now caught itself three times in
 * this feature, which is why it is a named helper rather than an inline replace.
 */
const code = (relative: string): string =>
  read(relative).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const product = (plan: PaidPlan, localizedPrice: string, title = 'Store title'): StoreProduct => ({
  plan,
  productId: `luvani_${plan}_monthly`,
  title,
  localizedPrice,
});

const offering = (...products: StoreProduct[]): StoreOffering => ({ available: true, products });
const CATALOGUE: Record<Plan, PlanSpec> = PLANS;

describe('nothing to sell means no plans page at all', () => {
  test('an unavailable store, an empty list and a blank price all answer null', () => {
    // Null here is what makes the whole wall shippable before a RevenueCat key
    // exists: wallPages asks the same question, the plans page never enters the
    // list, and the wall ends on the free promise instead.
    assert.equal(wallPlanRows({ available: false }, CATALOGUE), null);
    assert.equal(wallPlanRows(offering(), CATALOGUE), null);
    assert.equal(wallPlanRows(offering(product('starter', '  ')), CATALOGUE), null);
  });
});

describe('every number comes off the wire', () => {
  test('the price is the store\'s own string, character for character', () => {
    const rows = wallPlanRows(offering(product('starter', '£14,99 / mois')), CATALOGUE);
    assert.ok(rows);
    assert.equal(rows[0]?.price, '£14,99 / mois', 'the page reformatted a localised price');
  });

  test('the allowance is the catalogue\'s, in whole minutes', () => {
    const rows = wallPlanRows(offering(product('starter', '£14.99'), product('regular', '£24.99')), CATALOGUE);
    assert.ok(rows);
    assert.deepEqual(
      rows.map((row) => row.minutes),
      [PLANS.starter.secondsPerPeriod / 60, PLANS.regular.secondsPerPeriod / 60],
      'the minutes are not the ones the server sent',
    );
  });

  test('no catalogue means no allowance shown, rather than an allowance guessed', () => {
    // The one number on this page that could disagree with the meter. A learner
    // who has never started a session has no catalogue, and the card says what
    // it can without one.
    const rows = wallPlanRows(offering(product('starter', '£14.99')), null);
    assert.ok(rows);
    assert.equal(rows[0]?.minutes, null);
    assert.equal(rows[0]?.price, '£14.99', 'the price went with the allowance');
  });

  test('the name is ours, and the store\'s only when we have none', () => {
    const withCatalogue = wallPlanRows(offering(product('regular', '£24.99', 'Luvani Max Monthly')), CATALOGUE);
    assert.equal(withCatalogue?.[0]?.name, PLANS.regular.label, 'the shop window name won over ours');
    const without = wallPlanRows(offering(product('regular', '£24.99', 'Luvani Max Monthly')), null);
    assert.equal(without?.[0]?.name, 'Luvani Max Monthly', 'with no catalogue there was no name at all');
  });

  test('the module carries no price and does no formatting of its own', () => {
    const module = code('./wallPlans.ts');
    assert.doesNotMatch(module, /[$€£]/, 'a currency symbol reached the decision module');
    assert.doesNotMatch(module, /toFixed|toLocaleString|Intl\./, 'the module is formatting a number the store already formatted');
  });
});

describe('cheapest first, and exactly what the store is selling', () => {
  test('the order is the offer, whatever order the store answered in', () => {
    const rows = wallPlanRows(offering(product('regular', '£24.99'), product('starter', '£14.99')), CATALOGUE);
    assert.deepEqual(rows?.map((row) => row.plan), ['starter', 'regular']);
  });

  test('a store selling one tier draws one card, not a gap and not a decoy', () => {
    // The third video recommends a decoy: a plan whose job is to make another
    // look better. There is nothing to build one out of here, and that is the
    // point rather than a limitation. The two real tiers already anchor each
    // other truthfully, because Max is genuinely the better rate per minute.
    const rows = wallPlanRows(offering(product('regular', '£24.99')), CATALOGUE);
    assert.equal(rows?.length, 1);
    assert.equal(rows?.[0]?.plan, 'regular');

    const perMinute = (plan: 'starter' | 'regular') => PLANS[plan].priceUsd / (PLANS[plan].secondsPerPeriod / 60);
    assert.ok(
      perMinute('regular') < perMinute('starter'),
      'the dearer tier stopped being the better rate, so the two no longer anchor each other honestly',
    );
  });

  test('nothing is marked recommended, best value or most popular', () => {
    const page = code('./WallPlansPage.tsx');
    // A selected-state tick and the factual trust row are interface feedback,
    // not an invented endorsement. What stays forbidden is recommendation
    // language, crowd claims and a saving the store never calculated.
    for (const word of ['recommended', 'best value', 'most popular', 'save \\d', 'learners chose', 'people chose']) {
      assert.doesNotMatch(page, new RegExp(word, 'i'), `the page is nudging with "${word}"`);
    }
  });
});

describe('the wall says out loud that it is soft', () => {
  test('declining is a visible choice on the page that asks for money', () => {
    // It was always possible -- the chevron goes back and the wall never blocks --
    // but a chevron in the corner reads as navigation rather than as an answer.
    const page = read('./WallPlansPage.tsx');
    assert.match(page, /label=\{WALL_LEAVE\}/, 'the plans page offers no visible way to decline');
    assert.match(page, /onPress=\{onLeave\}/);
    assert.equal(WALL_LEAVE, 'Maybe later');
  });

  test('the one trust line says two things that are already true', () => {
    // Not social proof. Luvani has nobody to count, and a number it does not have
    // is the claim the founder ruled out.
    assert.match(PLANS_TRUST, /no adverts/i);
    assert.doesNotMatch(PLANS_TRUST, /\d|join|people|learners|users|rated/i, 'the trust line counts somebody');
    assert.match(read('./WallPlansPage.tsx'), /\{PLANS_TRUST\}/, 'the trust line is written and rendered nowhere');
  });

  test('the subscription terms are on the surface that sells it', () => {
    const page = read('./WallPlansPage.tsx');
    // Apple Guideline 3.1.2 wants the length, the renewal and both documents on
    // the purchase screen itself, and a learner is owed them either way.
    for (const name of ['PLANS_RENEWAL', 'PLANS_PRIVACY', 'PLANS_TERMS', 'PLANS_RESTORE']) {
      assert.match(page, new RegExp(`\\{${name}\\}`), `the purchase surface is missing ${name}`);
    }
  });
});

describe('a chosen plan says so to a screen reader', () => {
  test('the cards use the selected state this app already uses, not a radio', () => {
    const page = code('./WallPlansPage.tsx');
    // OptionCard and TabBar both announce a chosen thing with a button role and a
    // `selected` state. `accessibilityRole="radio"` with `checked` is not mapped
    // by React Native Web, so both cards reported no state at all and a screen
    // reader could not tell which plan was picked. Caught in a browser, not here.
    assert.match(page, /accessibilityState=\{\{ selected: chosen \}\}/);
    assert.doesNotMatch(page, /accessibilityRole="radio"/, 'the plan cards went back to a role that announces nothing');
    assert.match(page, /accessibilityLabel=\{row\.name\}/, 'a plan card has no name for a screen reader');
  });
});
