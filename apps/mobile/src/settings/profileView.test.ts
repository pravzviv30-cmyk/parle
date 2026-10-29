/**
 * The P2 Profile, Learning preferences, Settings and Subscription rules
 * (2026-10-19), held as plain functions and as wiring read out of the screens.
 *
 * No renderer in this suite (docs/TESTING.md): what a screen decides lives in
 * `profileView.ts` and is called here; what a screen does with it is read from
 * its source with comments stripped.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import { PLAN_LABELS, PLAN_UNKNOWN, planStatusFor } from '../purchases/planStatus.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { REASONS } from '../onboarding/plan.ts';
import { STATED_LEVEL_FOOTER, STATED_LEVEL_OPTIONS } from '../profile/practicePreferences.ts';
import { TRIAL_REMINDER_ROW, TRIAL_REMINDER_ROW_SUB } from '../reminders/trialReminder.ts';
import {
  PLAN_CHECKING,
  PLAN_FREE_TITLE,
  PLAN_UNKNOWN_TITLE,
  PROFILE_VIEW_COPY,
  STARTING_POINT_UNSET,
  GOAL_CLEAR,
  GOAL_FOOTER,
  GOAL_OPTIONS,
  GOAL_UNSET,
  onboardingGoalTitle,
  initialOf,
  learningPreferencesSummary,
  learningSince,
  planRow,
  progressSummary,
  showTrialReminder,
  statedLevelTitle,
  subscriptionView,
} from './profileView.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const NOW = Date.UTC(2026, 9, 19, 12);
const DAY = 24 * 60 * 60 * 1000;
const status = (over: Partial<BillingStatus>): BillingStatus => ({
  plan: 'starter', secondsRemaining: 3000, periodEnd: new Date(NOW + 20 * DAY).toISOString(), lapsed: false, canStart: true, reason: null, ...over,
});

describe('an unknown plan is never called Free', () => {
  test('unanswered and unknown name no plan; free minutes say Free only when the server said so', () => {
    const unknown = planStatusFor(null, NOW);
    assert.equal(unknown.known, false);
    for (const view of [null, unknown] as const) {
      const row = planRow(view);
      const screen = subscriptionView(view);
      const words = JSON.stringify([row, screen]);
      assert.doesNotMatch(words, /\bFree\b/, `an unknown plan says Free: ${words}`);
      assert.ok(!words.includes(PLAN_LABELS.trial), 'an unknown plan borrows the free minutes name');
      assert.ok(!words.includes(PLAN_LABELS.starter), 'an unknown plan borrows a paid plan name');
    }
    assert.deepEqual(planRow(null), { label: 'Plan', sub: PLAN_CHECKING });
    assert.deepEqual(planRow(unknown), { label: 'Plan', sub: PLAN_UNKNOWN_TITLE });
    assert.equal(subscriptionView(unknown).kind, 'unknown');
    assert.equal(subscriptionView(null).kind, 'checking');

    const free = planStatusFor(status({ plan: 'trial', secondsRemaining: 300, periodEnd: null }), NOW);
    assert.equal(planRow(free).label, PLAN_FREE_TITLE);
    assert.equal(subscriptionView(free).kind, 'free');
    const paid = planStatusFor(status({}), NOW);
    assert.equal(planRow(paid).label, PLAN_LABELS.starter);
    assert.equal(subscriptionView(paid).kind, 'paid');

    // No count reaches a paid plan line (F377): the band and the period are
    // words. REV-001: the free plan's line says its minutes left, as the design does.
    // F909 (founder decision 9): a paid plan prints the minutes date it was
    // handed (its period end) and no other number. No store answer: no billing date.
    const handed = new Date(NOW + 20 * DAY);
    const printed = JSON.stringify([planRow(paid), subscriptionView(paid)]).replaceAll(`${handed.getDate()} `, '');
    assert.doesNotMatch(printed, /\d/, 'a paid plan line printed a number nobody handed it');
    assert.equal(planRow(free).sub, '5 free minutes left. One free conversation every other day.');
  });

  test('the Subscription screen draws the unknown notice with Try again, and keeps the store rows', () => {
    const screen = stripComments(read('./SubscriptionScreen.tsx'));
    assert.match(screen, /view\.kind === 'unknown' \? \(/, 'the unknown state has no branch of its own');
    assert.match(screen, /onPress=\{plan\.retry\}/, 'Try again does not read the plan again');
    assert.match(screen, /retry: \{ minHeight: 56, borderRadius: radius\.feature/, 'Try again is not the 56pt secondary button');
    assert.match(screen, /store !== null && view\.kind !== 'free' && view\.kind !== 'checking'/, 'Manage is hidden when the plan is unknown');
    assert.match(screen, /\{store !== null \? <SettingsRow label=\{RESTORE_ROW\}/, 'Restore is not offered whatever the plan read said');
    assert.match(screen, /const result = restoreResult\(outcome\);/, 'Restore decides what an outcome means in the screen instead of subscriptionRestore.ts');
    assert.match(screen, /navigate\('Wall', \{ entry: 'settings' \}\)/, 'Compare plans does not open the wall');
    assert.doesNotMatch(screen, /PLAN_LABELS|'Free'/, 'the screen names a plan itself instead of taking the module answer');
    assert.doesNotMatch(screen, /secondsRemaining|allowanceSeconds|periodEnd/, 'the screen reads raw seconds or dates, which F377 refuses');
  });
});

describe('the trial-ending reminder switch', () => {
  test('is shown only on a build that can schedule one, with a trial on record', () => {
    assert.equal(showTrialReminder({ available: true, onRecord: false }), false, 'drawn with no trial on record');
    assert.equal(showTrialReminder({ available: false, onRecord: true }), false, 'drawn on a build with no scheduler');
    assert.equal(showTrialReminder({ available: true, onRecord: true }), true, 'a trial on record has no switch');
    // Permission and the switch's own position never hide it: the row is how
    // a learner who refused or turned it off turns it back on.
    const shape = { available: true, onRecord: true, permission: 'denied', enabled: false, scheduled: false };
    assert.equal(showTrialReminder(shape), true, 'a denied permission or an off switch hides the row');
    // No billing inference: the paid period's last week is not a trial.
    assert.doesNotMatch(stripComments(read('./profileView.ts')), /endsWithinATrialWeek|BillingStatus/, 'the row is still inferred from billing');
  });

  test('Settings draws it only behind that rule, with the module words, and asks for permission in its own row', () => {
    const settings = stripComments(read('./SettingsScreen.tsx'));
    assert.match(settings, /const trialShown = showTrialReminder\(\{ available: trial\.available, onRecord: trial\.onRecord \}\);/);
    assert.match(settings, /\{trialShown && <TrialReminderRow trial=\{trial\}/);
    const row = stripComments(read('./TrialReminderRow.tsx'));
    assert.match(row, /title=\{TRIAL_REMINDER_ROW\}/);
    assert.match(row, /sub=\{view\.sub\}/);
    assert.match(row, /if \(tap === 'ask'\) \{\s*await askReminderPermission\(\);\s*await trial\.refresh\(\);/, 'the dialog is raised without a re-read, or for a learner turning it off');
    assert.match(row, /await trial\.setEnabled\(next\);/);
    assert.match(row, /if \(fresh\.enabled !== next\) setTrouble\(CONSENT_SAVE_TROUBLE\);/, 'a write that did not land is not said');
    assert.match(row, /value=\{pending \?\? view\.value\}/, 'the switch does not go back to the answer the view chose');
    assert.ok(TRIAL_REMINDER_ROW.length > 0 && TRIAL_REMINDER_ROW_SUB.length > 0);
  });
});

describe('the conversation starting point', () => {
  test('saves through withStatedLevel, shows the current sentence as the subtitle, and says the footer', () => {
    const screen = stripComments(read('./LearningPreferencesScreen.tsx'));
    assert.match(screen, /STATED_LEVEL_OPTIONS\.map\(\(option\) => \(/, 'the chooser offers something other than the four options');
    assert.match(screen, /onPress=\{\(\) => update\(withStatedLevel\(profile, option\.key\)\)\}/, 'the choice is written some other way than the store door');
    assert.match(screen, /selected=\{stated === option\.key\}/, 'the chooser does not mark what is set');
    assert.match(screen, /sub=\{statedLevelTitle\(stated\)\}/, 'the long sentence is drawn as a right-aligned value');
    assert.match(screen, /<SettingsGroup title=\{STARTING_POINT_GROUP\} footer=\{STATED_LEVEL_FOOTER\}/, 'the group does not say the earned level stays');
    assert.doesNotMatch(screen, /Proposed/, 'the approved row still carries a Proposed label');
    assert.doesNotMatch(screen, /brain|cefr|withLevel/i, 'the screen reaches for the earned level');
    assert.match(STATED_LEVEL_FOOTER, /earned level stays/);

    for (const option of STATED_LEVEL_OPTIONS) assert.equal(statedLevelTitle(option.key), option.title);
    assert.equal(statedLevelTitle(null), STARTING_POINT_UNSET);
    assert.equal(statedLevelTitle('nonsense' as never), STARTING_POINT_UNSET);
  });
});

describe('the goal in Learning preferences', () => {
  test('titles each goal in onboarding words, and an unset or unknown goal as not chosen', () => {
    for (const reason of REASONS) assert.equal(onboardingGoalTitle(reason.key), reason.title);
    assert.equal(onboardingGoalTitle(null), GOAL_UNSET);
    assert.equal(onboardingGoalTitle(undefined), GOAL_UNSET);
    assert.equal(onboardingGoalTitle('nonsense'), GOAL_UNSET);
  });

  test('offers the six onboarding goals in order, then no goal for now', () => {
    assert.deepEqual(GOAL_OPTIONS.map((option) => option.key), [...REASONS.map((reason) => reason.key), null]);
    assert.deepEqual(GOAL_OPTIONS.map((option) => option.title), [...REASONS.map((reason) => reason.title), GOAL_CLEAR]);
  });

  test('the footer says the earned level stays, and the screen writes only through the store door', () => {
    assert.match(GOAL_FOOTER, /level you’ve earned/);
    assert.doesNotMatch(GOAL_FOOTER, /\u2014/);
    const screen = stripComments(read('./LearningPreferencesScreen.tsx'));
    assert.match(screen, /<SettingsGroup title=\{GOAL_GROUP\} footer=\{GOAL_FOOTER\}/, 'the goal group does not say the earned level stays');
    assert.match(screen, /onPress=\{\(\) => update\(withOnboardingGoal\(profile, option\.key\)\)\}/, 'the goal is written some other way than the store door');
    assert.match(screen, /GOAL_OPTIONS\.map\(\(option\) => \(/, 'the goal chooser offers something other than the seven options');
    assert.ok(screen.indexOf('title={GOAL_GROUP}') < screen.indexOf('title={STARTING_POINT_GROUP}'), 'the goal group no longer sits before the starting point');
  });
});

describe('the small lines Profile says', () => {
  test('learning since, the initial, and the two summaries', () => {
    assert.equal(learningSince(new Date(2026, 9, 3).getTime()), 'Learning French since October 2026');
    for (const junk of [undefined, null, 0, -1, Number.NaN, '2026']) assert.equal(learningSince(junk), null);
    assert.equal(initialOf('  émile'), 'É');
    assert.equal(initialOf(null), 'Y');

    const summary = learningPreferencesSummary({ dailyGoalMin: null, strictness: 'balanced', slow: true });
    assert.match(summary, /^No goal, Balanced corrections, Simpler French on$/);
    assert.equal(progressSummary({ level: null, cefr: null, confidence: null, days: null }), null);
    assert.equal(progressSummary({ level: 3, cefr: 'A2', confidence: 'medium', days: 12 }), 'Level 3, A2, 12 practice days');
    assert.equal(progressSummary({ level: 3, cefr: 'A2', confidence: 'low', days: 1 }), 'Level 3, 1 practice day', 'a tentative estimate is shown as a level');
  });

  test('every word is in the copy list and clears the house bar', () => {
    for (const line of PROFILE_VIEW_COPY) {
      assert.ok(line.trim().length > 0);
      assert.equal(guiltIn(line), undefined, `guilt in profile copy: ${line}`);
      assert.doesNotMatch(line, /[—–·]/, `a dash or middot in profile copy: ${line}`);
      assert.doesNotMatch(line, /take your time|sorry/i, `a remark about hesitating or an apology: ${line}`);
    }
    assert.ok(PROFILE_VIEW_COPY.includes(PLAN_UNKNOWN_TITLE) && (PLAN_UNKNOWN_TITLE as string) !== PLAN_UNKNOWN);
  });
});

describe('the two new routes are registered and addressable', () => {
  test('LearningPreferences and Subscription are declared, pushed and on the web', () => {
    const types = stripComments(read('../nav/types.ts'));
    const navigator = stripComments(read('../nav/RootNavigator.tsx'));
    const linking = stripComments(read('../nav/linking.ts'));
    for (const [name, path] of [['LearningPreferences', 'learning-preferences'], ['Subscription', 'subscription']] as const) {
      assert.match(types, new RegExp(`\\n  ${name}: undefined;`), `${name} is not declared`);
      assert.match(navigator, new RegExp(`<Stack\\.Screen name="${name}" component=\\{${name}Screen\\} />`), `${name} is not registered`);
      assert.match(linking, new RegExp(`${name}: '${path}'`), `${name} has no address`);
    }
  });
});

describe('the back button follows the appearance on the three P2 screens, opt-in only', () => {
  test('Settings, Learning preferences and Subscription opt in; the shared default is unchanged', () => {
    for (const file of ['./LearningPreferencesScreen.tsx', './SubscriptionScreen.tsx']) {
      const body = stripComments(read(file));
      assert.equal((body.match(/<ScreenHeader\b/g) ?? []).length, 1, `${file} has more than one way back`);
      assert.match(body, /backAppearance=\{\{ disc: colors\.surface, mark: colors\.text \}\}/, `${file} does not opt in`);
    }
    // 2026-10-20 UI-008, artboard B-Settings: Settings draws the B back disc
    // beside its title, which reads the theme itself, and still only one way back.
    const settings = stripComments(read('./SettingsScreen.tsx'));
    assert.equal((settings.match(/<ScreenHeader\b/g) ?? []).length, 0, 'Settings draws the old header as well as the B back disc');
    assert.equal((settings.match(/<BackButton\b/g) ?? []).length, 1, 'Settings has no way back, or more than one');
    const layout = stripComments(read('../layout.tsx'));
    assert.match(layout, /accessibilityLabel=\{back\.label \?\? 'Back'\} disabled=\{back\.disabled\} appearance=\{props\.backAppearance\}/);
    const components = stripComments(read('../components.tsx'));
    // Absent, the tone decides exactly as before: white disc, ink mark, 44pt.
    // 2026-10-20, UI-008: shared parts read the theme (useB); b.light equals these paper values (palette.test.ts).
    assert.match(components, /const fill = appearance\?\.disc \?\? \(ground === 'white' \? t\.card : ground === 'sun' \? colour\.sun : paper\.ink\);/);
    assert.match(components, /const markColour = appearance\?\.mark \?\? \(ground === 'ink' \? paper\.onInk : ground === 'white' \? t\.text : paper\.ink\);/);
    assert.match(components, /const disc = next \? HIT \+ space\(5\) : HIT;/);
    // Nobody else opts in yet (F846 tracks adopting it app-wide).
    const users = ['../tabs/ProfileTab.tsx', '../profile/TutorMemoryScreen.tsx'].filter((f) => read(f).includes('backAppearance'));
    assert.deepEqual(users, []);
  });
});
