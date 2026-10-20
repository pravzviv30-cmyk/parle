import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PLANS } from '@luvani/core';
import { trialTimeline } from './trialTimeline.ts';
import { chosenOffer, storeTrialMinutes, wallPlanRows } from './wallPlans.ts';
import { TIMELINE_GLYPHS, timelineRows } from './trialPaywall.ts';
import type { StoreProduct } from '../purchases/contract.ts';

const page = readFileSync(new URL('./WallPlansPage.tsx', import.meta.url), 'utf8');
const periods = readFileSync(new URL('./WallPeriodSwitch.tsx', import.meta.url), 'utf8');
const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const parts = readFileSync(new URL('./WallParts.tsx', import.meta.url), 'utf8');

test('the paywall presents three connected trial moments without dropping the verified allowance or changing the timeline', () => {
  const month: StoreProduct = { plan: 'starter', productId: 'month', title: 'Core', localizedPrice: '£19.99', period: 'month',
    intro: { priceString: '£0.00', periodUnit: 'WEEK', periodNumberOfUnits: 1, cycles: 1 }, introEligible: true };
  const chosen = chosenOffer(wallPlanRows({ available: true, products: [month] }, PLANS), month.productId)!;
  for (const remind of [false, true]) for (const minutes of [null, storeTrialMinutes(PLANS, 'starter')]) {
    const timeline = trialTimeline({ offer: chosen, minutes, remind })!;
    const before = structuredClone(timeline);
    timeline.nodes.forEach(Object.freeze);
    Object.freeze(timeline.nodes);
    Object.freeze(timeline);
    const rows = timelineRows(timeline);
    assert.deepEqual(rows.map(row => row.key), ['today', remind ? 'remind' : 'cancel', 'then']);
    assert.deepEqual(rows.map(row => row.title), ['Today', remind ? 'Day 5' : 'Before day 7', 'Day 7']);
    // Open lock, then the bell (a reminder) or the calendar (the day to cancel by), then the star.
    assert.deepEqual(rows.map(row => TIMELINE_GLYPHS[row.key]), ['unlock', remind ? 'bell' : 'calendar', 'star']);
    assert.match(rows[0]!.line, /Nothing is charged today/);
    if (minutes === null) assert.doesNotMatch(rows[0]!.line, /minutes/);
    else assert.match(rows[0]!.line, /up to 42 minutes/);
    assert.match(rows[2]!.line, /£19.99 a month/);
    assert.deepEqual(timeline, before, 'presentation changed the authoritative timeline view');
  }
  assert.match(page, /const rows = timelineRows\(view\);/);
  assert.match(page, /index < rows.length - 1 && <View style=\{st.connector\} \/>/);
  assert.match(page, /const DISC = 28;/);
  assert.match(page, /connector: \{ flex: 1, width: 3, backgroundColor: colour.sun, opacity: 0.45 \}/);
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

test('the paywall reading order is headline, billed amount, period selection, timeline or benefits, then the plan line, with no hero art', () => {
  const headline = page.indexOf('{offer.headline}');
  const billed = page.indexOf('{offer.billed}');
  const selection = page.indexOf('<WallPeriodSwitch');
  const timeline = page.indexOf('<TrialTimeline view={trial}');
  const benefits = page.indexOf('offer.benefits.map(');
  const plan = page.indexOf('planLine(visibleRow, current, catalogue)');
  assert.ok(headline >= 0 && headline < billed && billed < selection && selection < timeline && timeline < benefits && benefits < plan);
  assert.doesNotMatch(page, /MainIllustration|<Illustration|motif=/, 'the approved paywall has no hero art');
  assert.match(page, /onSelect\(offer\); setComparing\(false\)/);
});

test('the paywall sets type at the approved sizes and never clips it', () => {
  // Every size is a theme token (the surface contract refuses raw sizes).
  assert.match(parts, /headline: \{ \.\.\.type.title, textAlign: 'center' \}/);
  assert.match(parts, /cta: \{ minHeight: 56, borderRadius: 28, backgroundColor: colour.blue/);
  assert.match(parts, /ctaLabel: \{ \.\.\.type.button, color: paper.onInk/);
  assert.doesNotMatch(page + parts + periods, /fontSize:/);
  assert.doesNotMatch(page + parts + periods, /numberOfLines|adjustsFontSizeToFit/);
});

/**
 * 390x844 at default text size, no preview banner: headline through the plan
 * line must fit above the pinned footer. No renderer, so this adds up the
 * spacing the stylesheets ask for (read from source) and the line heights of
 * the type tokens, with each text block's line count stated for the trial
 * default (Starter yearly, 334pt column, timeline words 292pt wide).
 */
test('the trial paywall fits above the pinned footer on a 390 by 844 phone at default text size', () => {
  const spaced = (name: string): number => {
    const at = page.match(new RegExp(`\\b${name}: \\{[^}]*?(?:marginTop|paddingTop|paddingBottom): space\\(([\\d.]+)\\)`));
    assert.ok(at, `st.${name} has no spacing token the budget can read`);
    return Number(at[1]) * 4;
  };
  const SAFE_TOP = 47, SAFE_BOTTOM = 34, HEADER = 44;
  // Footer: its 12pt top, the 56pt button, 10pt gaps, a two-line 14/20 disclosure, the 44pt links row.
  const footer = 12 + 56 + 10 + 2 * 20 + 10 + 44;
  const available = 844 - SAFE_TOP - SAFE_BOTTOM - HEADER - footer;
  const timelineRow = (lines: number) => 3 + 25 + 2 + lines * 20;
  const content =
    spaced('content') + 33 /* headline, one line of type.title */ +
    10 + 23 /* offer line, mainBody */ + 4 + 20 /* detail, small */ +
    spaced('switch') + 52 /* switch: 44pt segments in a 4pt-padded track */ +
    spaced('trialSummary') + timelineRow(3) + timelineRow(2) + timelineRow(1) + 2 * spaced('nodeGap') +
    spaced('planLine') + 44 /* plan line, 44pt floor */;
  assert.equal(spaced('nodeGap'), 16);
  assert.ok(content <= available, `the trial paywall needs ${content}pt and has ${available}pt above the footer`);
  // Larger text still scrolls: the body is in ScrollScreen and nothing clips.
  assert.match(read('./WallScreen.tsx'), /<ScrollScreen\s+ground=\{colors.background\}/);
});
