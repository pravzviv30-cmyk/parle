/**
 * The B Profile and Settings rules (2026-10-20 UI-008, artboards B-Profile and
 * B-Settings): the stats card, the plan card, the counted rows and the free
 * band row, held without a renderer.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import { PLANS } from '@luvani/core';
import {
  PROFILE_VIEW_COPY,
  SOUND_READY,
  freeIncludes,
  freeTimeLine,
  memoryRowTitle,
  planCard,
  profileStats,
  savedCount,
  soundsLine,
  stageWordOf,
} from './profileView.ts';
import { PLAN_LABELS, type PlanStatusView } from '../purchases/planStatus.ts';
import { SETTINGS_COPY, correctsRow, simplerRow } from './sections.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const FREE: PlanStatusView = { known: true, planLabel: PLAN_LABELS.trial, periodLine: 'Free every week.', band: 'plenty', bandLine: '3 free minutes this week, refills Monday', canStart: true };
const CORE: PlanStatusView = { known: true, planLabel: PLAN_LABELS.starter, periodLine: 'Renews monthly.', band: 'plenty', bandLine: 'Plenty of speaking time left.', canStart: true };

describe('Profile, to B-Profile', () => {
  test('the stats card: stage, level over XP, the run; never a nought', () => {
    assert.deepEqual(profileStats({ stage: 'Starter', level: 2, xpTotal: 140, streak: 3 }).map((s) => [s.value, s.label, s.route]), [
      ['Starter', 'stage', 'MyFrench'], ['Level 2', '140 XP', 'MyFrench'], ['3 days', 'streak', 'Streak'],
    ]);
    const none = profileStats({ stage: null, level: null, xpTotal: null, streak: 0 });
    assert.deepEqual(none.map((s) => s.value), [null, null, 'Practice']);
    assert.equal(profileStats({ stage: null, level: null, xpTotal: null, streak: 1 })[2]!.value, '1 day');
    assert.equal(profileStats({ stage: null, level: null, xpTotal: null, streak: null })[2]!.value, null, 'an unread run is drawn as a number');
  });

  test('the plan card names Free only when the plan says so, and says what Free includes', () => {
    const minutes = PLANS.trial.secondsPerPeriod / 60;
    assert.equal(freeIncludes(1), `Practice and review, ${minutes} free minutes of speaking each week, and 1 streak freeze`);
    assert.equal(freeIncludes(null), `Practice and review, and ${minutes} free minutes of speaking each week`, 'an unread freeze count is said');
    assert.deepEqual(planCard(FREE, 1), { title: 'Free', line: freeIncludes(1), action: 'See plans', target: 'Wall' });
    assert.equal(planCard(CORE).title, 'Core');
    assert.equal(planCard(CORE).target, 'Subscription');
    for (const unknown of [null, { known: false, line: 'x' } as PlanStatusView]) {
      assert.equal(planCard(unknown).title, null, 'an unread plan is named');
      assert.notEqual(planCard(unknown, 1).line, freeIncludes(1));
    }
  });

  test('the rows count what exists and say nothing otherwise', () => {
    assert.equal(savedCount(8), '8 saved');
    assert.equal(savedCount(0), null);
    assert.equal(soundsLine(true), SOUND_READY);
    assert.equal(soundsLine(false), null);
    assert.equal(memoryRowTitle('Camille'), 'What Camille remembers');
    assert.equal(stageWordOf({ steps: [{ label: 'Starter', state: 'here' }, { label: 'Basics', state: 'ahead' }] }), 'Starter');
    assert.equal(stageWordOf({ steps: [] }), null);
    for (const line of [...PROFILE_VIEW_COPY, ...SETTINGS_COPY, freeIncludes(1)]) {
      assert.equal(guiltIn(line), undefined, line);
      assert.doesNotMatch(line, /[—–]/, line);
    }
  });

  test('the detached tab bar opens its tab inside Tabs', () => {
    const tab = read('../tabs/ProfileTab.tsx');
    assert.match(tab, /const openTab = \(screen: string\) => \(nav as unknown as \{ navigate: \(screen: string, params\?: object\) => void \}\)\.navigate\('Tabs', \{ screen \}\);/);
    assert.match(tab, /<DetachedTabBar onTab=\{openTab\} \/>/);
  });
});

describe('Settings, to B-Settings', () => {
  test('the free band row says the band in words, and only on the free plan', () => {
    assert.equal(freeTimeLine(FREE), '3 free minutes this week, refills Monday');
    assert.equal(freeTimeLine(CORE), null);
    assert.equal(freeTimeLine(null), null);
    assert.equal(freeTimeLine({ known: false, line: 'x' }), null);
  });

  test('Practice draws the two switches over the Learning preferences stores, and the Appearance row opens Display', () => {
    assert.equal(correctsRow('Camille'), 'How Camille corrects you');
    assert.equal(simplerRow('Camille'), 'Camille speaks more simply');
    const screen = read('./SettingsScreen.tsx');
    assert.match(screen, /onChange=\{\(next\) => update\(withPace\(profile, next \? 'slow' : 'normal'\)\)\}/);
    assert.match(screen, /onChange=\{\(next\) => update\(withPreferTyping\(profile, next\)\)\}/);
    assert.match(screen, /label=\{SPEAKING_TARGET_ROW\} value=\{speakingTarget\} onPress=\{\(\) => nav\.navigate\('LearningPreferences'\)\}/);
    assert.match(screen, /label=\{DISPLAY_ROW\} value=\{displayPreferenceLabel\(preference\)\} onPress=\{\(\) => setSheet\('display'\)\}/);
    assert.match(screen, /<SettingsAppearance b>/);
  });
});

// 2026-10-21 UI-008, simulator check in dark mode.
describe('readable in both themes', () => {
  test('the in-place pages Settings opens are whole light pages, and the avatar initial is ink', () => {
    const screen = read('./SettingsScreen.tsx');
    for (const page of ['<TutorIntro onDone', '<Acknowledgements onBack', '<PolicyScreen onBack', '<TermsScreen onBack']) {
      assert.match(screen, new RegExp(`<PinLight>${page.replace(/[<]/g, '<')}`), `${page} renders inside dark Settings unpinned`);
    }
    assert.match(read('./ProfileParts.tsx'), /s\.initial, \{ color: t\.onMint \}/, 'the initial on the sun disc is not ink in both themes');
  });
});
