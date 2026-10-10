import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evidence } from '../../../test/evidence.ts';
import { freshPreAccountDraft } from '../preAccountDraft.ts';
import { START_LEVELS, initialPracticeMode, practiceForecast } from '../plan.ts';

const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');

/** Execute the production handoff function with deferred storage and account changes. */
async function finishHandoff({ saved = true, newlyCreated = true, changeAt = '', storageFails = false, repeated = false, unmountAt = '' } = {}) {
  const handoff = evidence('apps/mobile/src/onboarding/GuestAccountHandoff.tsx');
  const source = handoff.slice(handoff.indexOf('const finish = async () => {'), handoff.indexOf('if (readError) return'));
  assert.ok(source.startsWith('const finish'), 'this check must execute the production finish');
  let owner = 1;
  let uid = 'new-user';
  const calls: string[] = [];
  const mounted = { current: true };
  const changeAccount = () => { owner += 1; uid = 'other-user'; };
  const bindings = {
    user: { id: 'new-user' }, guest: { completed: true }, busy: false, saved, newlyCreated, resumeAdoption: false,
    operation: { current: false }, finished: { current: false }, mounted,
    scopeGeneration: () => owner, activeUserId: () => uid,
    setBusy: (value: boolean) => calls.push(value ? 'busy' : 'idle'),
    setError: (value: string) => { if (value) calls.push('error'); },
    adoptGuestUsage: async () => { calls.push('claim'); if (changeAt === 'claim') changeAccount(); if (unmountAt === 'claim') mounted.current = false; },
    clearGuestPractice: async () => {
      calls.push('clear');
      if (changeAt === 'clear') changeAccount();
      if (unmountAt === 'clear') mounted.current = false;
      if (storageFails) throw new Error('storage unavailable');
    },
    setWelcoming: () => calls.push('welcome'), setGuest: () => calls.push('guest-null'),
    onDone: (kept: boolean) => calls.push(kept ? 'done-kept' : 'done-fresh'),
  };
  await new Function(...Object.keys(bindings), `${source}; return ${repeated ? 'Promise.all([finish(), finish()])' : 'finish()'};`)(...Object.values(bindings));
  return calls;
}

describe('the personal onboarding journey', () => {
  test('all four level choices are readable full rows and selection does not advance', () => {
    assert.equal(START_LEVELS.length, 4);
    assert.ok(START_LEVELS.every(level => level.title.trim().length > 0));
    const levels = screen.slice(screen.indexOf("{page === 'start-level' && START_LEVELS.map"), screen.indexOf("{(page === 'confidence' || page === 'focus')"));
    assert.ok(levels.length > 0, 'this check must read the actual level choice group');
    assert.match(levels, /width="100%"/);
    assert.match(levels, /layout="row"/);
    assert.match(levels, /title=\{v\.title\}/);
    assert.match(levels, /choose\(\{ startLevel: v\.key \}\)/);
    assert.doesNotMatch(levels, /numberOfLines|ellipsizeMode|go\(/);
  });

  test('tutor selection is deliberate and hearing does not silently choose or record', () => {
    const tutors = evidence('apps/mobile/src/onboarding/TutorSelection.tsx');
    assert.match(screen, /chosen=\{draft\.tutorChosen \? draft\.tutorVoice : null\}/);
    assert.match(screen, /choose\(\{ tutorVoice: voice, tutorChosen: true \}\)/);
    assert.match(tutors, /onPress=\{\(\) => onChoose\(voice\.value\)\}/);
    assert.match(tutors, /onPress=\{\(\) => preview \? preview\.toggle\(voice\.value\) : onHear\?\.\(voice\.value\)\}/);
    assert.match(tutors, /const selected = chosen === voice\.value/);
    assert.match(tutors, /accessibilityState=\{\{ checked: selected \}\}/);
    assert.doesNotMatch(tutors, /requestRecordingPermissions|player\.play|onChoose\(voice\.value\);\s*onHear/);
    assert.equal(initialPracticeMode({ ...freshPreAccountDraft(), practiceFocus: 'listening' }), 'typed');
    assert.equal(initialPracticeMode({ ...freshPreAccountDraft(), practiceFocus: 'speaking', speakingConfidence: 'hesitant' }), 'typed');
  });

  test('the streak achievement renders saved facts on its full screen and continues to saving', () => {
    const home = evidence('apps/mobile/src/onboarding/HomeArrival.tsx');
    assert.doesNotMatch(screen, /<StreakCelebrationScreen/);
    assert.match(home, /HOME_ARRIVAL_DELAY = 1500/);
    assert.match(home, /!ready \|\| !allowed \|\| !focused/);
    assert.match(home, /await saveArrival\(\{ \.\.\.value, streakSeen: true \}\)/);
    assert.match(home, /<StreakCelebrationScreen streak=\{streak\} today=\{today\}/);
    assert.match(home, /onContinue=\{\(\) => setArrival\(null\)\}/);
    const celebration = evidence('apps/mobile/src/onboarding/firstRun/StreakCelebrationScreen.tsx');
    assert.match(celebration, /streakCelebrationView\(streak, today\)/);
    assert.match(celebration, /'Continue learning'/);
    assert.match(celebration, /model\.countLabel/);
    assert.doesNotMatch(celebration, /finishGuestPractice\(|saveGuestPractice\(|recordActiveDay\(|Practice Everyday|Start Your French/);
    const words = evidence('apps/mobile/src/onboarding/firstRun/streakCelebrationView.ts');
    assert.match(words, /Your streak has started\./);
    assert.match(words, /Your streak continues\./);
    assert.match(words, /Practise every day to carry on the streak\./);
  });

  test('the optional reminder opens an existing time-confirmation sheet only after an explicit choice', () => {
    const home = evidence('apps/mobile/src/onboarding/HomeArrival.tsx');
    assert.doesNotMatch(home, /onReminder=|askReminderPermission|requestPermissionsAsync/);
    assert.doesNotMatch(screen, /<StreakCelebrationScreen/);
    const celebration = evidence('apps/mobile/src/onboarding/firstRun/StreakCelebrationScreen.tsx');
    assert.match(celebration, /Remind me tomorrow/);
    assert.doesNotMatch(celebration, /askReminderPermission\(|requestPermissionsAsync\(|turnOnReminder\(/);
    assert.doesNotMatch(screen, /<ReminderAsk|surface === 'reminder'/);
    const recap = evidence('apps/mobile/src/RecapScreen.tsx');
    assert.match(recap, /<ReminderAsk/);
  });

  test('saved achievements reveal truthful content and the primary action opens signup', () => {
    const saved = evidence('apps/mobile/src/onboarding/FirstSessionResult.tsx');
    assert.match(saved, /firstLiveSummary\(record\)/);
    assert.match(saved, /view\.achievements\.map/);
    assert.match(saved, /<RevealItem index=\{index\}/);
    assert.match(saved, /Save your progress/);
    assert.match(screen, /<FirstSessionSummary[^;]*onSave=\{\(\) => void saveAccount\(\)\}/);
    assert.doesNotMatch(saved, /fluent|fluency|pronunciation score/i);
    assert.match(screen, /label=\{FIRST_RUN_COPY\.saveMyProgress\}[^>]*onPress=\{\(\) => void saveAccount\(\)\}/);
    assert.equal(practiceForecast(10)?.hours, 15);
    assert.equal(practiceForecast('none'), null);
  });

  test('automatic progress adoption is confined to the verified new account and finishes durable writes before celebration', () => {
    const app = evidence('apps/mobile/App.tsx');
    const handoff = evidence('apps/mobile/src/onboarding/GuestAccountHandoff.tsx');
    assert.match(app, /const newlyCreated = newAccountUserId === user\.id;/);
    assert.match(app, /newlyCreated=\{newlyCreated\}/);
    assert.match(handoff, /newlyCreated = false/);
    assert.match(handoff, /value\?\.live\?\.sessionId === arrival\?\.sessionId && arrival && !arrival\.welcomeSeen/);
    assert.match(handoff, /loadArrival\(\)/); // Account-scoped durable receipt permits crash recovery.
    assert.match(handoff, /if \(\(!newlyCreated && !resumeAdoption\) \|\| guest === undefined \|\| busy \|\| autoStarted\.current\) return;/);
    assert.match(handoff, /if \(\(newlyCreated \|\| resumeAdoption\) && saved && !busy && guest !== null && guest !== undefined && !autoFinished\.current\) \{ autoFinished\.current = true; void finish\(\);/);
    assert.ok(handoff.indexOf('settleGuestHandoff(guest)') < handoff.indexOf('setSaved(true);'));
    const finish = handoff.slice(handoff.indexOf('const finish = async () => {'), handoff.indexOf('if (readError) return'));
    assert.match(finish, /if \(!mounted\.current \|\| owner !== scopeGeneration\(\)\) return;/);
    assert.ok(finish.indexOf('await clearGuestPractice();') < finish.indexOf('onDone(saved, !newlyCreated && !resumeAdoption);'));
    assert.match(handoff, /'Keep this practice'/);
    const welcome = evidence('apps/mobile/src/onboarding/AccountWelcome.tsx');
    assert.match(welcome, /if \(completed\.current\) return;/);
    assert.match(welcome, /animation\.start\(\(\{ finished \}\) => \{ if \(finished\) finish\(\); \}\)/);
    assert.match(welcome, /clearTimeout\(timer\)/);
    assert.match(welcome, /animation\?\.stop\(\)/);
    assert.match(welcome, /label="Go to home" onPress=\{finish\}/);
    assert.match(welcome, /<OnboardingLayout page="account-welcome" progress=\{\{ \.\.\.progress, fraction: 1, complete: true \}\}/);
    assert.match(handoff, /const journey = useRef\(draft\)/);
    assert.match(handoff, /<AccountWelcome progress=\{progress\}/);
    assert.match(welcome, /reader === false && AppState\.currentState === 'active'/);
    assert.match(welcome, /opacity\.setValue\(1\)/);
  });

  test('account changes during usage transfer or clearing cannot consume the next account draft', async () => {
    assert.deepEqual(await finishHandoff({ saved: false, changeAt: 'claim' }), ['busy', 'claim']);
    assert.deepEqual(await finishHandoff({ changeAt: 'clear' }), ['busy', 'clear']);
  });

  test('only a durable finish removes guest progress and stages the verified account welcome', async () => {
    assert.deepEqual(await finishHandoff(), ['busy', 'clear', 'welcome', 'guest-null', 'done-kept', 'idle']);
    assert.deepEqual(await finishHandoff({ newlyCreated: false, saved: false }), ['busy', 'claim', 'clear', 'guest-null', 'done-fresh', 'idle']);
    assert.deepEqual(await finishHandoff({ storageFails: true }), ['busy', 'clear', 'error', 'idle']);
  });

  test('repeated confirmation taps finish the durable handoff once', async () => {
    assert.deepEqual(await finishHandoff({ repeated: true, saved: false }), ['busy', 'claim', 'clear', 'welcome', 'guest-null', 'done-fresh', 'idle']);
  });

  test('an unmounted handoff never starts a welcome or updates the abandoned screen', async () => {
    assert.deepEqual(await finishHandoff({ saved: false, unmountAt: 'claim' }), ['busy', 'claim']);
    assert.deepEqual(await finishHandoff({ unmountAt: 'clear' }), ['busy', 'clear']);
  });
});
