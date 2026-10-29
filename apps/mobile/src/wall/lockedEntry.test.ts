/**
 * F910 (founder decision 14, 2026-10-29): a lock says which plan opens it, a
 * tap on it opens the wall at that plan with a short brief, and the free list
 * on the wall names nothing Free keeps locked.
 *
 * Every plan named here is read from `capabilitiesFor`, the same table the
 * locks are drawn from, so a lock and the wall can never disagree about which
 * plan opens a feature.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, test } from 'node:test';

import { getStateFromPath, getPathFromState } from '@react-navigation/core';

import { capabilitiesFor, LOCKED_FEATURES, type LockedFeature } from '../purchases/capabilities.ts';
import { lockedRouteGuard, requiredPlan, lockSpoken, unlockPlanName } from '../purchases/featureLocks.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import type { PaidPlan, StoreOffering, StoreProduct } from '../purchases/adapter.ts';
import { lockSaid } from '../access/featureAccess.ts';
import { linking } from '../nav/linking.ts';
import { LOCK_BRIEFS, YOURS_ROWS, unlockWith } from './wallCopy.ts';
import { chosenOffer, wallPlanRows, wallSuggestion } from './wallPlans.ts';
import { effectiveSelection, lockBrief, paywallOffer } from './trialPaywall.ts';

const SRC = new URL('../', import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, SRC), 'utf8');
const walk = (dir: URL, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const url = new URL(name, dir);
    if (statSync(url).isDirectory()) walk(new URL(`${name}/`, dir), out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(url.pathname);
  }
  return out;
};

const product = (plan: PaidPlan, period: 'month' | 'year', price: string): StoreProduct => ({
  plan, productId: `luvani_${plan}_${period}`, title: plan === 'starter' ? 'Core' : 'Max', localizedPrice: price, period,
  localizedPricePerMonth: period === 'year' ? '£10.00' : null, intro: null, introEligible: false,
});
const offering: StoreOffering = {
  available: true,
  products: [product('starter', 'month', '£14.99'), product('regular', 'month', '£24.99')],
  yearly: [product('starter', 'year', '£119.99'), product('regular', 'year', '£179.99')],
};
const status = (plan: BillingStatus['plan'], lapsed = false): BillingStatus => ({ plan, lapsed } as BillingStatus);
const rows = wallPlanRows(offering, null)!;
const NO_GOAL = { loaded: true, target: null };

describe('F910: locks name their plan', () => {
  test('a lock names the plan that unlocks it', () => {
    for (const feature of LOCKED_FEATURES) {
      const plan = requiredPlan(feature);
      // The cheapest plan that opens it, by the capability table itself.
      assert.equal(capabilitiesFor(plan).unlocks[feature], true, `${feature} names a plan that does not open it`);
      if (plan === 'regular') assert.equal(capabilitiesFor('starter').unlocks[feature], false, `${feature} names Max though Core opens it`);
      assert.equal(lockSpoken(plan), `Locked. Part of ${unlockPlanName(plan)}.`);
      assert.equal(lockSaid('Your fixes', feature, true), `Your fixes. Locked. Part of ${unlockPlanName(plan)}.`);
      assert.equal(lockSaid('Your fixes', feature, false), 'Your fixes');
    }
    assert.equal(unlockPlanName('starter'), 'Core');
    assert.equal(unlockPlanName('regular'), 'Max');
    assert.equal(requiredPlan('realMoment'), 'regular');
    assert.equal(requiredPlan('continueArc'), 'regular');
    assert.equal(requiredPlan('sounds'), 'starter');
    // A learner in Core's store trial holds Core: a Max lock still says Max.
    assert.equal(capabilitiesFor('starter').unlocks.realMoment, false);
    assert.equal(lockSpoken(requiredPlan('realMoment')), 'Locked. Part of Max.');

    // The badge draws the plan's name and says it to a screen reader; the trial words are gone.
    const components = read('components.tsx');
    const badge = components.slice(components.indexOf('export function LockBadge('), components.indexOf('export function HeroNumber('));
    assert.match(badge, /unlockPlanName\(plan\)/, 'the pill does not draw the plan name');
    assert.match(badge, /lockSpoken\(plan\)/, 'the badge does not say the plan to a screen reader');
    // Every badge and every spoken lock in the app passes its feature or plan.
    const unnamed: string[] = [];
    for (const file of walk(SRC)) {
      const text = readFileSync(file, 'utf8');
      assert.doesNotMatch(text, /Included with your trial|LOCK_BADGE_LABEL/, `${file} still says the trial lock`);
      for (const m of text.matchAll(/<LockBadge\b[^>]*\/>/g)) if (!/\b(feature|plan)=[{"]/.test(m[0])) unnamed.push(`${file}: ${m[0]}`);
    }
    assert.deepEqual(unnamed, [], 'a lock badge that does not know its plan');
  });

  test('a Max-only lock opens the Max offer', async () => {
    // A tap through the seam keeps the feature on the way to the wall.
    assert.match(read('purchases/useFeatureLocks.ts'), /const open = useCallback\(\(feature: LockedFeature\) => nav\.navigate\('Wall', \{ entry: 'locked', feature \}\)/);
    // The locked-route guard hands the feature on too.
    const walled: LockedFeature[] = [];
    const guard = lockedRouteGuard({
      route: () => ({ key: 'r1', name: 'RealMoment' }),
      standing: () => status('trial'),
      read: async () => status('trial'),
      owner: () => 1,
      toWall: (feature) => { walled.push(feature); },
    });
    await guard();
    assert.deepEqual(walled, ['realMoment']);
    assert.match(read('purchases/useFeatureLocks.ts'), /StackActions\.replace\('Wall', \{ entry: 'locked', feature \}\)/);

    // The web address keeps it, and an unknown one is dropped rather than trusted.
    const config = linking.config as Parameters<typeof getStateFromPath>[1];
    const state = getStateFromPath('/plans?entry=locked&feature=realMoment', config);
    assert.deepEqual(state?.routes[0]?.params, { entry: 'locked', feature: 'realMoment' });
    assert.equal(getPathFromState(state!, config), '/plans?entry=locked&feature=realMoment');
    const junk = getStateFromPath('/plans?entry=locked&feature=everything', config);
    assert.equal((junk?.routes[0]?.params as { feature?: unknown }).feature, undefined);

    // The wall lands on Max yearly for a free learner, before and after the status read.
    const suggestion = wallSuggestion(rows, NO_GOAL, status('trial'), 'realMoment');
    assert.equal(suggestion, 'luvani_regular_year');
    assert.equal(effectiveSelection(rows, null, null, requiredPlan('realMoment')), 'luvani_regular_year');
    // A Core lock lands on Core, and the learner's own choice still wins.
    assert.equal(wallSuggestion(rows, NO_GOAL, status('trial'), 'sounds'), 'luvani_starter_year');
    assert.equal(effectiveSelection(rows, 'luvani_starter_month', suggestion, 'regular'), 'luvani_starter_month');

    // The brief names the feature, and the button names the plan that opens it.
    const brief = lockBrief('locked', 'realMoment');
    assert.deepEqual(brief, { title: LOCK_BRIEFS.realMoment.title, line: LOCK_BRIEFS.realMoment.line });
    assert.equal(lockBrief('launch', 'realMoment'), null);
    assert.equal(lockBrief('locked', null), null);
    const max = chosenOffer(rows, 'luvani_regular_year')!;
    assert.equal(paywallOffer(max, null, { lapsed: false, unlocks: 'realMoment' }).cta, unlockWith('Max'));
    assert.equal(unlockWith('Max'), 'Unlock with Max');
    // Core does not open it, so a learner who switches to Core is not told it unlocks.
    const core = chosenOffer(rows, 'luvani_starter_year')!;
    assert.notEqual(paywallOffer(core, null, { lapsed: false, unlocks: 'realMoment' }).cta, unlockWith('Core'));
    // The page draws the brief, and Not now still leaves.
    const page = read('wall/WallPlansPage.tsx');
    assert.match(page, /brief !== null &&/);
    assert.match(read('wall/WallScreen.tsx'), /<WallTextLink label=\{WALL_LEAVE\} onPress=\{\(\) => leave\(\)\} \/>/);
  });

  test('the free list names nothing that is locked on Free', () => {
    const free = capabilitiesFor('trial');
    const lockedOnFree = LOCKED_FEATURES.filter((feature) => !free.unlocks[feature]);
    assert.ok(lockedOnFree.length > 0);
    for (const feature of lockedOnFree) {
      for (const row of YOURS_ROWS) {
        for (const name of LOCK_BRIEFS[feature].names) {
          assert.ok(!row.toLowerCase().includes(name), `the free list says "${row}", which names ${feature} ("${name}"), locked on Free`);
        }
      }
    }
    // Every brief is short and plain, with no digit and no em dash.
    for (const feature of LOCKED_FEATURES) {
      const brief = LOCK_BRIEFS[feature];
      assert.ok(brief.names.length > 0, `${feature} has no words to scan for`);
      for (const line of [brief.title, brief.line]) {
        assert.doesNotMatch(line, /\d|—/);
        assert.ok(line.length <= 90, `${feature} brief runs long: ${line}`);
      }
    }
  });
});

// Fix-verifier round (2026-10-29): the review lock still named the trial, the
// free list implied Free reviews conversation phrases, and Explore's plan lock
// opened the wall with no brief and no plan.
describe('F910 verifier round', () => {
  test('no learner-facing lock names the trial as what unlocks it', async () => {
    const { HELD_BACK_ACTION, heldBackLine } = await import('../review/freeTier.ts');
    const core = unlockPlanName(requiredPlan('conversationPractice'));
    assert.equal(heldBackLine(1), `1 phrase from your conversations is part of ${core}.`);
    assert.equal(heldBackLine(3), `3 phrases from your conversations are part of ${core}.`);
    assert.equal(HELD_BACK_ACTION, `See ${core}`);
    // Every source file, comments stripped, so only strings and code are read.
    // The wall's own trial-offer copy ("How your trial works") does not match.
    const LOCK_TRIAL = /included with (your|the|a) trial|part of (your|the) trial|see the trial|unlock(s|ed)? with (your|the) trial|LOCK_BADGE_LABEL/i;
    const found: string[] = [];
    for (const file of walk(SRC)) {
      const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
      const m = code.match(LOCK_TRIAL);
      if (m) found.push(`${file}: ${m[0]}`);
    }
    assert.deepEqual(found, [], 'a lock still says the trial opens it');
  });

  test('the free list claims only the review a Free learner is really dealt', async () => {
    const { newCard } = await import('@luvani/core');
    const { dealForTier } = await import('../review/freeTier.ts');
    const now = 1_700_000_000_000;
    const card = (id: string, sources: readonly string[]) => ({ ...newCard({ id, kind: 'vocab', front: id, back: 'x', context: '', ipa: '' }, now - 1000), sources }) as never;
    // On Free a conversation-only phrase is held back from review.
    const deal = dealForTier([card('c', ['conversation']), card('d', ['daily'])], now, 'locked');
    assert.equal(deal.heldBack, 1);
    assert.deepEqual(deal.due.map((c) => c.id), ['d']);
    // So no row that offers review or practice may promise conversation phrases,
    // and none may sit straight under the bank's conversation phrases as if it reviewed them.
    for (const row of YOURS_ROWS) {
      if (/review|practi[cs]e|drill/i.test(row)) assert.doesNotMatch(row, /conversation/i, `the free list offers review of conversation phrases: ${row}`);
    }
    const reviewRow = YOURS_ROWS.find((row) => /review/i.test(row));
    assert.ok(reviewRow !== undefined, 'the free list no longer says what Free reviews');
    assert.match(reviewRow, /lesson|daily|sample/i, `the review row does not name what Free reviews: ${reviewRow}`);
  });

  test('an Explore plan lock opens the locked wall on Core with a brief', () => {
    const hook = read('purchases/useExploreAccess.ts');
    assert.match(hook, /plans: \(\) => nav\.navigate\('Wall', \{ entry: 'locked', unlock: 'collections' \}\)/);
    // Collections open on any paid plan, so the wall lands on Core.
    assert.equal(wallSuggestion(rows, NO_GOAL, status('trial'), null, 'starter'), 'luvani_starter_year');
    assert.ok(LOCK_BRIEFS.collections.title.length > 0 && !/\d|—/.test(LOCK_BRIEFS.collections.line));
    const screen = read('wall/WallScreen.tsx');
    assert.match(screen, /unlock === 'collections'/);
    const config = linking.config as Parameters<typeof getStateFromPath>[1];
    assert.deepEqual(getStateFromPath('/plans?entry=locked&unlock=collections', config)?.routes[0]?.params, { entry: 'locked', unlock: 'collections' });
    assert.equal((getStateFromPath('/plans?entry=locked&unlock=anything', config)?.routes[0]?.params as { unlock?: unknown }).unlock, undefined);
  });
});
