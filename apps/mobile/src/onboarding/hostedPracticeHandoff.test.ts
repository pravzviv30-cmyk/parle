import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { freshPreAccountDraft } from './preAccountDraft.ts';
import { shouldStartFirstPractice } from './firstPracticeEntry.ts';
import { briefFromDraft } from './firstLiveModel.ts';
import type { GuestPractice } from './guestModel.ts';

const screen = readFileSync(new URL('./PreAccountOnboarding.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const startSource = screen.slice(screen.indexOf('  const start = async () => {'), screen.indexOf('  const saveAccount = async () => {'));

function launch(signedIn: boolean, failure: string | null = 'guest-live-unavailable') {
  const draft = { ...freshPreAccountDraft(), page: 'choose-tutor' as const, reason: 'trip' as const, tutorVoice: 'emilie' as const, tutorChosen: true, minutes: 10 as const };
  const account: unknown[] = [], issues: string[] = [], accountRequired: boolean[] = [];
  let guestCalls = 0;
  const world = {
    operation: { current: false }, refused: false, previewOnly: false, pageMotion: { locked: { current: false } },
    patch: (value: object) => ({ ...draft, ...value }), signedIn,
    continueWithAccount: async (value: unknown) => { account.push(value); },
    setBusy: () => {}, setNeedsAccount: (value: boolean) => accountRequired.push(value), generation: { current: 0 },
    guest: null, briefFromDraft: () => ({}), startGuestPractice: async () => { guestCalls++; if (failure) throw new Error(failure); return {}; },
    current: { current: true }, refusedRef: { current: false }, persist: async () => true, metric: () => {}, showPage: () => {},
    setIssue: (value: string) => issues.push(value),
  };
  const run = new Function(...Object.keys(world), `${stripTypeScriptTypes(startSource)}\nreturn start;`)(...Object.values(world));
  return { draft, account, issues, accountRequired, guestCalls: () => guestCalls, run };
}

test('a signed-in learner finishes the existing profile setup instead of starting another guest capability', async () => {
  const h = launch(true); await h.run();
  assert.equal(h.guestCalls(), 0, 'the hosted guest route remains closed after authentication too');
  assert.deepEqual(h.account, [{ ...h.draft, eligibilityConfirmed: true }]);
});

test('only an explicit guest capability refusal offers the preserved account route', async () => {
  const h = launch(false); await h.run();
  assert.equal(h.accountRequired.at(-1), true, 'the disclosure must offer a working next action');
  assert.match(h.issues.at(-1) ?? '', /account/i);
  assert.deepEqual(h.account, [], 'a service response cannot create an account without a deliberate action');
  const unavailable = launch(false, 'unavailable'); await unavailable.run();
  assert.ok(!unavailable.accountRequired.includes(true), 'network failures retain connection retry');
  assert.match(unavailable.issues.at(-1) ?? '', /connect/i);
});
test('a speech outage keeps the saved plan and retry without claiming account creation adds voice', async () => {
  const h = launch(false, 'voice-unavailable'); await h.run();
  assert.ok(!h.accountRequired.includes(true));
  assert.deepEqual(h.account, []);
  assert.match(h.issues.at(-1) ?? '', /speaking.*unavailable/i);
  assert.doesNotMatch(h.issues.at(-1) ?? '', /create an account/i);
});

test('accepted Terms do not suppress the pending first practice after account setup', () => {
  const begin = app.indexOf('<PreAccountProfileBootstrap');
  const callback = app.slice(begin, app.indexOf('\n          />', begin)).match(/done=\{\(([^)]*)\) => \{([\s\S]*?)\n            \}\}/);
  assert.ok(callback, 'the profile owner must retain the existing bootstrap handoff');
  let first: unknown;
  const world = { firstScene: { current: '' }, firstSceneFor: () => 'mission:cafe', preAccountDraft: { eligibilityConfirmed: true },
    setJustOnboarded: (value: unknown) => { first = value; }, done: () => {} };
  const run = new Function(...Object.keys(world), `return (${callback[1]}) => {${callback[2]}}`)(...Object.values(world));
  run({}, true);
  assert.equal(first, true, 'a real completed practice, rather than Terms acceptance, decides whether the first scene remains');
});

function accountContinuation(signedIn = false, blocked?: 'preview' | 'refusal' | 'terms') {
  const begin = screen.indexOf('  const continueWithAccount = async (');
  const end = screen.indexOf('  const start = async () => {', begin);
  assert.ok(begin > 0 && end > begin, 'execute the disclosure’s actual account action');
  const basis = { ...freshPreAccountDraft(), eligibilityConfirmed: true, page: 'choose-tutor' as const,
    reason: 'trip' as const, interests: ['travel', 'music'] as const, startLevel: 'few' as const,
    speakingConfidence: 'trying' as const, practiceFocus: 'listening' as const, minutes: 10 as const,
    tutorVoice: 'emilie' as const, tutorChosen: true, rememberLearning: true };
  const calls: unknown[] = [], issues: string[] = [], busy: boolean[] = [];
  let resolve!: (value: boolean | undefined) => void, reject!: (error: Error) => void, owner = 1;
  const pending = () => new Promise<boolean | undefined>((done, fail) => { resolve = done; reject = fail; });
  let result = pending();
  if (blocked === 'terms') basis.eligibilityConfirmed = false;
  const world = { draftRef: { current: basis }, operation: { current: false }, pageMotion: { locked: { current: false } },
    refused: blocked === 'refusal', previewOnly: blocked === 'preview', current: { current: true }, generation: { current: 1 }, scopeGeneration: () => owner,
    signedIn, setBusy: (value: boolean) => busy.push(value), stopSound: () => {},
    onCreateAccount: (draft: unknown) => { calls.push(draft); return result; },
    clearSetupDraft: async () => { calls.push('clear-account-setup'); return true; }, setIssue: (value: string) => issues.push(value),
  };
  const run = new Function(...Object.keys(world), `${stripTypeScriptTypes(screen.slice(begin, end))}\nreturn continueWithAccount;`)(...Object.values(world));
  return { run, basis, calls, issues, busy, world, resolve: (value?: boolean) => resolve(value), reject: () => reject(new Error('save unavailable')),
    retry() { result = pending(); }, switchAccount() { owner++; } };
}

test('the deliberate account action carries every answer and selected tutor once without fabricating practice', async () => {
  const h = accountContinuation(); const first = h.run(); await h.run();
  assert.deepEqual(h.calls, [h.basis], 'the chosen plan, voice and memory answer must cross the current auth seam unchanged');
  h.resolve(); await first;
  assert.deepEqual(h.issues, []);
  assert.equal(h.calls.length, 1, 'an anonymous draft remains available throughout auth');
  assert.match(screen, /label=\{needsAccount \? 'Create account to start' : 'Start live practice'\}/);
  assert.match(screen, /needsAccount \? continueWithAccount\(\) : start\(\)/);
  assert.match(screen, /needsAccount && !signedIn && <GhostButton label="I already have an account"/);
});

test('account setup failures retain the answered plan and expose the same retry action', async () => {
  for (const rejected of [false, true]) {
    const h = accountContinuation(true); const first = h.run();
    if (rejected) h.reject(); else h.resolve(false);
    await first;
    assert.equal(h.calls.length, 1, 'failed profile setup must not clear the saved plan');
    assert.match(h.issues.at(-1) ?? '', /choices are still here/i);
    h.retry(); const retry = h.run(); h.resolve(true); await retry;
    assert.deepEqual(h.calls, [h.basis, h.basis, 'clear-account-setup']);
  }
});

test('successful signed-in setup clears its own draft even if completion unmounts the questions', async () => {
  const h = accountContinuation(true); const first = h.run();
  h.world.current.current = false; const writes = h.busy.length;
  h.resolve(true); await first;
  assert.deepEqual(h.calls, [h.basis, 'clear-account-setup']);
  assert.equal(h.busy.length, writes, 'the departed question screen must not update its UI');
});

test('a late setup result cannot clear another account’s draft or draw a departed error', async () => {
  for (const rejected of [false, true]) {
    const h = accountContinuation(true); const first = h.run(); h.switchAccount();
    const writes = h.busy.length;
    if (rejected) h.reject(); else h.resolve(true);
    await first;
    assert.deepEqual(h.calls, [h.basis]); assert.deepEqual(h.issues, []); assert.equal(h.busy.length, writes);
  }
});

test('preview, refusal and unaccepted Terms cannot trigger the account continuation', async () => {
  for (const blocked of ['preview', 'refusal', 'terms'] as const) {
    const h = accountContinuation(false, blocked);
    await h.run(); assert.deepEqual(h.calls, []);
  }
});

test('only pending or legacy unfinished setup opens the first-practice primer', () => {
  const draft = { ...freshPreAccountDraft(), eligibilityConfirmed: true, page: 'account' as const, accountReturnPage: 'choose-tutor' as const };
  assert.equal(shouldStartFirstPractice(draft, null), true);
  assert.equal(shouldStartFirstPractice({ ...draft, accountReturnPage: 'keep' }, null), false, 'a completed guest handoff cannot become a new first practice');
  assert.equal(shouldStartFirstPractice(freshPreAccountDraft(), null), true, 'the legacy unfinished setup still leads to its first scene');
  const guest: GuestPractice = { version: 2, token: null, id: null, expiresAt: 0, secondsUsed: 0, attempts: [], kept: false, completed: false, plan: draft };
  assert.equal(shouldStartFirstPractice(draft, guest), true);
  assert.equal(shouldStartFirstPractice(draft, { ...guest, completed: true }), false);
  assert.equal(shouldStartFirstPractice(draft, { ...guest, finishedAt: [1_790_000_000_000] }), false, 'legacy recorded finishes remain completed');
  assert.equal(shouldStartFirstPractice(draft, { ...guest, live: { brief: briefFromDraft(draft), sessionId: 'c2-session', outcome: 'completed', contributions: [], seconds: 30, completedAt: 1_790_000_000_000, pack: null } }), false);
});

function profileBootstrap() {
  const bootstrap = app.slice(app.indexOf('function PreAccountProfileBootstrap('), app.indexOf('/** ProfileGate mounts'));
  const effect = bootstrap.slice(bootstrap.indexOf('    // React'), bootstrap.indexOf('  }, [confirmed,'));
  const calls: string[] = [], firstPractices: boolean[] = [];
  const draft = { ...freshPreAccountDraft(), eligibilityConfirmed: true, page: 'account' as const, accountReturnPage: 'choose-tutor' as const };
  let owner = 1, resolve!: (guest: GuestPractice | null) => void, reject!: (error: Error) => void;
  const read = new Promise<GuestPractice | null>((done, fail) => { resolve = done; reject = fail; });
  const world = { confirmed: true, delivered: { current: false }, draft, scopeGeneration: () => owner,
    profileFromDraft: () => { calls.push('build'); return {}; },
    loadGuestPractice: (strict: boolean) => { assert.equal(strict, true); calls.push('read-practice'); return read; }, shouldStartFirstPractice,
    saveConsent: async () => { calls.push('consent'); return 'durable'; }, reminderFromDraft: () => ({}),
    saveReminder: async () => { calls.push('reminder'); return 'durable'; }, saveProfile: async () => { calls.push('profile'); return true; },
    setBootstrapError: () => calls.push('error'), done: (_profile: unknown, startPractice: boolean) => { firstPractices.push(startPractice); calls.push('done'); },
    onConsumed: () => calls.push('consume'),
  };
  const invoke = new Function(...Object.keys(world), `${stripTypeScriptTypes(`function runEffect() {${effect}}`)}\nreturn runEffect;`)(...Object.values(world));
  return { invoke, calls, firstPractices, resolve, reject: () => reject(new Error('storage unavailable')), draft,
    accountChanged() { owner++; }, settle: () => new Promise<void>(done => setImmediate(done)) };
}

test('the no-guest account bootstrap consumes its answered plan once after durable writes and keeps first practice pending', async () => {
  const h = profileBootstrap(); h.invoke(); h.invoke();
  assert.deepEqual(h.calls, ['build', 'read-practice'], 'duplicate effects must share the same pending adoption');
  h.resolve(null); await h.settle(); h.invoke();
  assert.deepEqual(h.calls, ['build', 'read-practice', 'consent', 'reminder', 'profile', 'done', 'consume']);
  assert.deepEqual(h.firstPractices, [true]);
});

test('unread guest completion or an account switch cannot fabricate pending practice or consume the plan', async () => {
  for (const failed of ['read', 'account'] as const) {
    const h = profileBootstrap(); h.invoke();
    if (failed === 'read') h.reject(); else { h.accountChanged(); h.resolve(null); }
    await h.settle();
    assert.deepEqual(h.firstPractices, []);
    assert.ok(!h.calls.includes('consume') && !h.calls.includes('profile'), 'the profile and plan must stay with their original owner');
    assert.equal(h.calls.includes('error'), failed === 'read');
  }
});

test('completed legacy practice stays in the existing guest handoff and never opens another first scene', async () => {
  const h = profileBootstrap(); h.invoke();
  h.resolve({ version: 2, token: null, id: null, expiresAt: 0, secondsUsed: 30, attempts: [], kept: true, completed: true, plan: h.draft });
  await h.settle();
  assert.deepEqual(h.firstPractices, [false]);
  assert.ok(!h.calls.includes('consume'), 'the existing guest account handoff must finish adoption before clearing its plan');
});
