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
import { PAYWALL_RENEWS, PLANS_RENEWAL, WALL_COPY, WALL_LEAVE, PLANS_TRUST, standardDisclosure, trialDisclosure, trialTitle, SUCCESS_TRIAL, YOURS_DECLINE, trialAllowance } from './wallCopy.ts';
import { CONVERSATION_MINUTES, conversationsAWeek, wallPlanRows, wallTrial, offerForTier } from './wallPlans.ts';

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
    // A regex end anchor is syntax, not a dollar price. Inspect string literals
    // while preserving the ban on compiled currency amounts or symbols.
    const currencyLiterals = (source: string) => (source.match(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g) ?? [])
      .filter(literal => /[€£]|\$(?!\{)/.test(literal));
    assert.deepEqual(currencyLiterals(module), [], 'a currency literal reached the decision module');
    assert.deepEqual(currencyLiterals('const currency = /^[A-Z]{3}$/;'), [], 'regex syntax was read as a price');
    for (const symbol of ['$', '€', '£']) {
      for (const quote of ["'", '"', '`']) {
        assert.equal(currencyLiterals(`const price = ${quote}${symbol}19.99${quote};`).length, 1, 'a compiled price escaped the source check');
        assert.equal(currencyLiterals(`const symbol = ${quote}${symbol}${quote};`).length, 1, 'a compiled currency symbol escaped the source check');
      }
    }
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
    const page = read('./WallScreen.tsx');
    // 19 October 2026, "P2 · Luvani": the decline is the close mark in the top row, a 44pt target.
    assert.match(page, /header=\{<WallTopRow onPress=\{\(\) => leave\(\)\} \/>\}/, 'the plans header offers no visible way to decline');
    assert.match(code('./WallParts.tsx'), /accessibilityLabel="Close" style=\{st\.close\}/);
    assert.match(code('./WallParts.tsx'), /close: \{ width: HIT, height: HIT/);
    // 7 October 2026, come alive README Part 5.G: the decline reads "Not now".
    assert.equal(WALL_LEAVE, 'Not now');
    // 20 October 2026, D24: the wall now opens on launch and on a locked feature,
    // so "Not now" is also drawn in words under the plans, with the same leave().
    assert.match(page, /\{page === 'plans' && <WallTextLink label=\{WALL_LEAVE\} onPress=\{\(\) => leave\(\)\} \/>\}/, 'the plans page has no "Not now" in words');
    assert.match(page, /header=\{<WallTopRow onPress=\{\(\) => leave\(\)\} \/>\}/, 'the close mark went when "Not now" arrived');
  });

  test('the one trust line says two things that are already true', () => {
    // Not social proof. Luvani has nobody to count, and a number it does not have
    // is the claim the founder ruled out.
    assert.equal(PLANS_TRUST, 'No Commitment, Cancel Anytime');
    assert.doesNotMatch(PLANS_TRUST, /\d|join|people|learners|users|rated/i, 'the trust line counts somebody');
    // 19 October 2026: the approved trial paywall drops the line from the wall;
    // the inline paywall in the out-of-minutes card still says it.
    assert.match(read('../purchases/paywallView.ts'), /trust: PLANS_TRUST/, 'the trust line is written and rendered nowhere');
    assert.doesNotMatch(code('./WallPlansPage.tsx') + code('./WallScreen.tsx'), /PLANS_TRUST/, 'the approved paywall removed the trust line');
  });

  test('the subscription terms are on the surface that sells it', () => {
    const page = read('./WallPlansPage.tsx');
    // Apple Guideline 3.1.2 wants the length, the renewal and both documents on
    // the purchase screen itself, and a learner is owed them either way.
    // 19 October 2026: the renewal rides in the disclosure under the button,
    // and the documents and the restore are the links row (WallParts.WallLinks).
    assert.match(page, /\{disclosure\}/, 'the purchase surface is missing the disclosure');
    assert.match(page, /<WallLinks onRestore=\{onRestore\}/);
    const parts = code('./WallParts.tsx');
    for (const name of ['PAYWALL_RESTORE', 'PLANS_TERMS', 'PLANS_PRIVACY']) assert.match(parts, new RegExp(`link\\(${name},`), `the links row is missing ${name}`);
    for (const said of [trialDisclosure(7, '£99.99', 'year'), standardDisclosure('£99.99', 'year'), standardDisclosure('£9.99', 'month')]) {
      assert.ok(said.endsWith(PAYWALL_RENEWS), `the disclosure does not say it renews: ${said}`);
      assert.match(said, /£\d/, 'the disclosure does not carry the billed amount');
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
  test('300 minutes a month is about seven ten-minute conversations a week, and Max about fourteen', () => {
    assert.equal(CONVERSATION_MINUTES, 10, 'the stated conversation length moved, so every count on the page moved with it');
    const rows = wallPlanRows(offering(product('starter', '£14.99'), product('regular', '£24.99')), CATALOGUE);
    assert.ok(rows);
    // Core: 300 min over 30 days is 300 * 7 / (30 * 10) = 7.0 a week, so seven.
    // Max: 600 min over 30 days is 600 * 7 / (30 * 10) = 14.0 a week, so fourteen.
    assert.deepEqual(rows.map((row) => row.perWeek), [7, 14]);
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

  test('the free plan is one whole ten-minute conversation (REV-001)', () => {
    assert.deepEqual(wallTrial(CATALOGUE), { minutes: 10, conversations: 1 });
    assert.equal(wallTrial(null), null, 'with no catalogue the trial was guessed');
  });

  test('no catalogue means no conversation count, rather than one guessed', () => {
    const rows = wallPlanRows(offering(product('starter', '£14.99')), null);
    assert.equal(rows?.[0]?.perWeek, null);
  });
});

describe('the wall is a page of the notebook', () => {
  test('the plans are separate chosen and unchosen cards with no highlighter or recommendation', () => {
    // The approved revision uses a compact period switch and retains the quiet
    // tier comparison. Both still choose actual store offers without buying.
    const page = code('./WallPlansPage.tsx');
    const periods = code('./WallPeriodSwitch.tsx');
    assert.match(page, /<WallPeriodSwitch offers=\{visibleRow\.offers\} name=\{visibleRow\.name\} selected=\{selected\} onSelect=\{onSelect\}/);
    assert.match(page, /onSelect\(offer\); setComparing\(false\)/);
    assert.match(page, /<Press key=\{card.plan\} haptic="selection" accessibilityRole="radio"/);
    assert.match(periods, /onPress=\{\(\) => onSelect\(offer\)\}/);
    assert.doesNotMatch(page + periods, /recommended|best value|most popular|markDot|<Highlight|shadow/);
  });

  test('the value page distinguishes what stays free from what a plan adds', () => {
    const page = code('./WallYoursPage.tsx');
    const screen = code('./WallScreen.tsx');
    assert.match(page, /YOURS_FREE_TITLE/);
    assert.match(page, /ADDS_TITLE/);
    assert.match(page, /YOURS_ROWS.map/);
    assert.match(page, /ADDS_ROWS.map/);
    assert.doesNotMatch(page, /st.ruled|borderBottomWidth/);
    assert.match(screen, /ground=\{colors\.background\}/);
  });

  test('each plan says its actual minutes once, and the price is the store\'s', () => {
    const page = code('./WallPlansPage.tsx');
    assert.doesNotMatch(page, /perWeekLine\(row\.perWeek\)/, 'the plan repeats its minutes as an estimated conversation count');
    assert.match(page, /planLine\(visibleRow, current, catalogue\)/, 'a plan does not say its verified minutes');
    const view = code('./trialPaywall.ts');
    assert.match(view, /const minutes = offerMinutes\(row, offer\);/, 'the plan line is not the verified minutes');
    // 7 October 2026 (D16): each way to pay says the store's own price for its period.
    assert.match(view, /const billed = billedPrice\(offer\.price, offer\.period\);/, 'the selected billed amount is not the store\'s own string and period');
    assert.match(view, /billedYearlyAbout\(offer\.perMonth\)/, 'the annual equivalent is not the store\'s own monthly string');
  });

  test('the renewal and the no-adverts line sit at the button', () => {
    // The pill is the frame's, in the footer, and the two lines a buyer is owed
    // right beside it ride in the same footer rather than somewhere up the page.
    const page = code('./WallPlansPage.tsx');
    const at = page.indexOf('export function WallPlansAtButton(');
    assert.notEqual(at, -1, 'there is no small print for the button');
    const button = page.slice(at);
    const body = page.slice(0, at);
    assert.match(button, /\{disclosure\}/);
    assert.doesNotMatch(body, /\{disclosure\}|disclosure\b/, 'the renewal is up the page, away from the button');

    const screen = code('./WallScreen.tsx');
    const footer = screen.slice(screen.lastIndexOf('footer={'));
    const pill = footer.indexOf('<WallCta');
    const print = footer.indexOf('<WallPlansAtButton');
    assert.ok(pill !== -1 && print !== -1, 'the footer does not hold both the pill and its small print');
    assert.ok(pill < print, 'the small print is above the button rather than beside it');
    assert.match(footer, /page === 'plans' && <WallPlansAtButton/, 'the small print shows on a page that sells nothing');
  });
});

describe('a chosen plan says so to a screen reader', () => {
  test('the cards use the selected state this app already uses, not a radio', () => {
    const page = code('./WallPlansPage.tsx');
    const periods = code('./WallPeriodSwitch.tsx');
    assert.match(page, /<WallPeriodSwitch offers=\{visibleRow\.offers\} name=\{visibleRow\.name\} selected=\{selected\} onSelect=\{onSelect\}/);
    assert.match(periods, /<View accessibilityRole="radiogroup" accessibilityLabel="Billing period"/);
    assert.match(periods, /<Press key=\{offer.productId\} haptic="selection" accessibilityRole="radio"/);
    assert.match(periods, /const checked = offer.productId === selected;/);
    assert.match(periods, /accessibilityState=\{\{ checked \}\} aria-checked=\{checked\}/);
    assert.match(periods, /accessibilityLabel=\{\[name, period, billedPrice\(offer.price, offer.period\)\]\.join\(', '\)\}/);
    assert.match(periods, /minHeight: HIT/);
    assert.match(periods, /share: \{ flex: 1, minWidth: 0, minHeight: HIT \}/);
    assert.doesNotMatch(periods, /numberOfLines|adjustsFontSizeToFit|aria-selected|aria-pressed/);
    assert.match(page, /<Press key=\{card.plan\} haptic="selection" accessibilityRole="radio" accessibilityState=\{\{ checked, disabled: card\.yours \}\} aria-checked=\{checked\}/);
  });

  // 7 October 2026, P4-C review: the successor of the test above, whose pinned
  // title (F607) still says "not a radio" while the rows are radios now. The
  // integrator moves F607's verified-by here; the old title retires then.
  test('a chosen way to pay says it is checked on a device and on the web', () => {
    const page = code('./WallPlansPage.tsx');
    const periods = code('./WallPeriodSwitch.tsx');
    assert.match(page, /<WallPeriodSwitch offers=\{visibleRow\.offers\} name=\{visibleRow\.name\} selected=\{selected\} onSelect=\{onSelect\}/);
    assert.match(periods, /<View accessibilityRole="radiogroup" accessibilityLabel="Billing period"/);
    assert.match(periods, /<Press key=\{offer.productId\} haptic="selection" accessibilityRole="radio"/);
    assert.match(periods, /const checked = offer.productId === selected;/);
    assert.match(periods, /accessibilityState=\{\{ checked \}\} aria-checked=\{checked\}/);
    assert.match(periods, /accessibilityLabel=\{\[name, period, billedPrice\(offer.price, offer.period\)\]\.join\(', '\)\}/);
    assert.match(periods, /minHeight: HIT/);
    assert.match(periods, /share: \{ flex: 1, minWidth: 0, minHeight: HIT \}/);
    assert.doesNotMatch(periods, /numberOfLines|adjustsFontSizeToFit|aria-selected|aria-pressed/);
    assert.match(page, /<Press key=\{card.plan\} haptic="selection" accessibilityRole="radio" accessibilityState=\{\{ checked, disabled: card\.yours \}\} aria-checked=\{checked\}/);
  });
});

/**
 * Come alive, README Part 5.G (7 October 2026): what sits around the plans.
 */
describe('the plans page around its plans', () => {
  test('the documents and the restore are one row of icon actions, and the renewal covers a month and a year', () => {
    const page = code('./WallPlansPage.tsx');
    // 19 October 2026, "P2 · Luvani": one row of 44pt text links under the button.
    assert.match(page, /<WallLinks onRestore=\{onRestore\} restoreDisabled=\{busy\} onTerms=\{onOpenTerms\} onPrivacy=\{onOpenPolicy\} \/>/);
    assert.match(code('./WallParts.tsx'), /link: \{ minHeight: HIT, minWidth: HIT/);
    assert.match(PLANS_RENEWAL, /Renews automatically/);
    assert.match(trialDisclosure(7, '£9.99', 'month'), /£9\.99\/month\. Renews automatically/);
    assert.match(trialDisclosure(7, '£99.99', 'year'), /£99\.99\/year\. Renews automatically/);
  });

  test('page one says Keep practising free only when there is a plan to decline', () => {
    const yours = code('./WallYoursPage.tsx');
    assert.match(yours, /\{canBuy && <GhostButton label=\{YOURS_DECLINE\} onPress=\{onLeave\} \/>/);
    assert.equal(YOURS_DECLINE, 'Keep practising free');
    assert.match(code('./WallScreen.tsx'), /<WallYoursPage canBuy=\{storeHasPlans\} onLeave=\{\(\) => leave\(\)\} \/>/);
  });

  test("the free plan's minutes are free minutes, and a free trial is only the store's", () => {
    // REV-001 (2026-10-23): the free plan is "Free", one conversation every other day.
    assert.equal(PLAN_LABELS.trial, 'Free');
    assert.equal(trialAllowance(10, 1), 'You get one free conversation every other day, up to 10 minutes.');
    assert.equal(trialAllowance(5, 0), 'You get 5 free minutes every other day.');
    assert.equal(trialAllowance(30, 3), 'You get 30 free minutes every other day, about 3 conversations.');
    // Only the store trial's own lines say "free trial".
    const said = WALL_COPY.filter((line) => /free trial/i.test(line));
    // F932: the title names the plan's first week, and says no "free trial" of its own.
    assert.equal(trialTitle('Core', 7), 'Your first week with Core');
    assert.deepEqual(said, [SUCCESS_TRIAL]);
  });
});

// Switching tier preserves the chosen billing period when the store offers it;
// a missing period falls back only to an actual product, never an invented ID.
test('tier comparison preserves period and uses actual products only', () => {
  const starterMonth = product('starter', '£14.99');
  const maxMonth = product('regular', '£24.99');
  const maxYear = { ...maxMonth, productId: 'max-year', period: 'year' as const, localizedPrice: '£179.99' };
  const rows = wallPlanRows(offering(starterMonth, maxMonth, maxYear), CATALOGUE)!;
  const max = rows.find(row => row.plan === 'regular')!;
  const starter = rows.find(row => row.plan === 'starter')!;
  assert.equal(offerForTier(max, starter.offers[0]!)?.productId, maxMonth.productId);
  assert.equal(offerForTier(starter, max.offers.find(offer => offer.period === 'year')!)?.productId, starterMonth.productId);
  assert.equal(offerForTier({ ...max, offers: [] }, starter.offers[0]!), null);
});
