/**
 * The draft becomes the account's profile, written the way the spine contract
 * (section 3) says, through the existing doors: reason to `motivation`, minutes
 * to `dailyGoalMin`, starting level to `brain.cefr.estimate`, the seeded goal
 * through `withLearnerGoal`, the first name to the profile name, the voice
 * through `withChosenVoice`, and the reminder through `saveReminder` with
 * `enabled: false` until the OS has granted anything.
 */

import { starterTasks } from '@luvani/core';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

import { DEFAULT_REMINDER_TIME } from '../reminders/reminder.ts';
import { freshPreAccountDraft, repaired, type PreAccountOnboardingDraft } from './preAccountDraft.ts';
import { SEEDED_GOAL, START_LEVELS, REASONS, firstSceneFor, presetMinutes, planFor, tutorGoalsFor } from './plan.ts';
import { profileFromDraft, reminderFromDraft, reminderSummary } from './createFromDraft.ts';
import { streakGuiltIn } from '../copy/guilt.ts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setActiveUser } from '../storage/scope.ts';
import { loadProfile, saveProfile } from '../profile/store.ts';

const NOW = new Date(2026, 8, 27, 12).getTime();
const draft = (extra: Partial<PreAccountOnboardingDraft>): PreAccountOnboardingDraft => ({ ...freshPreAccountDraft(), ...extra });

/** Comments may say anything; only code is under test. */
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const APP = strip(readFileSync(fileURLToPath(new URL('../../App.tsx', import.meta.url)), 'utf8'));

function reviewedPlanRestart() {
  let resolve!: (value: 'done' | 'failed' | 'unavailable') => void;
  let reject!: (reason: Error) => void;
  let cancellation: Promise<'done' | 'failed' | 'unavailable'>;
  const resetCancellation = () => { cancellation = new Promise((done, fail) => { resolve = done; reject = fail; }); };
  resetCancellation();
  const calls: string[] = [];
  const mounted = { current: true }, restarting = { current: false };
  let generation = 1;
  const source = APP.match(/const startAgain = async \(\) => \{[\s\S]*?\n    \};/)?.[0];
  assert.ok(source, 'the account review must retain its explicit start-again action');
  const bindings = { mounted, restarting, scopeGeneration: () => generation, draft: { reminderEnabled: true },
    cancelReminder: () => { calls.push('cancel-reminder'); return cancellation; }, onConsumed: () => calls.push('consume-plan'),
    setRestartBusy: (value: boolean) => calls.push(`busy:${value}`), setBootstrapError: (value: string) => calls.push(`error:${value}`) };
  const run = new Function(...Object.keys(bindings), stripTypeScriptTypes(source) + '\nreturn startAgain;')(...Object.values(bindings)) as () => Promise<void>;
  return { run, resolve: (value: 'done' | 'failed' | 'unavailable') => resolve(value), reject: (error: Error) => reject(error), calls, mounted,
    resetCancellation, switchAccount: () => { generation++; } };
}

test('account review retains its plan when native reminder cancellation fails or rejects', async () => {
  for (const failure of ['failed', 'rejected'] as const) {
    const action = reviewedPlanRestart();
    const pending = action.run();
    assert.ok(!action.calls.includes('consume-plan'));
    if (failure === 'failed') action.resolve('failed');
    else action.reject(new Error('notifications unavailable'));
    await pending;
    assert.ok(!action.calls.includes('consume-plan'), 'a reminder still on the phone must retain its owning plan');
    assert.ok(action.calls.some(call => call.startsWith('error:') && call.length > 6), 'failed cleanup must expose recovery');
  }
});

test('account review waits for cleanup, blocks repeated taps and retries through the same explicit action', async () => {
  const action = reviewedPlanRestart();
  const first = action.run();
  await action.run();
  assert.equal(action.calls.filter(call => call === 'cancel-reminder').length, 1);
  assert.ok(!action.calls.includes('consume-plan'));
  action.resolve('failed');
  await first;
  action.resetCancellation();
  const retry = action.run();
  assert.ok(!action.calls.includes('consume-plan'));
  action.resolve('done');
  await retry;
  assert.equal(action.calls.filter(call => call === 'consume-plan').length, 1);
  assert.equal(action.calls.filter(call => call === 'cancel-reminder').length, 2);
});

test('account review cleanup cannot discard a plan after unmount or an account change', async () => {
  for (const stale of ['unmount', 'account-switch']) {
    const action = reviewedPlanRestart();
    const pending = action.run();
    if (stale === 'unmount') action.mounted.current = false;
    else action.switchAccount();
    const before = [...action.calls];
    action.resolve('done');
    await pending;
    assert.deepEqual(action.calls, before);
    assert.ok(!action.calls.includes('consume-plan'));
  }
});

describe('the plan is written at account creation', () => {
  test('an untouched default is not recorded as a choice, while a legacy voice remains compatible', () => {
    const untouched = profileFromDraft(freshPreAccountDraft(), NOW);
    assert.equal(untouched.tutorVoice, null);
    assert.equal(untouched.preferenceClocks?.tutorVoice, undefined);
    const chosen = profileFromDraft(draft({ tutorVoice: 'marie', tutorChosen: true }), NOW);
    assert.equal(chosen.tutorVoice, 'marie');
    const legacy = draft({ tutorVoice: 'marie' });
    delete legacy.tutorChosen;
    const migrated = repaired(legacy);
    assert.equal(migrated.tutorChosen, undefined);
    assert.equal(profileFromDraft(migrated, NOW).tutorVoice, 'marie');
    assert.equal(profileFromDraft(draft({ tutorVoice: 'marie', tutorChosen: false }), NOW).tutorVoice, null);
  });
  test('focus and confidence persist through existing preference and tutor-goal stores', async () => {
    setActiveUser('onboarding-personal-plan');
    const values = new Map<string, string>();
    const storage = AsyncStorage as unknown as Record<string, unknown>;
    storage.getItem = async (key: string) => values.get(key) ?? null;
    storage.setItem = async (key: string, value: string) => { values.set(key, value); };
    for (const [focus, confidence, preferTyping] of [
      ['speaking', 'comfortable', false], ['speaking', 'hesitant', true], ['listening', 'trying', true], ['words', 'comfortable', true],
    ] as const) {
      const answer = draft({ reason: 'trip', startLevel: 'confident', tutorVoice: 'marie', tutorChosen: true, practiceFocus: focus, speakingConfidence: confidence });
      const profile = profileFromDraft(answer, NOW);
      assert.equal(profile.preferTyping, preferTyping);
      assert.deepEqual(profile.learnerGoals, tutorGoalsFor(answer));
      // F917, 2026-10-29: Feeling confident starts at Everyday, a low-confidence A2.
      assert.equal(profile.brain.cefr.estimate, 'A2');
      assert.deepEqual(profile.practicePreferences, { level: 'confident', confidence, focus, placement: 'everyday' });
      assert.equal(profile.brain.cefr.confidence, 'low');
      assert.deepEqual(profile.brain.cefr.evidence, []);
      assert.equal(await saveProfile(profile), true);
      const loaded = await loadProfile();
      assert.equal(loaded?.preferTyping, preferTyping);
      assert.deepEqual(loaded?.learnerGoals, tutorGoalsFor(answer));
      assert.deepEqual(loaded?.practicePreferences, profile.practicePreferences, 'the stored profile dropped the onboarding starting point');
      assert.equal(loaded?.preferenceClocks?.tutorVoice?.value, 'marie');
    }
    assert.deepEqual(profileFromDraft(freshPreAccountDraft(), NOW).learnerGoals, []);
  });
  test('a chosen voice retains its causal edit through seeded-goal composition and the real store round trip', async () => {
    setActiveUser('onboarding-preference-voice');
    const values = new Map<string, string>();
    const storage = AsyncStorage as unknown as Record<string, unknown>;
    storage.getItem = async (key: string) => values.get(key) ?? null;
    storage.setItem = async (key: string, value: string) => { values.set(key, value); };
    for (const reason of [null, 'work'] as const) {
      const profile = profileFromDraft(draft({ firstName: 'Ada', reason, tutorVoice: 'marie', tutorChosen: true }), NOW);
      assert.equal(await saveProfile(profile), true);
      const loaded = await loadProfile();
      assert.equal(loaded?.tutorVoice, 'marie');
      assert.equal(loaded?.preferenceClocks?.tutorVoice?.value, 'marie');
      assert.deepEqual(loaded?.brain.cefr.evidence, []);
      assert.deepEqual(loaded?.learnerGoals, reason ? [SEEDED_GOAL[reason]] : []);
    }
  });
  test('every level and purpose combination persists exactly the route and tutor goal shown without inventing evidence', () => {
    for (const level of START_LEVELS) for (const reason of [null, ...REASONS.map(option => option.key)]) {
      const answer = draft({ startLevel: level.key, reason });
      const view = planFor(answer);
      const profile = profileFromDraft(answer, NOW);
      assert.equal(view.scenes[0]?.id, firstSceneFor(level.key, reason));
      assert.equal(profile.dailyGoalMin, view.minutes);
      assert.deepEqual(profile.learnerGoals, view.goal === null ? [] : [view.goal]);
      assert.equal(profile.brain.cefr.confidence, 'low');
      assert.deepEqual(profile.brain.cefr.evidence, []);
      assert.match(view.startingReason, /[Hh]elp/);
      assert.equal(view.starter.id, starterTasks(reason)[0]!.id);
      assert.equal(profile.practiceDaysPerWeek, undefined, 'a new profile still carries a days-a-week answer');
      assert.equal(profile.brain.memory.control?.paused, true);
    }
  });

  test('an explicitly unset routine survives account creation without restoring the suggested minutes', () => {
    const answer = draft({ startLevel: 'getby', reason: 'work', minutes: 'none' });
    assert.equal(planFor(answer).minutes, 'none');
    const profile = profileFromDraft(answer, NOW);
    assert.equal(profile.dailyGoalMin, null);
    assert.deepEqual(profile.brain.cefr.evidence, []);
    assert.deepEqual(reminderFromDraft(answer), { enabled: false, time: DEFAULT_REMINDER_TIME });
  });
  test('each answer lands in the field the contract names', () => {
    const profile = profileFromDraft(
      draft({ startLevel: 'getby', reason: 'work', minutes: 10, firstName: 'Ada', tutorVoice: 'marie', tutorChosen: true }),
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

  test('the account review says the reminder is on only when the first run set it, and starting again takes it off the phone', () => {
    // The words follow the fact the bootstrap saves, never a fixed "off".
    assert.equal(reminderSummary(freshPreAccountDraft()), 'The reminder is off.');
    assert.equal(reminderSummary(draft({ reminderTime: 'night' })), 'The reminder is off.', 'a time chosen and never scheduled is said as on');
    assert.equal(reminderSummary(draft({ reminderEnabled: true, reminderTime: 'morning', reminderDays: [] })), 'The reminder is on at about 8:00 am.');
    assert.equal(reminderSummary(draft({ reminderEnabled: true })), 'The reminder is on at about 6:00 pm.', 'a set reminder with no time is not said at the evening it runs at');
    for (const answer of [freshPreAccountDraft(), draft({ reminderEnabled: true, reminderTime: 'lunch' }), draft({ reminderEnabled: false, reminderTime: 'night' })]) {
      const line = reminderSummary(answer);
      assert.equal(line.includes(' on at about '), reminderFromDraft(answer).enabled, `"${line}" disagrees with the reminder the account saves`);
      assert.equal(streakGuiltIn(line), undefined, `"${line}" nags`);
      assert.doesNotMatch(line, /[—–·!]/);
    }

    // The review card reads the draft, and Start a new plan instead takes a
    // first-run reminder off the phone before it lets the draft go.
    const boot = APP.slice(APP.indexOf('function PreAccountProfileBootstrap'), APP.indexOf('function CompleteProfileDraftCleanup')).replace(/\s+/g, ' ');
    assert.ok(boot.includes('Use this starting plan?'), 'the review screen moved; this check reads nothing');
    assert.match(boot, /Optional usage data: \{draft\.analyticsConsent \? 'on' : 'off'\}\. \{reminderSummary\(draft\)\} You can change these choices in Settings\./, 'the review card says something other than the reminder the draft holds');
    assert.doesNotMatch(boot, /The reminder is off\./, 'the review card says off whatever the draft holds');
    assert.match(boot, /draft\.reminderEnabled === true && \(await cancelReminder\(\)\) === 'failed'/, 'starting again must check the native cancellation result before discarding its plan');
    assert.ok(boot.indexOf('await cancelReminder()') < boot.indexOf('onConsumed();', boot.indexOf('const startAgain =')));
    assert.match(boot, /<IconAction layout="inline" icon="edit" label="Start a new plan instead" busy=\{restartBusy\} disabled=\{restartBusy\} onPress=\{\(\) => void startAgain\(\)\} \/>/);
    assert.match(boot, /bootstrapError && <Text accessibilityRole="alert"/);
    assert.match(boot, /label="Use this plan for my account" disabled=\{restartBusy\} onPress=\{\(\) => \{ if \(!restarting\.current\) setConfirmed\(true\); \}\}/, 'adopting the old plan cannot race its cleanup');
    assert.match(APP, /import \{ cancelReminder \} from '\.\/src\/reminders\/schedule\.ts';/);
  });

  test('App.tsx writes consent and the reminder before it releases the app, and opens the first scene', () => {
    // 2026-09-27: keep the ordering pin and require proof the account may adopt a draft.
    const boot = APP.slice(APP.indexOf('function PreAccountProfileBootstrap'), APP.indexOf('function CompleteProfileDraftCleanup'));
    assert.match(APP, /existing === null && preAccountDraft !== null && preAccountDraft\.accountReturnPage !== 'hear-it' && mayAdoptPreAccountDraft\(freshStart\) \? \(\s*<PreAccountProfileBootstrap/);
    assert.match(boot, /const built = profileFromDraft\(draft\)/, 'the bootstrap builds the profile some other way');
    const consent = boot.indexOf('await saveConsent({ allowed: draft.analyticsConsent })');
    const reminder = boot.indexOf('await saveReminder(reminderFromDraft(draft))');
    const release = boot.indexOf('done(built, startPractice)');
    assert.ok(consent > 0 && reminder > consent && release > reminder, 'the app is released before consent and the reminder are written');
    assert.match(boot, /startPractice = shouldStartFirstPractice\(draft, guest\)/, 'the pending practice must use actual guest completion rather than Terms acceptance');
    assert.match(APP, /firstScene\.current = firstRunScene\(preAccountDraft\)/, 'the first scene ignores the starting level');
    assert.match(readFileSync(new URL('./firstPracticeEntry.ts', import.meta.url), 'utf8'), /: firstSceneFor\(draft\.startLevel, draft\.reason, draft\.skipAhead === true\);/, 'outside Save and finish, the plan picks the first scene');
    assert.match(
      APP,
      /navigationRef\.resetRoot\(\{\s*index: 1,\s*routes: \[\{ name: 'Tabs' \}, \{ name: 'FirstScene', params: \{ missionId: firstScene\.current \} \}\]/,
      'a new learner is not sent to the first scene with Today behind it',
    );
    assert.equal(firstSceneFor(null), 'mission:premier-cafe');
  });
});

/**
 * F752: founder decision D5 replaced days a week with a daily goal. Profile v9
 * still reads and carries a days-a-week answer already on a disk (the version
 * chain in `profile/upgrade.ts`), but nothing may write a new one: not account
 * creation from the first-run draft, and not the Profile row that used to ask.
 */
describe('days a week is retired — F752', () => {
  const SRC = fileURLToPath(new URL('..', import.meta.url));
  function sources(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...sources(full));
      else if (/\.tsx?$/.test(entry) && !entry.includes('.test.')) out.push(full);
    }
    return out;
  }

  test('nothing writes practiceDaysPerWeek any more', () => {
    // Account creation from a draft that still holds an old days answer.
    const profile = profileFromDraft(draft({ frequency: 5, reason: 'food', minutes: 10 }), NOW);
    assert.equal('practiceDaysPerWeek' in profile, false, 'a new account is written with a days-a-week answer');

    // And in the code: the only places the field is named are the profile
    // shape, the one retired door that nothing calls, and the version chain
    // that carries an answer already on a disk.
    const CARRIERS = new Set(['profile/store.ts', 'profile/upgrade.ts']);
    const writers: string[] = [];
    for (const path of sources(SRC)) {
      const short = relative(SRC, path).split(sep).join('/');
      const body = strip(readFileSync(path, 'utf8'));
      for (const m of body.matchAll(/withPracticeDays\(/g)) {
        const definition = body.slice(Math.max(0, (m.index ?? 0) - 'export function '.length), m.index) === 'export function ';
        if (!definition) writers.push(`${short} calls withPracticeDays`);
      }
      if (!CARRIERS.has(short) && /practiceDaysPerWeek\s*[:=]/.test(body)) writers.push(`${short} writes practiceDaysPerWeek`);
    }
    assert.deepEqual(writers, [], `the retired days-a-week answer is still written:\n${writers.join('\n')}`);
    // Inside the store, only the retired door itself may name a new value.
    const store = strip(readFileSync(join(SRC, 'profile/store.ts'), 'utf8')).replace(/export function withPracticeDays\([\s\S]*?\n\}/, '');
    assert.doesNotMatch(store, /practiceDaysPerWeek\s*[:=]/, 'the profile store writes the days answer somewhere new');
  });
});
