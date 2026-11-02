/**
 * Today's dev preview (UI-015, `?preview=today-*`): every key is routed, named
 * and drawn at its hour, and the preview draws the parts HomeTab draws, so
 * the screenshots cannot drift from the app. Read as source, no renderer.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { greetingWord } from '../home/greeting.ts';
import { skyView } from '../home/skyView.ts';
import { heldWords } from '../practice/nextTask.ts';
import {
  TODAY_PREVIEW_KEYS, TODAY_PREVIEW_LABELS, TODAY_PREVIEW_STATES,
  TODAY_PREVIEW_HELD_BILLING, TODAY_PREVIEW_LAPSED_BILLING, todayPreviewGame, todayPreviewGreeting, todayPreviewHero, todayPreviewHour, todayPreviewNow, todayPreviewOpen, todayPreviewStarterFeedback, todayPreviewState,
} from './todayPreviewFixtures.ts';

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8');
const strip = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const WANTED = ['today-scene', 'today-fix', 'today-plans', 'today-starter', 'today-offline', 'today-held', 'today-tutor-unreachable', 'today-explore', 'today-loading', 'today-failed', 'today-evening', 'today-night', 'today-starter-feedback', 'today-plans-past', 'today-held-starter'];

describe("Today's preview keys — UI-015", () => {
  test('the fifteen keys route to their state, and nothing else does', () => {
    assert.deepEqual([...TODAY_PREVIEW_KEYS], WANTED);
    for (const key of WANTED) assert.equal(todayPreviewState(key), key.slice('today-'.length), `${key} is not routed`);
    for (const other of ['today', 'today-', 'today-morning', 'your-french-full', 'select', 'scene']) assert.equal(todayPreviewState(other), null, `${other} is routed to Today`);
    assert.equal(TODAY_PREVIEW_STATES.length, 15);
  });

  test('the held preview refills after the fixed now', () => {
    const end = Date.parse(TODAY_PREVIEW_HELD_BILLING.periodEnd ?? '');
    for (const state of TODAY_PREVIEW_STATES) assert.ok(end > todayPreviewNow(todayPreviewHour(state)), `the held preview refills before ${state}'s now`);
  });

  test('every key has a plain label', () => {
    for (const key of TODAY_PREVIEW_KEYS) {
      const label = TODAY_PREVIEW_LABELS[key];
      assert.ok(label.startsWith('Today, '), `${key} has no label`);
      assert.doesNotMatch(label, /—|today-/, `${key}'s label is not plain words`);
    }
  });

  test('the sky is drawn at 9, 20 for the evening and 23 for the night, and the greeting word matches the hour', () => {
    for (const state of TODAY_PREVIEW_STATES) {
      const hour = todayPreviewHour(state);
      assert.equal(hour, state === 'evening' ? 20 : state === 'night' ? 23 : 9);
      assert.equal(new Date(todayPreviewNow(hour)).getHours(), hour, 'the fixed time is not local');
      const greeting = todayPreviewGreeting(hour);
      assert.equal(greeting.word, greetingWord(todayPreviewNow(hour)));
      assert.equal(greeting.title, `${hour >= 18 ? 'Bonsoir' : 'Bonjour'}, Léa.`);
    }
    assert.equal(skyView(todayPreviewHour('evening'), 'light').discKind, 'moon');
    assert.equal(skyView(todayPreviewHour('scene'), 'light').discKind, 'sun');
    assert.equal(todayPreviewHero('evening'), 'scene');
    assert.equal(todayPreviewHero('night'), 'scene');
    assert.equal(todayPreviewHero('fix'), 'fix');
  });

  test('the fixed learner folds through the game layer to a 3-day run, 4 of 10 minutes, level 2, and one of three done', () => {
    const lit = todayPreviewGame(false);
    assert.deepEqual(lit.tiles.streak, { number: '3', label: 'days', lit: true });
    assert.equal(lit.tiles.goal.number, '4');
    assert.equal(lit.tiles.goal.of, '/10');
    assert.equal(lit.tiles.level.number, '2');
    assert.equal(lit.three.done, 1);
    assert.equal(lit.nudge, null, 'a lit day shows the nudge');
    // The nudge is shown on one state only, while the run waits on today.
    const open = todayPreviewGame(true);
    assert.notEqual(open.nudge, null);
    assert.equal(open.tiles.streak.lit, false);
    assert.deepEqual(TODAY_PREVIEW_STATES.filter(todayPreviewOpen), ['evening']);
  });

  test('the preview draws the parts HomeTab draws, through the same layout', () => {
    const preview = strip(read('./TodayPreview.tsx'));
    const home = strip(read('../tabs/HomeTab.tsx'));
    for (const part of ['<TodayLayout', '<SkyBand', '<FixHero', '<TodayFailedHero', '<TodayLoadingHero', '<TodayHeroCard>', '<RouteRow', '<SectionTitle', '<ComingUpCard', '<WeekCard']) {
      assert.ok(home.includes(part), `HomeTab no longer draws ${part}`);
      assert.ok(preview.includes(part), `the preview does not draw ${part}`);
    }
    assert.match(preview, /<ModeScope mode=\{mode\}>/, 'the preview is not re-scoped to its mode');
    // The hero bodies NextTaskCard and LocalPracticeCard draw, as shared parts.
    const task = strip(read('../practice/NextTaskCard.tsx'));
    assert.match(task, /<PlansLeadBody onSun=\{onSun\}/);
    assert.match(task, /return <ExploreLeadBody bare=\{bare\}/);
    assert.match(task, /export function LeadRow\(/);
    assert.match(task, /return <HeldLeadBody bare=\{bare\}/);
    assert.match(strip(read('../practice/LocalPracticeCard.tsx')), /if \(vivid\) return <OfflineLeadBody /);
    assert.match(strip(read('../game/QuestsCard.tsx')), /return <QuestsCardBody card=\{drawn\.model\}/);
    for (const part of ['<PlansLeadBody', '<HeldLeadBody', '<ExploreLeadBody', '<OfflineLeadBody', '<StarterContinuation', '<StarterFeedback ', '<SceneLead', '<LeadRow', '<QuestsCardBody', '<TodayStatTiles ', '<TodayStatTilesSkeleton']) {
      assert.ok(preview.includes(part), `the preview does not draw ${part}`);
    }
    // No storage, navigation or game layer reads in the preview.
    assert.doesNotMatch(preview, /useNavigation|useGame|useProfile|from '\.\.\/[^']*store\.ts'/);
  });

  test('the starter feedback preview draws the sheet part on the sheet ground, from real checks', () => {
    const view = todayPreviewStarterFeedback();
    assert.equal(view.accepted.feedback.accepted, true);
    assert.equal(view.accepted.feedback.text, view.task.success);
    assert.equal(view.missed.feedback.accepted, false);
    assert.equal(view.missed.feedback.model, view.task.model);
    const preview = strip(read('./TodayPreview.tsx'));
    assert.match(preview, /if \(state === 'starter-feedback'\) return <StarterFeedbackSheet/);
    assert.match(preview, /backgroundColor: t\.card/);
    assert.match(preview, /<StarterFeedback reply=\{view\.accepted\.reply\} feedback=\{view\.accepted\.feedback\} \/>/);
    assert.match(preview, /<StarterFeedback reply=\{view\.missed\.reply\} feedback=\{view\.missed\.feedback\} \/>/);
    assert.match(strip(read('../onboarding/StarterContinuation.tsx')), /<StarterFeedback reply=\{reply\} feedback=\{feedback\} \/>/);
  });

  test('the plans past Starter preview drops the café line and opens the review door, as NextTaskCard does', () => {
    const preview = strip(read('./TodayPreview.tsx'));
    const line = preview.split('\n').find((l) => l.includes("case 'plans-past':"));
    assert.ok(line !== undefined, 'today-plans-past is not drawn');
    assert.match(line, /<PlansLeadBody onSun=\{false\} body=\{PLANS_LEAD\.body\}/);
    assert.doesNotMatch(line, /onCafe/, 'the past-Starter preview offers the café line');
    assert.match(line, /onReview=\{said\} reviewLabel=\{TODAY_PREVIEW_REVIEW\.title\}/);
    assert.match(strip(read('../practice/NextTaskCard.tsx')), /onReview=\{cafeOffered \|\| reviewDoor === null \? undefined :/);
  });

  test('the held lead at Starter draws one primary', () => {
    // Founder, 2026-11-01: See plans stays primary; the café line under it is secondary.
    assert.equal(heldWords(TODAY_PREVIEW_LAPSED_BILLING, todayPreviewNow(9)).plans, true, 'the lapsed fixture does not offer plans');
    const preview = strip(read('./TodayPreview.tsx'));
    const line = preview.split('\n').find((l) => l.includes("case 'held-starter':"));
    assert.ok(line !== undefined, 'today-held-starter is not drawn');
    assert.match(line, /const words = heldWords\(TODAY_PREVIEW_LAPSED_BILLING, todayPreviewNow\(hour\)\); return <HeldLeadBody bare words=\{words\}/);
    assert.match(line, /<CafeLineBody [^>]*variant=\{words\.plans \? 'secondary' : 'primary'\}/);
    const task = strip(read('../practice/NextTaskCard.tsx'));
    assert.match(task, /<LocalPracticeCard bare=\{bare\} levelIndex=\{value\.levelIndex\} variant=\{words\.plans \? 'secondary' : 'primary'\} \/>/, 'the held lead hands the café line a primary beside See plans');
    const card = strip(read('../practice/LocalPracticeCard.tsx'));
    assert.match(card, /<CafeLineBody phrase=\{phrase\} bare=\{bare\} variant=\{variant\}/);
    // Secondary, the door is the plans lead's inline headphones action (impeccable, 2026-11-02).
    assert.match(card, /\{variant === 'secondary'\s*\? <IconAction layout="inline" ground=\{bare \? undefined : 'sun'\} icon="headphones" label="Try this line" onPress=\{onTry\} \/>\s*: <PillButton label="Try this line" [^>]*onPress=\{onTry\} \/>\}/);
    assert.doesNotMatch(card, /<PillButton label="Try this line" [^>]*variant=/, 'the café line draws a secondary pill again');
    assert.match(card, /variant = 'primary'/, 'the café line is no longer primary elsewhere');
  });

  test('the screen list routes the keys to the Today preview and hides the chrome for it', () => {
    const list = strip(read('./OnboardingPreview.tsx'));
    assert.match(list, /\.\.\.TODAY_PREVIEW_KEYS, 'select'\] as const/);
    assert.match(list, /\.\.\.TODAY_PREVIEW_LABELS,/);
    assert.match(list, /today !== null \? <TodayPreview state=\{today\} mode=\{yourFrenchMode\} onBack=\{controlsVisible \? \(\) => go\('select'\) : undefined\} \/>/);
    assert.match(list, /going === null && today === null && <View/, 'the preview badge draws over Today');
  });
});
