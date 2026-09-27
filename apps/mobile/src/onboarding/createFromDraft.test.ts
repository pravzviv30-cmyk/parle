/**
 * The draft becomes the account's profile, written the way the spine contract
 * (section 3) says, through the existing doors: reason to `motivation`, minutes
 * to `dailyGoalMin`, starting level to `brain.cefr.estimate`, the seeded goal
 * through `withLearnerGoal`, the first name to the profile name, the voice
 * through `withChosenVoice`, and the reminder through `saveReminder` with
 * `enabled: false` until the OS has granted anything.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { DEFAULT_REMINDER_TIME } from '../reminders/reminder.ts';
import { freshPreAccountDraft, type PreAccountOnboardingDraft } from './preAccountDraft.ts';
import { SEEDED_GOAL, firstSceneFor, presetMinutes } from './plan.ts';
import { profileFromDraft, reminderFromDraft } from './createFromDraft.ts';

const NOW = new Date(2026, 8, 27, 12).getTime();
const draft = (extra: Partial<PreAccountOnboardingDraft>): PreAccountOnboardingDraft => ({ ...freshPreAccountDraft(), ...extra });

/** Comments may say anything; only code is under test. */
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const APP = strip(readFileSync(fileURLToPath(new URL('../../App.tsx', import.meta.url)), 'utf8'));

describe('the plan is written at account creation', () => {
  test('each answer lands in the field the contract names', () => {
    const profile = profileFromDraft(
      draft({ startLevel: 'getby', reason: 'work', minutes: 10, firstName: 'Ada', tutorVoice: 'marie' }),
      NOW,
    );
    assert.equal(profile.name, 'Ada', 'the first name did not reach the profile');
    assert.equal(profile.motivation, 'work', 'the reason did not reach motivation');
    assert.equal(profile.dailyGoalMin, 10, 'the minutes did not reach dailyGoalMin');
    assert.equal(profile.brain.cefr.estimate, 'A1', 'I can get by did not start at A1');
    assert.equal(profile.brain.cefr.confidence, 'low', 'a self-report was stored as more than a low-confidence guess');
    assert.deepEqual(profile.brain.cefr.evidence, [], 'a self-report was stored as evidence');
    assert.deepEqual(profile.learnerGoals, [SEEDED_GOAL.work], 'the seeded goal did not reach the tutor’s goals');
    assert.equal(profile.tutorVoice, 'marie', 'the voice chosen on the plan was dropped');
    assert.equal(profile.ageConfirmed, true);
    assert.equal(profile.onboardedAt, NOW);
  });

  test('untouched answers write the plan the learner was shown, and a skipped reason writes nothing', () => {
    const profile = profileFromDraft(freshPreAccountDraft(), NOW);
    assert.equal(profile.name, null, 'an empty name became a name');
    assert.equal(profile.motivation, null, 'a skipped reason became a motivation');
    assert.deepEqual(profile.learnerGoals, [], 'a skipped reason seeded a goal anyway');
    assert.equal(profile.dailyGoalMin, presetMinutes('zero', null), 'the minutes shown on the plan were not the minutes saved');
    assert.equal(profile.brain.cefr.estimate, 'A0');
  });

  test('the reminder is saved at the plan’s time and stays off', () => {
    assert.deepEqual(reminderFromDraft(freshPreAccountDraft()), { enabled: false, time: DEFAULT_REMINDER_TIME });
    assert.deepEqual(reminderFromDraft(draft({ reminderTime: 'night' })), { enabled: false, time: 'night' });
  });

  test('App.tsx writes consent and the reminder before it releases the app, and opens the first scene', () => {
    // 2026-09-27: keep the ordering pin and require proof the account may adopt a draft.
    const boot = APP.slice(APP.indexOf('function PreAccountProfileBootstrap'), APP.indexOf('function CompleteProfileDraftCleanup'));
    assert.match(APP, /existing === null && preAccountDraft !== null && mayAdoptPreAccountDraft\(freshStart\) \? \(\s*<PreAccountProfileBootstrap/);
    assert.match(boot, /const built = profileFromDraft\(draft\)/, 'the bootstrap builds the profile some other way');
    const consent = boot.indexOf('await saveConsent({ allowed: draft.analyticsConsent })');
    const reminder = boot.indexOf('await saveReminder(reminderFromDraft(draft))');
    const release = boot.indexOf('done(built)');
    assert.ok(consent > 0 && reminder > consent && release > reminder, 'the app is released before consent and the reminder are written');
    assert.match(APP, /firstScene\.current = firstSceneFor\(preAccountDraft\.startLevel\)/, 'the first scene ignores the starting level');
    assert.match(
      APP,
      /navigationRef\.resetRoot\(\{\s*index: 1,\s*routes: \[\{ name: 'Tabs' \}, \{ name: 'FirstScene', params: \{ missionId: firstScene\.current \} \}\]/,
      'a new learner is not sent to the first scene with Today behind it',
    );
    assert.equal(firstSceneFor(null), 'mission:premier-cafe');
  });
});
