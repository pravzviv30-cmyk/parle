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
import { PLAN_LABELS } from '../purchases/planStatus.ts';
import { PLANS_RENEWAL, WALL_COPY, WALL_LEAVE, PLANS_TRUST, TRIAL_TITLE, SUCCESS_TRIAL, YOURS_DECLINE, trialAllowance } from './wallCopy.ts';
import { CONVERSATION_MINUTES, conversationsAWeek, wallPlanRows, wallTrial } from './wallPlans.ts';

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
  period: 'month',
  intro: null,
  introEligible: false,
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
    for (const word of ['recommended', 'best value', 'most popular', 'save \\d', 'badge']) {
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
    // 7 October 2026, come alive README Part 5.G: the decline reads "Not now".
    assert.equal(WALL_LEAVE, 'Not now');
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

/**
 * 2026-09-27, notebook Phase 6-E: speaking time in units a learner can picture.
 *
 * Minutes a month is a number nobody can feel. A conversation is, so each plan
 * also reads as conversations a week, at a conversation length the page states
 * out loud. The count is derived here from the catalogue the server sent and is
 * always rounded down: the page may undersell a plan and may never oversell one.
 */
describe('plans read as conversations a week', () => {
  test('180 minutes a month is about four ten-minute conversations a week, and Max about seven', () => {
    assert.equal(CONVERSATION_MINUTES, 10, 'the stated conversation length moved, so every count on the page moved with it');
    const rows = wallPlanRows(offering(product('starter', '£14.99'), product('regular', '£24.99')), CATALOGUE);
    assert.ok(rows);
    // Starter: 180 min over 30 days is 180 * 7 / (30 * 10) = 4.2 a week, so four.
    // Max: 300 min over 30 days is 300 * 7 / (30 * 10) = 7.0 a week, so seven.
    assert.deepEqual(rows.map((row) => row.perWeek), [4, 7]);
  });

  test('the count is rounded down, so it never promises more than the minutes buy', () => {
    for (let minutes = 0; minutes <= 900; minutes += 5) {
      for (const days of [7, 28, 30, 31]) {
        const perWeek = conversationsAWeek(minutes, days);
        const exact = (minutes * 7) / (days * CONVERSATION_MINUTES);
        if (perWeek === null) {
          assert.ok(exact < 1, `${minutes} min over ${days} days buys ${exact} a week and the page said nothing`);
          continue;
        }
        assert.ok(perWeek <= exact, `${minutes} min over ${days} days is ${exact} a week and the page said ${perWeek}`);
        assert.ok(perWeek + 1 > exact, `${minutes} min over ${days} days is ${exact} a week and the page undersold it as ${perWeek}`);
      }
    }
    assert.equal(conversationsAWeek(180, null), null, 'a plan with no period has no week to count in');
    assert.equal(conversationsAWeek(180, 0), null);
  });

  test('the trial is shown in minutes, and is about three conversations', () => {
    assert.deepEqual(wallTrial(CATALOGUE), { minutes: 30, conversations: 3 });
    assert.equal(wallTrial(null), null, 'with no catalogue the trial was guessed');
  });

  test('no catalogue means no conversation count, rather than one guessed', () => {
    const rows = wallPlanRows(offering(product('starter', '£14.99')), null);
    assert.equal(rows?.[0]?.perWeek, null);
  });
});

describe('the wall is a page of the notebook', () => {
  test('the plans are separate chosen and unchosen cards with no highlighter or recommendation', () => {
    // 7 October 2026 (come alive, D16): each plan's ways to pay are the one
    // shared choice, which fills blue with a check when chosen and is white
    // with a hairline when not (components.tsx `Choice`), so the page keeps no
    // press or chosen style of its own.
    const page = code('./WallPlansPage.tsx');
    assert.equal((page.match(/rows.map\(/g) ?? []).length, 1);
    assert.equal((page.match(/row\.offers\.map\(/g) ?? []).length, 1);
    assert.match(page, /<Choice\s+key=\{offer\.productId\}\s+role="radio"/);
    assert.doesNotMatch(page, /<Press\b|<Pressable\b/, 'the plans page draws a press of its own beside the shared choice');
    assert.doesNotMatch(page, /recommended|best value|most popular|markDot|<Highlight|shadow/);
  });

  test('what you get is one card and ruled rows, with no place art', () => {
    const page = code('./WallYoursPage.tsx');
    const screen = code('./WallScreen.tsx');
    assert.equal((page.match(/<Ledger\b/g) ?? []).length, 1);
    assert.match(page, /YOURS_ROWS.map/);
    assert.match(page, /ADDS_ROWS.map/);
    assert.doesNotMatch(page, /st.ruled|borderBottomWidth|<Art|<Illustration/);
    assert.match(screen, /ground=\{page === 'yours' \? colour.sun : paper.ground\}/);
  });

  test('each plan says its conversations a week and its minutes, and the price is the store\'s', () => {
    const page = code('./WallPlansPage.tsx');
    assert.match(page, /row\.perWeek/, 'a plan does not say how many conversations a week it buys');
    assert.match(page, /row\.minutes/, 'a plan does not say its minutes');
    // 7 October 2026 (D16): each way to pay says the store's own price for its period.
    assert.match(page, /yearlyPrice\(offer\.price, offer\.perMonth\)/, 'a yearly price is not the store\'s own string');
    assert.match(page, /monthlyPrice\(offer\.price\)/, 'a monthly price is not the store\'s own string');
  });

  test('the renewal and the no-adverts line sit at the button', () => {
    // The pill is the frame's, in the footer, and the two lines a buyer is owed
    // right beside it ride in the same footer rather than somewhere up the page.
    const page = code('./WallPlansPage.tsx');
    const at = page.indexOf('export function WallPlansAtButton(');
    assert.notEqual(at, -1, 'there is no small print for the button');
    const button = page.slice(at);
    const body = page.slice(0, at);
    assert.match(button, /\{PLANS_RENEWAL\}/);
    assert.match(button, /\{PLANS_TRUST\}/);
    assert.doesNotMatch(body, /\{PLANS_RENEWAL\}|\{PLANS_TRUST\}/, 'the renewal or the trust line is up the page, away from the button');

    const screen = code('./WallScreen.tsx');
    const footer = screen.slice(screen.lastIndexOf('footer={'));
    const pill = footer.indexOf('<PillButton');
    const print = footer.indexOf('<WallPlansAtButton');
    assert.ok(pill !== -1 && print !== -1, 'the footer does not hold both the pill and its small print');
    assert.ok(pill < print, 'the small print is above the button rather than beside it');
    assert.match(footer, /page === 'plans' && <WallPlansAtButton/, 'the small print shows on a page that sells nothing');
  });
});

describe('a chosen plan says so to a screen reader', () => {
  test('the cards use the selected state this app already uses, not a radio', () => {
    // 7 October 2026, come alive README Part 5.G (D16): the ways to pay are the
    // one shared `Choice`, as a radio, which every option in the app now draws
    // through. This said "not a radio" because of F522: the page's own radio
    // said nothing on the web. `Choice` says its checked state on a device
    // (`accessibilityState`) and on the web (`aria-checked`), so the chosen
    // plan is still said both ways. The page itself writes no radio role or
    // checked state of its own.
    const page = code('./WallPlansPage.tsx');
    assert.match(page, /<Choice\s+key=\{offer\.productId\}\s+role="radio"/);
    assert.match(page, /selected=\{offer\.productId === selected\}/);
    const shared = readFileSync(fileURLToPath(new URL('../components.tsx', import.meta.url)), 'utf8');
    const choice = shared.slice(shared.indexOf('export function Choice('), shared.indexOf('const ic = StyleSheet.create('));
    assert.match(choice, /accessibilityState=\{radio \? \{ checked: selected \} : \{ selected \}\}/, 'the shared choice does not say it is chosen on a device');
    assert.match(choice, /aria-checked=\{radio \? selected : undefined\}/, 'the shared choice does not say it is chosen on the web');
    assert.match(page, /accessibilityLabel=\{\[row\.name, period, price\]\.join\(', '\)\}/);
    // The spoken price includes its billing period, because the price line always does.
    assert.match(page, /const period = offer\.period === 'year' \? PLAN_YEARLY : PLAN_MONTHLY;/);
    assert.match(page, /const price = offer\.period === 'year' \? yearlyPrice\(offer\.price, offer\.perMonth\) : monthlyPrice\(offer\.price\);/);
    assert.doesNotMatch(page, /accessibilityRole="radio"|checked:|markDot/);
  });

  // 7 October 2026, P4-C review: the successor of the test above, whose pinned
  // title (F607) still says "not a radio" while the rows are radios now. The
  // integrator moves F607's verified-by here; the old title retires then.
  test('a chosen way to pay says it is checked on a device and on the web', () => {
    const page = code('./WallPlansPage.tsx');
    // One radio group of the shared choice, each way to pay a radio of its own.
    assert.match(page, /<View accessibilityRole="radiogroup"/);
    assert.match(page, /<Choice\s+key=\{offer\.productId\}\s+role="radio"/);
    assert.match(page, /selected=\{offer\.productId === selected\}/);
    // The shared choice says checked on a device and on the web, and the page
    // writes no role or state of its own beside it.
    const shared = readFileSync(fileURLToPath(new URL('../components.tsx', import.meta.url)), 'utf8');
    const choice = shared.slice(shared.indexOf('export function Choice('), shared.indexOf('const ic = StyleSheet.create('));
    assert.match(choice, /accessibilityRole=\{role\}/);
    assert.match(choice, /accessibilityState=\{radio \? \{ checked: selected \} : \{ selected \}\}/, 'the shared choice does not say it is chosen on a device');
    assert.match(choice, /aria-checked=\{radio \? selected : undefined\}/, 'the shared choice does not say it is chosen on the web');
    assert.doesNotMatch(page, /accessibilityRole="radio"|accessibilityState=|aria-checked|aria-selected/);
    // What a screen reader hears names the plan, how often, and the price with its period.
    assert.match(page, /accessibilityLabel=\{\[row\.name, period, price\]\.join\(', '\)\}/);
    assert.match(page, /const period = offer\.period === 'year' \? PLAN_YEARLY : PLAN_MONTHLY;/);
    assert.match(page, /const price = offer\.period === 'year' \? yearlyPrice\(offer\.price, offer\.perMonth\) : monthlyPrice\(offer\.price\);/);
  });
});

/**
 * Come alive, README Part 5.G (7 October 2026): what sits around the plans.
 */
describe('the plans page around its plans', () => {
  test('the documents and the restore are one row of icon actions, and the renewal covers a month and a year', () => {
    const page = code('./WallPlansPage.tsx');
    assert.match(page, /<IconAction layout="inline" icon="privacy" label=\{PLANS_PRIVACY\} onPress=\{onOpenPolicy\} \/>/);
    assert.match(page, /<IconAction layout="inline" icon="document" label=\{PLANS_TERMS\} onPress=\{onOpenTerms\} \/>/);
    assert.match(page, /<IconAction layout="inline" icon="refresh" label=\{PLANS_RESTORE\} onPress=\{onRestore\} \/>/);
    assert.doesNotMatch(page, /<GhostButton label=\{PLANS_(PRIVACY|TERMS|RESTORE)\}/, 'a document is still a bare link beside the icon row');
    assert.match(PLANS_RENEWAL, /every month or every year/, 'the renewal line says only one of the two periods on sale');
  });

  test('page one says Keep practising free only when there is a plan to decline', () => {
    const yours = code('./WallYoursPage.tsx');
    assert.match(yours, /\{canBuy && \([\s\S]*?<GhostButton label=\{YOURS_DECLINE\} onPress=\{onLeave\} \/>/);
    assert.equal(YOURS_DECLINE, 'Keep practising free');
    assert.match(code('./WallScreen.tsx'), /<WallYoursPage canBuy=\{storeHasPlans\} onLeave=\{\(\) => leave\(\)\} \/>/);
  });

  test("the thirty metered minutes are free minutes, and a free trial is only the store's", () => {
    assert.equal(PLAN_LABELS.trial, 'Free minutes');
    assert.equal(trialAllowance(30, 3), 'You start with 30 free minutes, about 3 conversations.');
    // Only the store trial's own lines say "free trial".
    const said = WALL_COPY.filter((line) => /free trial/i.test(line));
    assert.deepEqual(said, [TRIAL_TITLE, SUCCESS_TRIAL]);
  });
});
