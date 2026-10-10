import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evidence } from '../../../test/evidence.ts';
import { freshPreAccountDraft } from '../preAccountDraft.ts';
import { START_LEVELS, initialPracticeMode, practiceForecast } from '../plan.ts';

const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');

/** Execute the production handoff function with deferred storage and account changes. */
async function finishHandoff({ saved = true, newlyCreated = true, changeAt = '', storageFails = false, repeated = false, unmountAt = '' } = {}) {
  const handoff = evidence('apps/mobile/src/onboarding/GuestAccountHandoff.tsx');
  const source = handoff.slice(handoff.indexOf('const finish = async () => {'), handoff.indexOf('if (guest === null && !welcoming)'));
  assert.ok(source.startsWith('const finish'), 'this check must execute the production finish');
  let owner = 1;
  let uid = 'new-user';
  const calls: string[] = [];
  const mounted = { current: true };
  const changeAccount = () => { owner += 1; uid = 'other-user'; };
  const bindings = {
    user: { id: 'new-user' }, guest: { completed: true }, busy: false, saved, newlyCreated,
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
    const streak = screen.slice(screen.indexOf("{page === 'remind' ? <StreakCelebrationScreen"), screen.indexOf('<OnboardingLayout', screen.indexOf("{page === 'remind' ? <StreakCelebrationScreen")));
    assert.ok(streak.length > 0);
    assert.match(streak, /streak=\{streak\}/);
    assert.match(streak, /today=\{today\}/);
    assert.match(streak, /moment=\{moment\}/);
    assert.match(streak, /progress=\{progress\}/);
    assert.match(streak, /active=\{active && surface === null\}/);
    const callback = streak.match(/onContinue=\{([^}]+)\}/)?.[1];
    assert.ok(callback, 'read the actual learning continuation callback');
    for (const run of [null, { current: 1 }, { current: 7 }]) {
      const destinations: string[] = [];
      const next: () => void = new Function('go', 'streak', `return (${callback});`)((page: string) => destinations.push(page), run);
      assert.deepEqual(destinations, [], 'rendering the callback navigated on its own');
      next();
      assert.deepEqual(destinations, [run === null ? 'practice' : 'keep']);
    }
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
    const streak = screen.slice(screen.indexOf("{page === 'remind' ? <StreakCelebrationScreen"), screen.indexOf('<OnboardingLayout', screen.indexOf("{page === 'remind' ? <StreakCelebrationScreen")));
    const expression = streak.match(/onReminder=\{([^}]+)\}/)?.[1];
    assert.ok(expression, 'read the actual reminder callback and availability gate');
    for (const [available, enabled] of [[false, false], [true, true], [true, false]]) {
      const opened: string[] = [];
      const callback: (() => void) | undefined = new Function('REMINDERS_AVAILABLE', 'draft', 'open', `return (${expression});`)(available, { reminderEnabled: enabled }, (name: string) => opened.push(name));
      assert.deepEqual(opened, [], 'visiting the celebration opened the reminder');
      if (available && !enabled) {
        assert.ok(callback, 'a supported reminder has no opt-in action');
        callback();
        assert.deepEqual(opened, ['reminder']);
      } else assert.equal(callback, undefined);
    }
    const celebration = evidence('apps/mobile/src/onboarding/firstRun/StreakCelebrationScreen.tsx');
    assert.match(celebration, /Remind me tomorrow/);
    assert.doesNotMatch(celebration, /askReminderPermission\(|requestPermissionsAsync\(|turnOnReminder\(/);
    const sheet = screen.slice(screen.indexOf("{surface === 'reminder' && ("), screen.indexOf("{surface === 'exit' && ("));
    assert.match(sheet, /<ReminderAsk/);
    assert.match(sheet, /time=\{draft\.reminderTime \?\? DEFAULT_REMINDER_TIME\}/);
    assert.match(sheet, /answerReminder\(answer\)/);
  });

  test('saved achievements reveal truthful content and the primary action opens signup', () => {
    const saved = screen.slice(screen.indexOf("{page === 'keep' && ("), screen.indexOf("{page === 'home' && ("));
    assert.ok(saved.length > 0);
    assert.match(saved, /guestInvestment\(\{ practice: guest, days, today, draft \}\)/);
    assert.match(saved, /practiceForecast\(minutesOf\(activePlan\)\)/);
    assert.doesNotMatch(saved, /On this phone only|FIRST_RUN_COPY\.onThisPhone|Sign in|Not now|fluent|fluency/i);
    const list = evidence('apps/mobile/src/onboarding/firstRun/InvestmentList.tsx');
    assert.match(list, /rows\.map\(\(row, index\)/);
    assert.match(list, /<RevealItem key=\{row\.key\} index=\{index\}/);
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
    assert.match(handoff, /if \(!newlyCreated \|\| guest === undefined \|\| busy \|\| autoStarted\.current\) return;/);
    assert.match(handoff, /if \(newlyCreated && saved && !busy && guest !== null && guest !== undefined && !autoFinished\.current\) \{ autoFinished\.current = true; void finish\(\);/);
    assert.ok(handoff.indexOf('settleGuestHandoff(guest)') < handoff.indexOf('setSaved(true);'));
    const finish = handoff.slice(handoff.indexOf('const finish = async () => {'), handoff.indexOf('if (guest === null && !welcoming)'));
    assert.match(finish, /if \(!mounted\.current \|\| owner !== scopeGeneration\(\)\) return;/);
    assert.ok(finish.indexOf('await clearGuestPractice();') < finish.indexOf('onDone(saved);'));
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
