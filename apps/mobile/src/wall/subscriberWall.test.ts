/**
 * F912 and F913 (founder decision 13, 2026-10-29).
 *
 * F912: trial copy is for a free learner the store says may take a trial, and
 * nobody else. A current subscriber sees their plan marked and the other plan
 * offered; a lapsed one is welcomed back to a plain offer.
 *
 * F913: the compare sheet says both plans in the same words, from the
 * catalogue's numbers, and claims nothing a plan's capabilities do not open.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { PLANS } from '@luvani/core';

import { capabilitiesFor, INCLUSIONS } from '../purchases/capabilities.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import type { PaidPlan, StoreOffering, StoreProduct } from '../purchases/adapter.ts';
import { COMPARE_INTRO, PLAN_EXTRAS, PLAN_YOURS, WELCOME_BACK_TITLE } from './wallCopy.ts';
import { chosenOffer, trialCopyAllowed, wallPlanRows, wallSuggestion } from './wallPlans.ts';
import { compareCards, planExtras, paywallOffer } from './trialPaywall.ts';
import { trialTimeline } from './trialTimeline.ts';

const TRIAL = { price: 0, cycles: 1, periodUnit: 'DAY', periodNumberOfUnits: 7 } as unknown as StoreProduct['intro'];
const product = (plan: PaidPlan, period: 'month' | 'year', price: string): StoreProduct => ({
  plan, productId: `luvani_${plan}_${period}`, title: plan === 'starter' ? 'Core' : 'Max', localizedPrice: price, period,
  localizedPricePerMonth: period === 'year' ? '£10.00' : null, intro: TRIAL, introEligible: true,
});
const offering: StoreOffering = {
  available: true,
  products: [product('starter', 'month', '£14.99'), product('regular', 'month', '£24.99')],
  yearly: [product('starter', 'year', '£119.99'), product('regular', 'year', '£179.99')],
};
const catalogue = PLANS;
const rows = wallPlanRows(offering, catalogue)!;
const status = (plan: BillingStatus['plan'], lapsed = false): BillingStatus => ({ plan, lapsed } as BillingStatus);
const GOAL = { loaded: true, target: null };
const page = readFileSync(new URL('./WallPlansPage.tsx', import.meta.url), 'utf8');
const screen = readFileSync(new URL('./WallScreen.tsx', import.meta.url), 'utf8');

/** What the wall shows for one standing: the offer view and the compare cards, as WallScreen builds them. */
function wallFor(standing: BillingStatus | null, productId: string) {
  const chosen = chosenOffer(rows, productId)!;
  const trial = trialCopyAllowed(standing) ? trialTimeline({ offer: chosen, minutes: null, remind: false }) : null;
  const offer = paywallOffer(chosen, trial, { lapsed: standing?.lapsed === true, unlocks: null });
  const cards = compareCards(rows, chosen, catalogue, standing);
  return { offer, cards, words: [offer.headline, offer.cta, offer.disclosure, offer.lead ?? '', ...cards.map((c) => c.trial ?? '')].join(' ') };
}

describe('F912: no trial copy for subscribers', () => {
  test('a current subscriber never sees trial copy on the wall', () => {
    for (const plan of ['starter', 'regular'] as const) {
      const other = plan === 'starter' ? 'regular' : 'starter';
      // The other plan's yearly offer is chosen for them.
      const suggestion = wallSuggestion(rows, GOAL, status(plan));
      assert.equal(suggestion, `luvani_${other}_year`, `a ${plan} subscriber is not offered the other plan`);
      for (const id of [`luvani_${other}_year`, `luvani_${other}_month`, `luvani_${plan}_year`]) {
        const { offer, cards, words } = wallFor(status(plan), id);
        assert.equal(offer.kind, 'standard', `${plan} subscriber sees a trial on ${id}`);
        assert.doesNotMatch(words, /trial|free for/i, `${plan} subscriber reads trial words on ${id}: ${words}`);
        // Their own plan's card is marked, and not offered as a purchase.
        const yours = cards.filter((card) => card.yours);
        assert.deepEqual(yours.map((card) => card.plan), [plan]);
      }
    }
    // The sheet marks it and gives it no button; buy()'s refusal stays the backstop.
    assert.match(page, /card\.yours && <Text[^>]*>\{PLAN_YOURS\}<\/Text>/);
    assert.match(page, /disabled=\{card\.yours\}/);
    assert.equal(PLAN_YOURS, 'Your plan');
    // The screen builds the timeline only when trial copy is allowed.
    assert.match(screen, /const trial = trialCopyAllowed\(status\) \? trialTimeline\(/);
    // Unread status: no trial copy either, the conservative answer.
    assert.equal(trialCopyAllowed(null), false);
    assert.equal(wallFor(null, 'luvani_starter_year').offer.kind, 'standard');
    // A free learner the store says may take it still sees the trial.
    assert.equal(trialCopyAllowed(status('trial')), true);
    assert.equal(wallFor(status('trial'), 'luvani_starter_year').offer.kind, 'trial');
  });

  test('a lapsed subscriber sees resubscribe wording rather than a trial', () => {
    for (const plan of ['starter', 'regular', 'trial'] as const) {
      // The store still says intro-eligible here; lapsed trusts neither.
      const { offer, words } = wallFor(status(plan, true), 'luvani_starter_year');
      assert.equal(offer.kind, 'standard');
      assert.equal(offer.headline, WELCOME_BACK_TITLE);
      assert.doesNotMatch(words, /trial|free for/i, `a lapsed ${plan} learner reads trial words: ${words}`);
    }
    assert.equal(WELCOME_BACK_TITLE, 'Welcome back');
  });
});

describe('F913: the compare sheet', () => {
  test('the compare sheet claims only what each plan\'s capabilities grant', () => {
    for (const card of compareCards(rows, null, catalogue, status('trial'))) {
      const caps = capabilitiesFor(card.plan);
      const extras = planExtras(card.plan);
      assert.equal(extras.includes(PLAN_EXTRAS.rehearse), caps.customRehearsal, `${card.plan} claims Rehearse wrongly`);
      assert.equal(extras.includes(PLAN_EXTRAS.continueArc), caps.continueArc, `${card.plan} claims Continue a conversation wrongly`);
      for (const extra of Object.values(PLAN_EXTRAS)) {
        assert.equal(card.allowance!.includes(extra), extras.includes(extra), `${card.plan}'s card says "${extra}" against its capabilities`);
      }
    }
    // The intro claims every scene for both, and only Max's real extras for Max.
    assert.doesNotMatch(COMPARE_INTRO, /every conversation/i);
    assert.equal(capabilitiesFor('starter').missions && capabilitiesFor('regular').missions, true);
    for (const extra of Object.values(PLAN_EXTRAS)) {
      assert.equal(COMPARE_INTRO.includes(extra), planExtras('regular').includes(extra) && !planExtras('starter').includes(extra));
    }
    // The streak line: paid plans add a second freeze and the repair, which Free does not hold.
    assert.equal(INCLUSIONS.streak, 'Paid plans add a second streak freeze and a one-tap repair.');
    for (const plan of ['starter', 'regular'] as const) assert.deepEqual(capabilitiesFor(plan).streakProtection, { freezes: 2, repair: true });
    assert.deepEqual(capabilitiesFor('trial').streakProtection, { freezes: 1, repair: false });
    // The sheet draws the card's own allowance and no separate Max line.
    assert.doesNotMatch(page, /INCLUSIONS\.maxCompact/);
    assert.match(page, /\{card\.allowance\}/);
  });

  test('both plans state their minutes per 30 days in the same words', () => {
    const cards = compareCards(rows, null, catalogue, status('trial'));
    const said = Object.fromEntries(cards.map((card) => [card.plan, card.allowance]));
    const words = (plan: PaidPlan) => {
      const minutes = PLANS[plan].secondsPerPeriod / 60;
      const days = PLANS[plan].periodDays ?? 0;
      return `${minutes} minutes every ${days} days (about ${Math.floor(minutes / days)} a day)`;
    };
    assert.equal(said.starter, `${words('starter')}.`);
    assert.equal(said.regular, `${words('regular')}, plus Rehearse and Continue a conversation.`);
    assert.equal(said.starter, '300 minutes every 30 days (about 10 a day).');
    assert.equal(said.regular, '600 minutes every 30 days (about 20 a day), plus Rehearse and Continue a conversation.');
    for (const line of Object.values(said)) assert.doesNotMatch(line ?? '', /up to|unlimited/i);
  });
});
