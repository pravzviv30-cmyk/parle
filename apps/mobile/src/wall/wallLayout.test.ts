import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PLANS } from '@luvani/core';
import { trialTimeline } from './trialTimeline.ts';
import { chosenOffer, storeTrialMinutes, wallPlanRows } from './wallPlans.ts';
import { TRIAL_SCENE_TOP_MIN_HEIGHT, timelineRows, trialScenePlace } from './trialPaywall.ts';
import type { StoreProduct } from '../purchases/contract.ts';

const page = readFileSync(new URL('./WallPlansPage.tsx', import.meta.url), 'utf8');
const periods = readFileSync(new URL('./WallPeriodSwitch.tsx', import.meta.url), 'utf8');
const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const parts = readFileSync(new URL('./WallParts.tsx', import.meta.url), 'utf8');

test('the paywall presents the trial as connected stops on one route without dropping the verified allowance or changing the timeline', () => {
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
    // F932 (founder decision 6): the glyphs (lock, bell, calendar, star) became stops on a
    // route, and a quiet learning stop joins between today and the reminder or cancel day.
    assert.deepEqual(rows.map(row => row.key), ['today', 'walk', remind ? 'remind' : 'cancel', 'then']);
    assert.deepEqual(rows.map(row => row.title), ['Today', null, remind ? 'Day 5' : 'Before day 7', 'Day 7']);
    assert.deepEqual(rows.map(row => row.mark), ['start', 'stop', 'stop', 'end']);
    assert.match(rows[0]!.line, /Nothing is charged today/);
    if (minutes === null) assert.doesNotMatch(rows[0]!.line, /minutes/);
    else assert.match(rows[0]!.line, /up to 70 minutes/);
    assert.match(rows[3]!.line, /£19.99 a month/);
    assert.deepEqual(timeline, before, 'presentation changed the authoritative timeline view');
  }
  assert.match(page, /const rows = timelineRows\(view\);/);
  // The route's line and dots come from b (useMainAppearance) so the wall follows dark (UI-008).
  assert.match(page, /index < rows.length - 1 && <View style=\{\[st.route, \{ backgroundColor: b.brand \}\]\} \/>/);
  assert.match(page, /const STOP = 16;/);
  assert.match(page, /route: \{ flex: 1, width: 2, marginTop: space\(0.5\), opacity: 0.35 \}/);
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

test('the paywall reading order: a trial says its route before the switch, a standard page its switch before the benefits', () => {
  const scene = page.indexOf("{scene === 'top' && <TrialScene />}");
  const sceneEnd = page.indexOf("{scene === 'end' && <TrialScene />}");
  const headline = page.indexOf('{offer.headline}');
  const billed = page.indexOf('{offer.billed}');
  const standardSwitch = page.indexOf('{trial === null && periodSwitch}');
  const timeline = page.indexOf('<TrialTimeline view={trial}');
  const trialSwitch = page.indexOf('{trial !== null && periodSwitch}');
  const benefits = page.indexOf('offer.benefits.map(');
  const plan = page.indexOf('planLine(visibleRow, current, catalogue)');
  // F932 (founder decision 6), changed on purpose 2026-10-29: on a trial the route through the
  // charge day comes before the period switch, so it stays above the footer on a 375x812 phone.
  assert.ok(scene >= 0 && scene < headline && headline < billed && billed < standardSwitch && standardSwitch < timeline && timeline < trialSwitch && trialSwitch < benefits && benefits < plan);
  // Changed on purpose 2026-10-29 (founder decision 6, F932): the trial page carries one of
  // Luvani's own scenes, the cafe counter, at its own size; on a screen too short to lead with
  // it, it follows the plan line, after every fact. The standard page keeps none.
  assert.equal(page.match(/<Illustration\b/g)?.length, 1, 'the paywall draws more than its one scene');
  assert.ok(sceneEnd > plan, 'the short-screen scene comes before the plan line');
  assert.match(page, /const scene = offer\?\.kind === 'trial' && !loading \? trialScenePlace\(usableHeight, fontScale\) : null;/);
  assert.doesNotMatch(page, /MainIllustration|motif=/);
  assert.match(page, /onSelect\(offer\); setComparing\(false\)/);
});

test('the paywall sets type at the approved sizes and never clips it', () => {
  // Every size is a theme token (the surface contract refuses raw sizes).
  assert.match(parts, /headline: \{ \.\.\.type.title, textAlign: 'center' \}/);
  // 2026-10-21 UI-008: the CTA's blue and white come from b.brand / b.onBrand, equal to colour.blue / paper.onInk in light (palette.test.ts).
  assert.match(parts, /cta: \{ minHeight: 56, borderRadius: 28, flexDirection/);
  assert.match(parts, /style=\{\[st.cta, \{ backgroundColor: b.brand, opacity: dim \}\]\}/);
  assert.match(parts, /ctaLabel: \{ \.\.\.type.button, textAlign/);
  assert.match(parts, /style=\{\[st.ctaLabel, \{ color: b.onBrand \}\]\}/);
  assert.doesNotMatch(page + parts + periods, /fontSize:/);
  assert.doesNotMatch(page + parts + periods, /numberOfLines|adjustsFontSizeToFit/);
});

/**
 * The charge day stays in view (F932): on a 375x812 phone at default text size
 * (safe areas 47 and 34), the trial route from Today through the charge day
 * must sit above the pinned footer without a scroll. No renderer, so this adds
 * up the spacing the stylesheet asks for (read from source) and the type
 * tokens' line heights, with line counts for the longest default trial (Max
 * yearly, 319pt column, route words about 281pt wide). The footer was measured
 * on the live web build at 375x812: 259pt with its 16pt bottom padding, to
 * which a phone adds its bottom inset. The scene only leads the page on a
 * screen tall enough to hold it as well (`TRIAL_SCENE_TOP_MIN_HEIGHT`).
 */
test('the trial route through the charge day fits above the pinned footer on a 375 by 812 phone', () => {
  const spaced = (name: string): number => {
    const at = page.match(new RegExp(`\\b${name}: \\{[^}]*?(?:marginTop|paddingTop|paddingBottom|marginVertical): space\\(([\\d.]+)\\)`));
    assert.ok(at, `st.${name} has no spacing token the budget can read`);
    return Number(at[1]) * 4;
  };
  const SAFE_TOP = 47, SAFE_BOTTOM = 34, HEADER = 44, FOOTER = 259;
  const stop = (lines: number) => 25 + 2 + lines * 20;
  const route =
    spaced('content') + 2 * 38 /* "Your first week with Max", two lines of type.title */ +
    spaced('offer') + 23 /* offer line */ + spaced('detail') + 20 /* detail */ +
    spaced('trialSummary') + stop(3) /* Today, with the minutes */ + 20 /* learning stop */ +
    stop(2) /* reminder or cancel day */ + stop(1) /* the charge day */ + 3 * spaced('nodeGap');
  const available = 812 - SAFE_TOP - SAFE_BOTTOM - HEADER - FOOTER;
  assert.ok(route <= available, `the charge day ends ${route}pt down and the footer starts at ${available}pt`);
  // Nothing decorative or chosen comes before the charge day on a trial.
  assert.ok(page.indexOf('<TrialTimeline view={trial}') < page.indexOf('{trial !== null && periodSwitch}'));
  assert.equal(trialScenePlace(812 - SAFE_TOP - SAFE_BOTTOM), 'end');
  // Leading with the scene (Illustration's small fit, 165pt, and its margins) must leave the charge day in view.
  const scene = 165 + 2 * spaced('art');
  assert.ok(TRIAL_SCENE_TOP_MIN_HEIGHT >= HEADER + FOOTER + route + scene, 'the scene can lead on a screen that would push the charge day below the footer');
  // Larger text still scrolls: the body is in ScrollScreen and nothing clips.
  assert.match(read('./WallScreen.tsx'), /<ScrollScreen\s+ground=\{colors.background\}/);
});
