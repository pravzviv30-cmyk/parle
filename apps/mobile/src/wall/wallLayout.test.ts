import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { PLANS } from '@luvani/core';
import { trialTimeline, type TrialTimelineView } from './trialTimeline.ts';
import { chosenOffer, storeTrialMinutes, wallPlanRows } from './wallPlans.ts';
import type { StoreProduct } from '../purchases/contract.ts';

const page = readFileSync(new URL('./WallPlansPage.tsx', import.meta.url), 'utf8');
const periods = readFileSync(new URL('./WallPeriodSwitch.tsx', import.meta.url), 'utf8');

test('the paywall presents three connected trial moments without dropping the verified allowance or changing the timeline', () => {
  const source = page.slice(page.indexOf('function trialTimelineRows('), page.indexOf('function TrialTimeline('));
  const rowsOf = new Function(`${stripTypeScriptTypes(source)};return trialTimelineRows;`)() as (view: TrialTimelineView) => TrialTimelineView['nodes'];
  const month: StoreProduct = { plan: 'starter', productId: 'month', title: 'Starter', localizedPrice: '£19.99', period: 'month',
    intro: { priceString: '£0.00', periodUnit: 'WEEK', periodNumberOfUnits: 1, cycles: 1 }, introEligible: true };
  const chosen = chosenOffer(wallPlanRows({ available: true, products: [month] }, PLANS), month.productId)!;
  for (const remind of [false, true]) for (const minutes of [null, storeTrialMinutes(PLANS, 'starter')]) {
    const timeline = trialTimeline({ offer: chosen, minutes, remind })!;
    const before = structuredClone(timeline);
    timeline.nodes.forEach(Object.freeze);
    Object.freeze(timeline.nodes);
    Object.freeze(timeline);
    const rows = rowsOf(timeline);
    assert.deepEqual(rows.map(row => row.key), ['today', remind ? 'remind' : 'cancel', 'then']);
    assert.deepEqual(rows.map(row => row.title), ['Today', 'Day 5', 'Day 7']);
    assert.match(rows[0]!.line, /Nothing is charged today/);
    if (minutes === null) assert.doesNotMatch(rows[0]!.line, /minutes/);
    else assert.match(rows[0]!.line, /up to 42 minutes/);
    assert.match(rows[2]!.line, /£19.99 a month/);
    assert.deepEqual(timeline, before, 'presentation changed the authoritative timeline view');
  }
  assert.match(page, /index < rows.length - 1 && <View style=\{st.connector\}/);
  assert.match(page, /const DISC = space\(11\)/);
});

test('the period switch keeps actual offers, checked state and forty-four point targets across large text layouts', () => {
  assert.match(periods, /const periods = \['year', 'month', 'week'\] as const/);
  assert.match(periods, /offers.filter\(offer => offer.period === period\)/);
  assert.match(periods, /accessibilityState=\{\{ checked \}\} aria-checked=\{checked\}/);
  assert.match(periods, /const stacked = fontScale >= 1.75/);
  assert.match(periods, /stacked: \{ flexDirection: 'column'/);
  assert.match(periods, /segment: \{ minHeight: HIT/);
  assert.match(periods, /onPress=\{\(\) => onSelect\(offer\)\}/);
  assert.doesNotMatch(periods, /numberOfLines|adjustsFontSizeToFit|purchase\(/);
});

test('the paywall reading order is artwork, store terms, period selection and timeline with a genuine annual incentive', () => {
  const art = page.indexOf('<MainIllustration motif="plans"');
  const title = page.indexOf('{trial?.title ?? PLANS_TITLE}');
  const terms = page.indexOf('{trialIntroLine(trial.days, current.price, current.period)}');
  const selection = page.indexOf('<WallPeriodSwitch');
  const timeline = page.indexOf('<TrialTimeline view={trial}');
  assert.ok(art >= 0 && art < title && title < terms && terms < selection && selection < timeline);
  assert.match(page, /current\?\.annualSavingsPercent != null/);
  assert.match(page, /Save \{current.annualSavingsPercent\}% compared with monthly/);
  assert.match(page, /billedPrice\(current.price, current.period\)/);
  assert.match(page, /About \{current.perMonth\} a month\. Billed yearly\./);
  assert.ok(page.indexOf('current?.period === \'year\'') > selection, 'the equivalent should follow the visible period switch');
  assert.match(page, /motif="plans" theme=\{mode\}[^>]*active=\{focused\}/);
  assert.match(page, /mainArtColours\[mode\]\.gold/);
  assert.match(page, /onSelect\(offer\); setComparing\(false\)/);
});

test('phone paywalls reserve the first viewport for the billing switch with a smaller hero and display heading', () => {
  assert.match(page, /const tablet = width >= 768/);
  assert.match(page, /const artWidth = tablet \? 300 : width < 390 \|\| fontScale >= 1.5 \? 220 : 240/);
  assert.match(page, /style=\{\[st.title, !tablet && st.phoneTitle\]\}/);
  assert.match(page, /phoneTitle: \{ \.\.\.type.title/);
  assert.match(page, /title: \{ \.\.\.type.mainDisplay/);
  assert.doesNotMatch(page, /numberOfLines|adjustsFontSizeToFit/);
});
