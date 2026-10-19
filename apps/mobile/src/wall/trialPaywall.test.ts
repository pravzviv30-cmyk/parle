/**
 * The trial paywall ("P2 · Luvani", 2026-10-19), asked as functions: which
 * kind it is, what it says, what the compare sheet shows, the notices, and the
 * reminder row. apps/mobile has no renderer; the screens only lay these out.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { PLANS } from '@luvani/core';

import type { StoreIntroOffer, StoreProduct } from '../purchases/adapter.ts';
import { PURCHASE_TROUBLE, REFRESH_TROUBLE } from '../purchases/paywallView.ts';
import { trialReminderPromised } from '../reminders/trialReminder.ts';
import { trialTimeline } from './trialTimeline.ts';
import {
  compareCards, compareCta, detailLine, effectiveSelection, paywallCta, paywallNotice, paywallOffer, planLine, shouldScheduleTrialReminder, successSummary, trialEndsAt,
} from './trialPaywall.ts';
import {
  PAYWALL_FAILED_TITLE, PAYWALL_LOADING, PAYWALL_PURCHASING, PAYWALL_RESTORE_NONE_TITLE, PAYWALL_STANDARD_TITLE, PAYWALL_SUBSCRIBE,
  PAYWALL_TRY_AGAIN, PAYWALL_UNAVAILABLE_BODY, PAYWALL_UNAVAILABLE_TITLE, SUCCESS_ROW_REMINDER, WALL_CONFIRMING,
} from './wallCopy.ts';
import { chosenOffer, storeTrialMinutes, wallPlanRows } from './wallPlans.ts';

const WEEK: StoreIntroOffer = { priceString: '£0.00', periodUnit: 'WEEK', periodNumberOfUnits: 1, cycles: 1 };
const product = (plan: 'starter' | 'regular', period: 'month' | 'year', price: string, eligible: boolean | null, numeric: number): StoreProduct => ({
  plan, productId: `${plan}_${period}`, title: plan, localizedPrice: price, period, price: numeric, currencyCode: 'GBP',
  ...(period === 'year' ? { localizedPricePerMonth: plan === 'starter' ? '£8.33' : '£12.50' } : {}),
  intro: WEEK, introEligible: eligible as boolean,
});
const offering = (eligible: boolean | null) => ({
  available: true as const,
  products: [product('starter', 'month', '£9.99', eligible, 9.99), product('regular', 'month', '£19.99', eligible, 19.99)],
  yearly: [product('starter', 'year', '£99.99', eligible, 99.99), product('regular', 'year', '£149.99', eligible, 149.99)],
});
const setup = (eligible: boolean | null, productId = 'starter_year', remind = false) => {
  const rows = wallPlanRows(offering(eligible), PLANS)!;
  const chosen = chosenOffer(rows, productId)!;
  const trial = trialTimeline({ offer: chosen, minutes: storeTrialMinutes(PLANS, chosen.plan), remind });
  return { rows, chosen, trial, view: paywallOffer(chosen, trial) };
};
const TRIAL_WORDS = /trial|free for|free\b/i;

describe('trial or standard is decided by the store, and unknown is never eligible', () => {
  test('an eligible yearly offer reads as a trial, with the billed amount as its own bold part', () => {
    const { view } = setup(true);
    assert.equal(view.kind, 'trial');
    assert.equal(view.headline, 'How your trial works');
    assert.equal(view.lead, 'Free for 7 days, then ');
    assert.equal(view.billed, '£99.99 a year');
    assert.equal(view.detail, '£8.33 a month, billed yearly. Save 16%');
    assert.equal(view.cta, 'Start 7-day free trial');
    assert.equal(view.disclosure, 'Free for 7 days, then £99.99/year. Renews automatically until you cancel in Apple Subscriptions.');
    assert.deepEqual(view.benefits, []);
  });

  test('ineligible and unknown eligibility both read as standard, with no trial wording anywhere', () => {
    for (const eligible of [false, null]) for (const id of ['starter_year', 'starter_month', 'regular_year']) {
      const { view, trial, rows, chosen } = setup(eligible, id);
      assert.equal(trial, null, 'unknown eligibility rendered as eligible');
      assert.equal(view.kind, 'standard');
      assert.equal(view.headline, PAYWALL_STANDARD_TITLE);
      assert.equal(view.cta, PAYWALL_SUBSCRIBE);
      assert.equal(view.benefits.length, 3);
      for (const line of [view.headline, view.billed, view.detail, view.cta, view.disclosure, ...view.benefits, planLine(rows[0]!, chosen, PLANS)]) {
        assert.doesNotMatch(line, TRIAL_WORDS, `trial wording on a standard paywall: ${line}`);
      }
    }
    assert.equal(setup(false).view.disclosure, '£99.99 billed yearly. Renews automatically until you cancel in Apple Subscriptions.');
    assert.equal(setup(false, 'starter_month').view.detail, 'Billed monthly');
    assert.equal(setup(true, 'starter_month').view.detail, 'Billed monthly after your trial');
  });

  test('the saving is said only when two store prices make a genuine one', () => {
    const { chosen } = setup(false);
    assert.equal(detailLine({ ...chosen, annualSavingsPercent: null }, false), '£8.33 a month, billed yearly');
    assert.equal(detailLine({ ...chosen, perMonth: null, annualSavingsPercent: null }, false), 'Billed yearly');
  });

  test('the plan line is the tier and the catalogue minutes, never a guess', () => {
    const { rows, chosen } = setup(true);
    assert.equal(planLine(rows[0]!, chosen, PLANS), 'Starter, 180 min every 30 days');
    assert.equal(planLine(wallPlanRows(offering(true), null)![0]!, chosen, null), 'starter', 'minutes were guessed with no catalogue');
  });
});

describe('the compare sheet', () => {
  test('trial lines show only when this account may take the trial', () => {
    const eligible = compareCards(setup(true).rows, setup(true).chosen, PLANS);
    assert.deepEqual(eligible.map(card => [card.name, card.price, card.allowance, card.trial]), [
      ['Starter', '£99.99 a year', '180 minutes of live conversation every 30 days', 'Free trial: 42 minutes over 7 days'],
      ['Max', '£149.99 a year', '300 minutes of live conversation every 30 days', 'Free trial: 70 minutes over 7 days'],
    ]);
    assert.deepEqual(eligible.map(compareCta), ['Continue with Starter', 'Continue with Max']);
    for (const unknown of [false, null]) {
      const cards = compareCards(setup(unknown).rows, setup(unknown).chosen, PLANS);
      assert.deepEqual(cards.map(card => card.trial), [null, null], 'a trial line was shown to an account that may not take it');
      assert.deepEqual(cards.map(compareCta), ['Subscribe to Starter', 'Subscribe to Max']);
    }
  });
});

describe('the states say their own words', () => {
  test('purchasing, confirming, failed, try again and a silent cancel', () => {
    const { view } = setup(true);
    assert.deepEqual(paywallCta({ offer: view, busy: true, morphLabel: null, notice: null }), { label: PAYWALL_PURCHASING, dim: 0.6 });
    assert.deepEqual(paywallCta({ offer: view, busy: false, morphLabel: WALL_CONFIRMING, notice: null }), { label: WALL_CONFIRMING, dim: 0.6 });
    const failed = paywallNotice(PURCHASE_TROUBLE, 'buy');
    assert.deepEqual(failed, { title: PAYWALL_FAILED_TITLE, body: 'You haven’t been charged.', danger: true });
    assert.deepEqual(paywallCta({ offer: view, busy: false, morphLabel: null, notice: failed }), { label: PAYWALL_TRY_AGAIN, dim: 1 });
    assert.equal(paywallNotice(REFRESH_TROUBLE, 'restore')?.title, PAYWALL_RESTORE_NONE_TITLE);
    assert.equal(paywallNotice(null, 'buy'), null, 'a cancel in Apple\'s sheet was remarked on');
    assert.deepEqual(paywallCta({ offer: view, busy: false, morphLabel: null, notice: null }), { label: 'Start 7-day free trial', dim: 1 });
  });

  test('loading and unavailable are drawn in the shell with their own copy and no price', () => {
    const screen = readFileSync(new URL('./WallScreen.tsx', import.meta.url), 'utf8');
    assert.match(screen, /<WallCta label=\{PAYWALL_LOADING\} dim=\{0.45\} disabled/);
    assert.match(screen, /\{PAYWALL_UNAVAILABLE_TITLE\}/);
    assert.match(screen, /\{PAYWALL_UNAVAILABLE_BODY\}/);
    assert.equal(PAYWALL_LOADING, 'Checking your offer…');
    assert.equal(PAYWALL_UNAVAILABLE_TITLE, 'We couldn’t load plans');
    assert.match(PAYWALL_UNAVAILABLE_BODY, /free practice are still here/);
    const page = readFileSync(new URL('./WallPlansPage.tsx', import.meta.url), 'utf8');
    const loading = page.slice(page.indexOf('function PlansLoading('), page.indexOf('function ComparePlans('));
    assert.doesNotMatch(loading, /billed|price|Text/, 'the loading state drew price text');
  });
});

describe('the reminder is the same real state on the timeline and the success page', () => {
  test('the timeline promises it only when the hook says it will be kept', () => {
    for (const permission of ['granted', 'denied', 'undetermined'] as const) {
      const promised = trialReminderPromised({ available: true, enabled: true, permission });
      const { trial } = setup(true, 'starter_year', promised);
      assert.equal(trial!.nodes.some(node => node.key === 'remind'), permission === 'granted');
    }
  });

  test('the success page names the reminder only once one is scheduled', () => {
    const { chosen } = setup(true);
    const success = { name: 'Starter', minutes: 42, perWeek: null, trial: true as const };
    const ends = Date.parse('2026-10-26T09:00:00.000Z');
    const base = { success, offer: chosen, catalogue: PLANS, plan: 'starter' as const, endsAt: ends, reminderAt: ends - 2 * 86_400_000 };
    const scheduled = successSummary({ ...base, reminderScheduled: true });
    assert.deepEqual(scheduled.rows.map(row => row.key), ['Plan', 'Trial ends', SUCCESS_ROW_REMINDER, 'Then']);
    assert.equal(scheduled.body, 'Your Starter trial has started. You have 42 minutes with your tutor over the next 7 days.');
    assert.ok(!successSummary({ ...base, reminderScheduled: false }).rows.some(row => row.key === SUCCESS_ROW_REMINDER), 'a reminder row with no reminder');
    const paid = successSummary({ ...base, success: { name: 'Starter', minutes: 180, perWeek: 4 }, reminderScheduled: false });
    assert.doesNotMatch(paid.body + paid.rows.map(row => row.key + row.value).join(), /trial/i);
  });

  test('the trial end is the server\'s, else purchase time plus the offer\'s days', () => {
    assert.equal(trialEndsAt('2026-10-26T09:00:00.000Z', 0, 7), Date.parse('2026-10-26T09:00:00.000Z'));
    assert.equal(trialEndsAt(null, 1_000, 7), 1_000 + 7 * 86_400_000);
    assert.equal(trialEndsAt(null, 1_000, null), 1_000 + 7 * 86_400_000);
    assert.equal(trialEndsAt(null, null, 7), null);
    assert.equal(shouldScheduleTrialReminder({ name: 'Starter', minutes: 42, perWeek: null, trial: true }, null), false);
    assert.equal(shouldScheduleTrialReminder({ name: 'Starter', minutes: 180, perWeek: 4 }, { plan: 'starter' } as never), false, 'a paid plan scheduled a trial reminder');
  });

  test('the screen schedules after confirmation, never asks permission, and the timeline reads the hook', () => {
    const screen = readFileSync(new URL('./WallScreen.tsx', import.meta.url), 'utf8');
    assert.match(screen, /remind: trialReminder\.promised,/);
    assert.match(screen, /scheduleTrialReminder\(\{ trialEndsAt: endsAt, now: Date\.now\(\) \}\)/);
    assert.doesNotMatch(screen, /askReminderPermission|requestPermissions/, 'the purchase flow asks for notification permission');
  });
});

describe('an available offering always shows a priced offer', () => {
  const PREVIEW_ENV = { EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT: '1', EXPO_PUBLIC_LUVANI_WALL_PREVIEW: '1' };

  test('with nothing chosen or suggested, the default is Starter yearly, then Starter monthly, then the first product', () => {
    const rows = wallPlanRows(offering(true), PLANS)!;
    assert.equal(effectiveSelection(rows, null, null), 'starter_year');
    const monthlyOnly = wallPlanRows({ available: true, products: offering(true).products }, PLANS)!;
    assert.equal(effectiveSelection(monthlyOnly, null, null), 'starter_month');
    const maxOnly = wallPlanRows({ available: true, products: [offering(true).products[1]!] }, PLANS)!;
    assert.equal(effectiveSelection(maxOnly, null, null), 'regular_month');
    assert.equal(effectiveSelection(null, null, null), null);
    assert.equal(effectiveSelection([{ ...rows[0]!, offers: [] }], null, null), null, 'a row with no product invented one');
  });

  test('the learner\'s choice and then the suggestion keep priority over the default', () => {
    const rows = wallPlanRows(offering(true), PLANS)!;
    assert.equal(effectiveSelection(rows, null, 'regular_year'), 'regular_year', 'the default overrode a preselect');
    assert.equal(effectiveSelection(rows, 'regular_month', 'starter_year'), 'regular_month', 'the page chose over the learner');
    assert.equal(effectiveSelection(rows, 'gone', null), 'starter_year', 'a product that left the store stayed chosen');
  });

  test('the preview offering renders the full trial paywall by default, and unknown eligibility the standard one', async () => {
    const { previewOffering } = await import('./preview.ts');
    const preview = previewOffering(PREVIEW_ENV)!;
    assert.ok(preview.available);
    const rows = wallPlanRows(preview, PLANS)!;
    const chosen = chosenOffer(rows, effectiveSelection(rows, null, null))!;
    const view = paywallOffer(chosen, trialTimeline({ offer: chosen, minutes: storeTrialMinutes(PLANS, chosen.plan), remind: false }));
    assert.equal(view.kind, 'trial');
    assert.equal(view.headline, 'How your trial works');
    assert.equal(`${view.lead}${view.billed}`, 'Free for 7 days, then £119.99 a year');
    assert.equal(view.billed, '£119.99 a year', 'the billed amount is not its own (bold) part');
    assert.equal(view.detail, '£10.00 a month, billed yearly. Save 33%');
    assert.equal(view.cta, 'Start 7-day free trial');
    const unknown = { ...preview, products: preview.products.map((p: StoreProduct) => ({ ...p, introEligible: null as unknown as boolean })), yearly: preview.yearly!.map((p: StoreProduct) => ({ ...p, introEligible: null as unknown as boolean })) };
    const unknownRows = wallPlanRows(unknown, PLANS)!;
    const plain = chosenOffer(unknownRows, effectiveSelection(unknownRows, null, null))!;
    assert.equal(paywallOffer(plain, trialTimeline({ offer: plain, minutes: 42, remind: false })).kind, 'standard', 'unknown eligibility rendered as eligible');
  });

  test('the empty plans page cannot draw: the screen always chooses, and a plans page with nothing to price is unavailable', () => {
    const screen = readFileSync(new URL('./WallScreen.tsx', import.meta.url), 'utf8');
    const page = readFileSync(new URL('./WallPlansPage.tsx', import.meta.url), 'utf8');
    assert.match(screen, /const showing = effectiveSelection\(planRows, selected, suggestion\);\s*const chosen = chosenOffer\(planRows, showing\);/);
    assert.match(screen, /const unavailable = offeringLoaded && \(page === undefined \|\| \(page === 'plans' && chosen === null\)\);/);
    assert.match(page, /\{loading \? <PlansLoading \/> : offer !== null && <>/);
    assert.doesNotMatch(page, /PLANS_TITLE/, 'the old empty headline branch is still drawable');
    // Every combination of store answer the adapter can give, with products, picks something.
    for (const eligible of [true, false, null]) {
      const rows = wallPlanRows(offering(eligible), PLANS)!;
      assert.notEqual(chosenOffer(rows, effectiveSelection(rows, null, null)), null);
    }
  });
});
