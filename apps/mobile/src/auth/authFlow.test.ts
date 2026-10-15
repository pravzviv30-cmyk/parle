import { evidence } from '../../test/evidence.ts';
/**
 * The under-13 refusal before an account holds for the launch (F637, F639, F641).
 *
 * Founder decision, 2026-09-30: firmer, and clear on refusal. Once a learner
 * says they are younger than 13, the refusal holds for the rest of the launch,
 * across the "I have an account" detour and across a sign-in and sign-out, and
 * the saved first-run draft is cleared with any first name typed. Nothing about
 * the refusal is written to the device, so a relaunch may ask again, like the
 * age gate.
 *
 * apps/mobile has no renderer (docs/TESTING.md), so the wiring is a read of the
 * three files that carry it: `App.tsx`'s `Gate` holds the refusal, because it
 * stays mounted for the launch while `AuthFlow` is unmounted by every sign-in;
 * `AuthFlow.tsx` hands it to the first run and guards the door to sign-up; and
 * the first-run screen reads its draft only when it mounts. The one value here
 * is the page the first run reopens on, which is plain data.
 *
 * The screen's own half (the refusal handler, `keep` writing nothing once
 * refused) is pinned in `onboarding/firstRun.test.ts`.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { describe, test } from 'node:test';

import { PRE_ACCOUNT_PAGES, freshPreAccountDraft } from '../onboarding/preAccountDraft.ts';

const AUTH_DIR = import.meta.dirname;

/** A file as written, comments and all, for the tests that read words rather than code. */
const raw = (...parts: string[]) => readFileSync(path.resolve(AUTH_DIR, ...parts), 'utf8');
/** Source with comments blanked, so a sentence about a call is not the call. */
const strip = (source: string) => {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
};
const read = (...parts: string[]) => strip(raw(...parts));
/** Text with comment markers and line breaks folded, so a wrapped sentence reads whole. */
const prose = (text: string) => text.replace(/\n\s*(?:\/\/|\*)[ \t]?/g, ' ').replace(/\s+/g, ' ');

const FLOW = read('AuthFlow.tsx');
const APP = read('..', '..', 'App.tsx');
const SCREEN = read('..', 'onboarding', 'PreAccountOnboarding.tsx');

/** One JSX element's source, from its opening tag to the `/>` that closes it. */
function element(source: string, tag: string): string {
  const at = source.search(new RegExp(`<${tag}(?=\\s|>)`));
  assert.ok(at >= 0, `<${tag}> is not rendered`);
  return source.slice(at, source.indexOf('/>', at) + 2);
}

/** The body of an arrow prop such as `onCreateAccount={(draft) => { ... }}`. */
function handler(source: string, prop: string): string {
  const at = source.indexOf(`${prop}={`);
  assert.ok(at >= 0, `${prop} is not passed`);
  return source.slice(at, source.indexOf('}}', at) + 2);
}

/** A `useCallback` in App.tsx, from its name to the dependency list that closes it. */
function callback(name: string): string {
  const at = APP.indexOf(`const ${name} = useCallback(`);
  assert.ok(at > 0, `App.tsx has no ${name}`);
  return APP.slice(at, APP.indexOf('}, [', at));
}

/** Every `if (...)` condition in a stretch of source, one level of calls deep. */
const conditions = (source: string) =>
  [...source.matchAll(/\bif \(((?:[^()]|\([^()]*\))*)\)/g)].map((m) => m[1]!);

/** Gate, the one component that decides between the signed-in app and this flow. */
const GATE = APP.slice(APP.indexOf('function Gate()'), APP.indexOf('export default function App()'));

/** The sentence the founder's answer comes down to, in every place that explains it. */
const SIGN_IN_AND_OUT = /Signing in and out again does not end it; only closing the app does\./;
/** The narrower answer the founder did not give, in either of the words it was written in. */
const SIGN_IN_ENDS = /Signing in ends[^.]*refusal|refusal[^.]*until someone signs in/i;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

/** Execute the production restart action while its two real owners are pending. */
function accountRestartHarness(action: 'newAccount' | 'restartPlan' = 'newAccount') {
  const source = FLOW.slice(FLOW.indexOf(`  const ${action} =`), FLOW.indexOf(action === 'newAccount' ? '  const acceptAccountTerms =' : '  const newAccount ='));
  let practice = deferred<void>();
  let reminder = deferred<'done' | 'failed' | 'unavailable'>();
  const calls: string[] = [];
  const mounted = { current: true }, restarting = { current: false }, pageMotion = { locked: { current: false } };
  const bindings = { mounted, restarting, pageMotion, refused: false, initialDraft: { reminderEnabled: true },
    freshPreAccountDraft, refusalPage: () => ({ ...freshPreAccountDraft(), page: 'save' }),
    clearGuestPractice: () => { calls.push('clear-practice'); return practice.promise; },
    cancelReminder: () => { calls.push('cancel-reminder'); return reminder.promise; },
    setRestartBusy: (value: boolean) => calls.push(`busy:${value}`),
    setRestartError: (value: boolean) => calls.push(`error:${value}`),
    setAccountRestart: (value: boolean) => calls.push(`account-restart:${value}`),
    setNewDraft: () => calls.push('replace-draft'), onDiscardDraft: () => calls.push('discard-draft'),
    onDraftChange: () => calls.push('publish-draft'),
    setRevision: () => calls.push('revision'), setSignupDraft: () => calls.push('clear-signup'),
    setIntroducing: () => calls.push('introducing'), setAccountFirst: () => calls.push('account-first'),
    switchScreen: (page: string, onSwitched?: () => void) => { calls.push(`screen:${page}`); onSwitched?.(); },
  };
  const run = new Function(...Object.keys(bindings), stripTypeScriptTypes(source) + `\nreturn ${action};`)(...Object.values(bindings)) as () => Promise<void>;
  return { run, calls, mounted, pageMotion, get practice() { return practice; }, get reminder() { return reminder; },
    retryCleanup: () => { practice = deferred<void>(); reminder = deferred<'done' | 'failed' | 'unavailable'>(); } };
}

test('account creation waits for previous practice and reminder cleanup before discarding the plan', async () => {
  const flow = accountRestartHarness();
  const pending = flow.run();
  assert.ok(!flow.calls.includes('discard-draft'), 'the saved plan must survive while practice cleanup is pending');
  assert.ok(!flow.calls.includes('screen:signup'));
  assert.ok(!flow.calls.includes('cancel-reminder'), 'cleanup owners run in their existing order');
  flow.practice.resolve();
  await Promise.resolve();
  assert.ok(flow.calls.includes('cancel-reminder'));
  assert.ok(!flow.calls.includes('discard-draft'), 'the plan must remain until its reminder has gone');
  flow.reminder.resolve('done');
  await pending;
  assert.ok(flow.calls.indexOf('discard-draft') > flow.calls.indexOf('cancel-reminder'));
  assert.ok(flow.calls.includes('screen:signup'));
});

test('account cleanup failure retains the plan and exposes retry for rejection or native failed cancellation', async () => {
  for (const failure of ['practice', 'reminder-rejected', 'reminder-failed'] as const) {
    const flow = accountRestartHarness();
    const pending = flow.run();
    if (failure === 'practice') flow.practice.reject(new Error('device storage failed'));
    else {
      flow.practice.resolve();
      await Promise.resolve();
      if (failure === 'reminder-rejected') flow.reminder.reject(new Error('notification cancellation failed'));
      else flow.reminder.resolve('failed');
    }
    await pending;
    assert.ok(flow.calls.includes('error:true'), `${failure} must expose recovery`);
    assert.ok(!flow.calls.includes('discard-draft'));
    assert.ok(!flow.calls.includes('replace-draft'));
    assert.ok(!flow.calls.includes('screen:signup'));
  }
});

test('account cleanup blocks repeat taps and can retry without duplicating the discard', async () => {
  const flow = accountRestartHarness();
  const first = flow.run();
  await flow.run();
  assert.equal(flow.calls.filter(call => call === 'clear-practice').length, 1);
  flow.practice.resolve();
  await Promise.resolve();
  await flow.run();
  assert.equal(flow.calls.filter(call => call === 'clear-practice').length, 1);
  flow.reminder.resolve('failed');
  await first;
  flow.retryCleanup();
  const retry = flow.run();
  flow.practice.resolve();
  await Promise.resolve();
  flow.reminder.resolve('done');
  await retry;
  assert.equal(flow.calls.filter(call => call === 'discard-draft').length, 1);
  assert.equal(flow.calls.filter(call => call === 'screen:signup').length, 1);
  assert.equal(flow.calls.at(-2), 'account-restart:false', 'successful navigation closes recovery at its transition commit');
  assert.match(FLOW, /accountRestart\) return <Animated.View/);
  assert.match(FLOW, /footer=\{restartError && !restartBusy/);
  assert.match(FLOW, /label="Try again" onPress=\{\(\) => void newAccount\(\)\}/);
  assert.match(FLOW, /label="Back to sign in"[^\n]*pageMotion\.transition\(\(\) => \{ if \(mounted\.current\)/, 'recovery returns through the same interruptible page transition');
});

test('account cleanup cannot mutate or navigate an unmounted flow and respects the page transition lock', async () => {
  for (const leaveDuring of ['practice', 'reminder'] as const) {
    const flow = accountRestartHarness();
    const pending = flow.run();
    if (leaveDuring === 'reminder') { flow.practice.resolve(); await Promise.resolve(); }
    flow.mounted.current = false;
    const before = [...flow.calls];
    if (leaveDuring === 'practice') flow.practice.resolve();
    else flow.reminder.resolve('done');
    await pending;
    assert.deepEqual(flow.calls, before, 'unmount must invalidate queued cleanup continuations');
    assert.ok(!flow.calls.includes('discard-draft'));
  }
  const flow = accountRestartHarness();
  flow.pageMotion.locked.current = true;
  await flow.run();
  assert.deepEqual(flow.calls, []);
  assert.match(FLOW, /useEffect\(\(\) => \{ mounted\.current = true; return \(\) => \{ mounted\.current = false; \}; \}, \[\]\)/);
});

test('account cleanup accepts the unavailable web reminder outcome without claiming a scheduled reminder', async () => {
  const flow = accountRestartHarness();
  const pending = flow.run();
  flow.practice.resolve();
  await Promise.resolve();
  flow.reminder.resolve('unavailable');
  await pending;
  assert.ok(flow.calls.includes('discard-draft'));
  assert.ok(flow.calls.includes('screen:signup'));
  assert.ok(!flow.calls.includes('error:true'));
});

test('resume restart keeps its plan when reminder cancellation reports failure', async () => {
  const flow = accountRestartHarness('restartPlan');
  const pending = flow.run();
  flow.practice.resolve();
  await Promise.resolve();
  flow.reminder.resolve('failed');
  await pending;
  assert.ok(flow.calls.includes('error:true'));
  assert.ok(!flow.calls.includes('discard-draft'));
  assert.ok(!flow.calls.includes('publish-draft'));
  assert.ok(!flow.calls.includes('screen:welcome'));
});

test('resume restart waits for cleanup, handles rejection and cannot finish after unmount', async () => {
  for (const result of ['done', 'practice-rejected', 'reminder-rejected', 'unmount'] as const) {
    const flow = accountRestartHarness('restartPlan');
    const pending = flow.run();
    await flow.run();
    assert.equal(flow.calls.filter(call => call === 'clear-practice').length, 1);
    assert.ok(!flow.calls.includes('discard-draft'));
    if (result === 'practice-rejected') flow.practice.reject(new Error('storage failed'));
    else {
      flow.practice.resolve();
      await Promise.resolve();
      assert.ok(!flow.calls.includes('discard-draft'));
      if (result === 'reminder-rejected') flow.reminder.reject(new Error('cancellation failed'));
      else {
        if (result === 'unmount') flow.mounted.current = false;
        flow.reminder.resolve('done');
      }
    }
    await pending;
    assert.equal(flow.calls.includes('discard-draft'), result === 'done');
    assert.equal(flow.calls.includes('screen:welcome'), result === 'done');
    if (result.endsWith('rejected')) assert.ok(flow.calls.includes('error:true'));
  }
});

test('signup values survive auth-route detours without entering the saved onboarding draft', () => {
  const formDraft = read('signUpFormDraft.ts');
  assert.match(FLOW, /useState<SignUpFormDraft>\(emptySignUpFormDraft\)/);
  const signup = element(FLOW, 'SignUpScreen');
  assert.match(signup, /formDraft=\{signUpFormDraft\}/);
  assert.match(signup, /onFormDraftChange=\{setSignUpFormDraft\}/);
  assert.match(handler(element(FLOW, 'PreAccountOnboarding'), 'onCreateAccount'), /if \(refused\) return;[\s\S]*onCreateAccount\(accountDraft\);[\s\S]*switchScreen\('signup'\)/);
  assert.match(APP, /onCreateAccount=\{keepPreAccountDraft\}/);
  // Only the form updates this state; changing the route or resetting the
  // introduction must not erase what was already entered in the form.
  assert.doesNotMatch(FLOW, /setSignUpFormDraft\(/);
  assert.doesNotMatch(FLOW, /onDraftChange\(signUpFormDraft\)|onCreateAccount\(signUpFormDraft\)/);
  assert.doesNotMatch(formDraft, /Storage|setItem|JSON\.stringify|console\.|fetch\(/);
  assert.doesNotMatch(read('..', 'onboarding', 'preAccountDraft.ts'), /SignUpFormDraft|\bpassword\b|\bconfirm\b/);
  const form = read('SignUpScreen.tsx');
  assert.match(form, /useState\(planDraft\?\.accountEmail \?\? formDraft\?\.email \?\? ''\)/);
  assert.match(form, /useState\(formDraft\?\.password \?\? ''\)/);
  assert.match(form, /useState\(formDraft\?\.confirm \?\? ''\)/);
  assert.match(form, /onFormDraftChange\?\.\(\{ email, password, confirm \}\)/);
  assert.match(form, /setEmail\(value\); onEmailChange\?\.\(value\)/);
  assert.doesNotMatch(form, /useEffect\([^;]*onEmailChange/);
});

test('reopening account creation keeps an intentionally cleared email and the completed plan', () => {
  const opening = handler(element(FLOW, 'PreAccountOnboarding'), 'onCreateAccount');
  const expression = opening.slice('onCreateAccount={'.length, -1);
  const writes: unknown[] = []; const created: unknown[] = []; const screens: string[] = [];
  const bindings = { refused: false, signupDraft: { accountEmail: '' },
    setSignupDraft: (draft: unknown) => writes.push(draft), onDraftChange: () => {},
    onCreateAccount: (draft: unknown) => created.push(draft), switchScreen: (next: string) => screens.push(next) };
  const make = new Function(...Object.keys(bindings), stripTypeScriptTypes('const create = ' + expression + ';') + '\nreturn create;');
  const create = make(...Object.values(bindings)) as (draft: unknown) => void;
  const draft = { ...freshPreAccountDraft(), eligibilityConfirmed: true, tutorVoice: 'emilie', tutorChosen: true, reason: 'trip', accountEmail: 'old@example.com', page: 'keep' };
  create(draft);
  const expected = { ...draft, accountEmail: '', page: 'account', accountMode: 'signup', accountReturnPage: 'keep' };
  assert.deepEqual(writes, [expected]);
  assert.deepEqual(created, [expected]);
  assert.deepEqual(screens, ['signup']);
});

test('signing in from the edited onboarding plan keeps current answers and the separately entered account email', () => {
  const start = FLOW.indexOf('  const signIn = ');
  const end = FLOW.indexOf('  const returnToIntroduction = ', start);
  const cached = { ...freshPreAccountDraft(), eligibilityConfirmed: true, tutorVoice: 'julien', tutorChosen: true, minutes: 5, accountEmail: 'camille@example.invalid', page: 'account', accountReturnPage: 'choose-tutor' };
  const current = { ...freshPreAccountDraft(), eligibilityConfirmed: true, tutorVoice: 'emilie', tutorChosen: true, minutes: 20, page: 'choose-tutor', accountEmail: 'old@example.invalid' };
  for (const accountEmail of ['camille@example.invalid', '']) {
    const writes: unknown[] = [], saved: unknown[] = [], screens: string[] = [];
    const bindings = { pageMotion: { locked: { current: false } }, refused: false, accountFirst: false,
      signupDraft: { ...cached, accountEmail }, newDraft: null, initialDraft: cached,
      setSignupDraft: (value: unknown) => writes.push(value), onDraftChange: (value: unknown) => saved.push(value),
      onSignIn: () => {}, switchScreen: (value: string) => screens.push(value) };
    const signIn = new Function(...Object.keys(bindings), stripTypeScriptTypes(FLOW.slice(start, end)) + '\nreturn signIn;')(...Object.values(bindings));
    signIn(current);
    const expected = { ...current, accountEmail, page: 'account', accountMode: 'signin', accountReturnPage: 'choose-tutor' };
    assert.deepEqual(writes, [expected], 'a cached signup plan must not overwrite the edited tutor or daily goal');
    assert.deepEqual(saved, [expected]); assert.deepEqual(screens, ['signin']);
  }
});

test('the ordinary signup sign-in detour retains its form plan when no current onboarding draft is supplied', () => {
  const start = FLOW.indexOf('  const signIn = '), end = FLOW.indexOf('  const returnToIntroduction = ', start);
  const cached = { ...freshPreAccountDraft(), eligibilityConfirmed: true, tutorVoice: 'emilie', tutorChosen: true, minutes: 20, accountEmail: 'camille@example.invalid', page: 'account', accountReturnPage: 'choose-tutor' };
  const writes: unknown[] = [];
  const bindings = { pageMotion: { locked: { current: false } }, refused: false, accountFirst: false,
    signupDraft: cached, newDraft: null, initialDraft: null, setSignupDraft: (value: unknown) => writes.push(value),
    onDraftChange: () => {}, onSignIn: () => {}, switchScreen: () => {} };
  const signIn = new Function(...Object.keys(bindings), stripTypeScriptTypes(FLOW.slice(start, end)) + '\nreturn signIn;')(...Object.values(bindings));
  signIn();
  assert.deepEqual(writes, [{ ...cached, accountMode: 'signin' }]);
});

test('sign-in controls pass a current plan or no argument and never forward a press event as a plan', () => {
  const presses = [...SCREEN.matchAll(/onPress=\{(\(\) => onSignIn\(draftRef\.current\))\}/g)];
  assert.equal(presses.length, 3, 'every onboarding sign-in/sign-out action must explicitly choose the current draft');
  const draft = { ...freshPreAccountDraft(), minutes: 20, tutorVoice: 'emilie' };
  for (const press of presses) {
    const calls: unknown[] = [];
    const tap = new Function('onSignIn', 'draftRef', `return (${press[1]});`)((value: unknown) => calls.push(value), { current: draft });
    tap({ nativeEvent: { timestamp: 1 } });
    assert.deepEqual(calls, [draft], 'the native/browser PressEvent is not an onboarding draft');
  }
  const signup = element(FLOW, 'SignUpScreen');
  const wrapper = signup.match(/onSignIn=\{(\(\) => signIn\(\))\}/)?.[1];
  assert.ok(wrapper, 'the ordinary form detour must call signIn without a press event');
  const calls: unknown[][] = [];
  const tap = new Function('signIn', `return (${wrapper});`)((...args: unknown[]) => calls.push(args));
  tap({ nativeEvent: { timestamp: 1 } });
  assert.deepEqual(calls, [[]]);
});

describe('the under-13 refusal before an account holds for the launch (F637, F639, F641)', () => {
  test('the flow passes the refusal up to Gate, which holds it and clears the saved draft', () => {
    // Required, not optional: a Gate that forgot to wire either would not
    // compile, rather than quietly keeping a refused child's first name on the
    // device, or offering the pill again to the next flow it mounts.
    assert.match(FLOW, /\n\s*refused: boolean;/, 'the flow takes the refusal as optional, so a caller can leave it out');
    assert.match(FLOW, /\n\s*onRefuse: \(\) => void;/, 'the discard on refusal is optional, so a caller can leave the draft on the device');

    const screen = element(FLOW, 'PreAccountOnboarding');
    assert.match(screen, /\brefused=\{refused\}/, 'the flow does not hand the refusal back to the screen');
    assert.match(screen, /\bonRefuse=\{onRefuse\}/, 'the flow does not pass the refusal up');

    const flowInGate = element(GATE, 'AuthFlow');
    assert.match(flowInGate, /\brefused=\{preAccountRefused\}/, 'Gate does not hand the refusal to the flow');
    assert.match(flowInGate, /\bonRefuse=\{refusePreAccount\}/, 'Gate does not hear the refusal');

    const refuse = callback('refusePreAccount');
    assert.match(refuse, /setPreAccountRefused\(true\);/, 'Gate hears the refusal but does not hold it');
    assert.match(refuse, /\bdiscardPreAccountDraft\(\);/, 'Gate holds the refusal but never clears the saved draft');
    const discard = APP.slice(APP.indexOf('const discardPreAccountDraft'), APP.indexOf('}, []);', APP.indexOf('const discardPreAccountDraft')));
    assert.match(discard, /setPreAccountDraft\(null\);/, 'the discard keeps the draft in memory');
    assert.match(discard, /void clearPreAccountDraft\(\);/, 'the discard leaves the draft on the device');
  });

  test("under-thirteen refusal is owned by the launch and passed to signed-out and signed-in onboarding", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx'); const app = evidence('apps/mobile/App.tsx'); assert.match(app, /setPreAccountRefused\(true\)/); assert.match(app, /discardPreAccountDraft\(\)/); assert.match(screen, /clearGuestPractice\(\)/); assert.match(screen, /generation\.current\+\+/); assert.match(flow, /refused=\{refused\}/); assert.doesNotMatch(flow, /setRefused|refusal.*setItem|refusal.*fetch/i); });

  test("a refused flow renders refusal rather than a new eligible draft", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx'); const app = evidence('apps/mobile/App.tsx'); assert.match(flow, /initialDraft=\{refused \? refusalPage\(\)/); assert.match(screen, /const title = refused \?/); assert.match(screen, /footer = refused/); assert.match(screen, /if \(operation\.current \|\| refused\) return/); });

  test("Create one can reset an introduction but cannot bypass a launch refusal", () => { const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx'); const app = evidence('apps/mobile/App.tsx'); assert.match(flow, /const draft = refused \? refusalPage\(\) : freshPreAccountDraft\(\)/); assert.match(flow, /if \(!refused\) onDiscardDraft\(\)/); assert.match(flow, /if \(refused\) return/); assert.match(flow, /onCreateAccount=\{newAccount\}/); });

  test("ordinary draft changes do not remount onboarding; explicit account or plan restarts advance its revision", () => { const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx'); const app = evidence('apps/mobile/App.tsx'); assert.match(flow, /key=\{revision\}/); assert.equal((flow.match(/setRevision\(/g) ?? []).length, 2); const newAccount = flow.slice(flow.indexOf('const newAccount ='), flow.indexOf('const signIn =')); assert.match(newAccount, /setRevision/); const restart = flow.slice(flow.indexOf('const restartPlan ='), flow.indexOf('const newAccount =')); assert.match(restart, /await clearGuestPractice\(\)/); assert.match(restart, /setRevision/); assert.doesNotMatch(app, /<AuthFlow key=/); assert.match(app, /refused=\{preAccountRefused\}/); });

  test('switching from onboarding sign-in to sign-up preserves the completed plan and email', () => {
    const start = FLOW.indexOf('  const createFromIntroduction = ');
    const end = FLOW.indexOf('  if (accountRestart)', start);
    assert.ok(start > 0 && end > start);
    const saved = { ...freshPreAccountDraft(), eligibilityConfirmed: true, tutorChosen: true, tutorVoice: 'emilie', reason: 'trip', firstName: 'Camille', accountEmail: 'camille@example.com', accountMode: 'signin', accountReturnPage: 'keep', page: 'account' };
    const writes: unknown[] = []; const screens: string[] = []; let resets = 0;
    const bindings = { pageMotion: { locked: { current: false } }, refused: false, accountFirst: false, signupDraft: saved, newDraft: null, initialDraft: null,
      newAccount: () => { resets++; }, setSignupDraft: (value: unknown) => writes.push(value), onDraftChange: () => {}, onCreateAccount: () => {}, switchScreen: (next: string) => screens.push(next) };
    new Function(...Object.keys(bindings), stripTypeScriptTypes(FLOW.slice(start, end)) + '\ncreateFromIntroduction();')(...Object.values(bindings));
    assert.equal(resets, 0);
    assert.deepEqual(writes, [{ ...saved, accountMode: 'signup' }]);
    assert.deepEqual(screens, ['signup']);
    assert.match(FLOW, /onCreateAccount=\{createFromIntroduction\}/);
  });

  test("onboarding and privacy document refusal across authentication without storing a child marker", () => { for (const path of ['docs/ONBOARDING.md','docs/PRIVACY_AND_SAFETY.md']) { const doc = evidence(path); assert.match(doc, /sign-in(?: and|,) sign-out/); assert.match(doc, /remainder of the launch|rest of the launch|that launch's refusal/); assert.match(doc, /no (?:typed answers or )?refusal marker/); } });
});


describe('account-first route from Welcome back', () => {
  test('a resumed account-first signup restores its route and starts progress before unanswered setup', () => {
    const expression = /const \[accountFirst, setAccountFirst\] = useState\(([^\n]+)\);/.exec(FLOW)?.[1];
    assert.ok(expression, 'the account route must initialize from its durable return marker');
    const restored = new Function('initialDraft', 'refused', `return (${expression});`) as (draft: unknown, refused: boolean) => boolean;
    const fresh = freshPreAccountDraft();
    const accountFirst = { ...fresh, page: 'account', accountReturnPage: 'hear-it', eligibilityConfirmed: true };
    assert.equal(restored(accountFirst, false), true);
    assert.equal(restored(accountFirst, true), false, 'a known refusal cannot become an account-first signup');
    assert.equal(restored({ ...accountFirst, accountReturnPage: 'keep' }, false), false, 'completed practice must retain its real account stage');
    assert.equal(restored(null, false), false);
    assert.match(FLOW, /initialProgress=\{onboardingProgress\(\{ page: accountFirst \? 'hear-it' : initialDraft\?\.page/);
    assert.match(read('SignUpScreen.tsx'), /page: accountFirst \? 'hear-it' : 'account'/);
  });
  test('a deliberate signup declaration keeps unanswered accounts in the real full setup', () => {
    const start = FLOW.indexOf('  const acceptAccountTerms =');
    const end = FLOW.indexOf('  const updateAccountEmail =', start);
    const source = stripTypeScriptTypes(FLOW.slice(start, end));
    for (const refused of [false, true]) {
      const writes: unknown[] = [];
      const fresh = freshPreAccountDraft();
      const bindings = { refused, signupDraft: null, newDraft: fresh, initialDraft: null, freshPreAccountDraft, accountFirst: true,
        setSignupDraft: () => {}, setNewDraft: () => {}, onDraftChange: (value: unknown) => writes.push(value) };
      const accept = new Function(...Object.keys(bindings), source + '\nreturn acceptAccountTerms;')(...Object.values(bindings)) as (email: string) => boolean;
      assert.equal(accept('camille@example.com'), !refused);
      assert.equal(writes.length, refused ? 0 : 1);
      if (!refused) assert.deepEqual(writes[0], { ...fresh, eligibilityConfirmed: true, accountEmail: 'camille@example.com', page: 'account', accountMode: 'signup', accountReturnPage: 'hear-it' });
    }
    assert.match(APP, /preAccountDraft\.accountReturnPage !== 'hear-it' && mayAdoptPreAccountDraft/);
    assert.match(APP, /initialDraft=\{preAccountDraft\?\.accountReturnPage === 'hear-it' \? \{ \.\.\.preAccountDraft, page: 'hear-it' \} : null\}/);
    assert.match(FLOW, /onTermsAccepted=\{acceptAccountTerms\}/);
    const signup = read('SignUpScreen.tsx');
    assert.equal((signup.match(/onTermsAccepted\?\.\(email\.trim\(\)\)/g) ?? []).length, 3, 'email, Google and Apple must each record the declaration on their actual tap');
    assert.doesNotMatch(signup, /useEffect\([^;]*onTermsAccepted/);
  });
  function invoke(name: string, next: string, bindings: Record<string, unknown>) {
    const body = FLOW.slice(FLOW.indexOf(`  const ${name} =`), FLOW.indexOf(`  const ${next} =`));
    return new Function(...Object.keys(bindings), stripTypeScriptTypes(body) + `\nreturn ${name}();`)(...Object.values(bindings));
  }
  test('opens signup directly, clears the old handoff and does not create a replacement plan', async () => {
    for (const refused of [false, true]) {
      const screens: string[] = []; let discarded = 0; let accountFirst = false;
      await invoke('newAccount', 'acceptAccountTerms', {
        pageMotion: { locked: { current: false } }, refused, initialDraft: null,
        restarting: { current: false }, mounted: { current: true }, setRestartBusy: () => {}, setRestartError: () => {}, setAccountRestart: () => {},
        refusalPage: () => ({ ...freshPreAccountDraft(), page: 'save' }), freshPreAccountDraft,
        clearGuestPractice: () => {}, cancelReminder: () => {}, setNewDraft: () => {},
        onDiscardDraft: () => { discarded++; }, setRevision: () => {}, setSignupDraft: () => {},
        setIntroducing: () => {}, setAccountFirst: (value: boolean) => { accountFirst = value; },
        switchScreen: (value: string) => screens.push(value),
      });
      assert.deepEqual(screens, [refused ? 'welcome' : 'signup']);
      assert.equal(discarded, refused ? 0 : 1);
      assert.equal(accountFirst, !refused);
    }
    assert.match(element(APP.slice(APP.indexOf('function Gate(')), 'AuthFlow'), /onDiscardDraft=\{discardPreAccountDraft\}/);
    assert.match(APP, /existing === null \? \(\s*<PreAccountOnboarding[\s\S]*?signedIn/);
  });
  test('back returns to sign-in and switching again keeps the form draft', () => {
    const screens: string[] = [];
    invoke('returnToIntroduction', 'createFromIntroduction', { accountFirst: true, switchScreen: (value: string) => screens.push(value) });
    assert.deepEqual(screens, ['signin']);
    const start = FLOW.indexOf('  const createFromIntroduction =');
    const end = FLOW.indexOf('  if (accountRestart)', start);
    new Function('accountFirst', 'pageMotion', 'refused', 'switchScreen', stripTypeScriptTypes(FLOW.slice(start, end)) + '\ncreateFromIntroduction();')(true, { locked: { current: false } }, false, (value: string) => screens.push(value));
    assert.deepEqual(screens, ['signin', 'signup']);
    assert.match(FLOW, /formDraft=\{signUpFormDraft\}/);
    assert.match(FLOW, /if \(refused \|\| accountFirst\) return/);
  });
  test('editing hides navigation and hidden introduction cannot receive touches', () => {
    assert.match(read('SignInScreen.tsx'), /<Frame\s+dismissKeyboardOnBackground/);
    assert.match(read('..', 'layout.tsx'), /return dismissKeyboardOnBackground && Platform\.OS !== 'web' \? \(\s*<TouchableWithoutFeedback accessible=\{false\} onPress=\{Keyboard.dismiss\}>/);
    assert.match(read('..', 'layout.tsx'), /dismissKeyboardOnBackground = false/);
    assert.match(read('SignInScreen.tsx'), /!keyboardVisible && <Press[\s\S]*?onCreateAccount/);
    assert.match(FLOW, /pointerEvents=\{screen === 'welcome' \? 'auto' : 'none'\}/);
    assert.match(FLOW, /!accountFirst && <PreAccountOnboarding/);
    assert.match(read('SignUpScreen.tsx'), /page: accountFirst \? 'hear-it' : 'account'/);
  });
});
