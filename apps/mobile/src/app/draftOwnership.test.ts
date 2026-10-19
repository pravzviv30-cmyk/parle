import { evidence } from '../../test/evidence.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const bootstrap = app.slice(app.indexOf('function PreAccountProfileBootstrap('), app.indexOf('/** ProfileGate mounts'));
const effect = bootstrap.slice(bootstrap.indexOf('    // React'), bootstrap.indexOf('  }, [confirmed,'));

async function run(confirmed: boolean, { switchAt, failAt }: { switchAt?: string; failAt?: string } = {}) {
  const calls: string[] = []; let generation = 1;
  const preference = async (store: string) => { calls.push(store); if (switchAt === store) generation++; return failAt === store ? 'volatile' : 'durable'; };
  const bindings = { confirmed, delivered: { current: false }, draft: { analyticsConsent: true },
    scopeGeneration: () => generation, profileFromDraft: () => { calls.push('build'); return {}; },
    reminderFromDraft: () => ({}), saveConsent: () => preference('consent'),
    saveReminder: () => preference('reminder'), saveProfile: async () => { calls.push('durable'); if (switchAt === 'durable') generation++; return failAt !== 'durable'; }, setBootstrapError: () => calls.push('error'), done: () => calls.push('profile'), onConsumed: () => calls.push('consume'),
  };
  new Function(...Object.keys(bindings), stripTypeScriptTypes('function runEffect() {\n' + effect + '\n}') + '\nreturn runEffect();')(...Object.values(bindings));
  await new Promise<void>(resolve => setImmediate(resolve)); return calls;
}

test('an empty OAuth account must confirm ownership before durable preference and profile adoption', async () => {
  assert.deepEqual(await run(false), []);
  assert.deepEqual(await run(true), ['build','consent','reminder','durable','profile','consume']);
  assert.match(app, /requireReview=\{!newlyCreated && \(preAccountDraft\.eligibilityConfirmed === true \|\| user\.provider === 'google' \|\| user\.provider === 'apple'\)\}/);
  assert.match(app, /const newlyCreated = newAccountUserId === user\.id;/);
  const signup = evidence('apps/mobile/src/auth/signupCompletion.ts');
  assert.match(signup, /created\?\.id === result\.createdUserId/);
  assert.match(signup, /created\.provider === 'password' \|\| created\.provider === 'mock'/);
  assert.match(signup, /created\.email\?\.trim\(\)\.toLowerCase\(\) === email\.trim\(\)\.toLowerCase\(\)/);
  assert.match(app, /Use this plan for my account/);
  assert.match(app, /Start a new plan instead/);
});

test('a scope change during draft adoption cannot apply the plan or reminder to the next account', async () => {
  assert.deepEqual(await run(true, { switchAt: 'consent' }), ['build', 'consent']);
  assert.deepEqual(await run(true, { switchAt: 'reminder' }), ['build', 'consent', 'reminder']);
  assert.deepEqual(await run(true, { switchAt: 'durable' }), ['build', 'consent', 'reminder', 'durable']);
});

test('an incomplete durable write leaves the plan available for retry and never releases the app', async () => {
  assert.deepEqual(await run(true, { failAt: 'consent' }), ['build', 'consent', 'error']);
  assert.deepEqual(await run(true, { failAt: 'reminder' }), ['build', 'consent', 'reminder', 'error']);
  assert.deepEqual(await run(true, { failAt: 'durable' }), ['build', 'consent', 'reminder', 'durable', 'error']);
});

/** Execute the actual account-completion callbacks without mounting their JSX. */
function completion(kind: 'new' | 'repair', bindings: Record<string, unknown>): (...args: unknown[]) => Promise<unknown> {
  const marker = kind === 'new' ? 'onCreateAccount={async draft => {' : 'onDone={(answers) => {';
  const begin = app.indexOf(marker);
  assert.ok(begin > 0);
  const start = begin + marker.indexOf('{') + 1;
  const end = app.indexOf('            }}', start);
  const source = app.slice(start, end + 13);
  return new Function(...Object.keys(bindings), stripTypeScriptTypes('const run = ' + source + ';') + '\nreturn run;')(...Object.values(bindings));
}

test('signed-in setup requires durable consent, reminder and profile before completion', async () => {
  for (const failure of [undefined, 'consent', 'reminder', 'profile']) {
    const calls: string[] = [];
    const firstScene = { current: null as string | null };
    const invoke = completion('new', {
      scopeGeneration: () => 1, profileFromDraft: () => ({}), reminderFromDraft: () => ({}),
      saveConsent: async () => { calls.push('consent'); return failure === 'consent' ? 'volatile' : 'durable'; },
      saveReminder: async () => { calls.push('reminder'); return failure === 'reminder' ? 'volatile' : 'durable'; },
      saveProfile: async () => { calls.push('profile'); return failure !== 'profile'; },
      firstScene, firstSceneFor: (level: string, reason: string) => { assert.equal(level, 'getby'); assert.equal(reason, 'trip'); return 'first'; },
      setJustOnboarded: (value: boolean) => { assert.equal(value, true); calls.push('home-ready'); },
      done: () => calls.push('done'),
    });
    assert.equal(await invoke({ eligibilityConfirmed: true, startLevel: 'getby', reason: 'trip' }), failure === undefined);
    const expected = failure === 'consent' ? ['consent'] : failure === 'reminder' ? ['consent', 'reminder'] : failure === 'profile' ? ['consent', 'reminder', 'profile'] : ['consent', 'reminder', 'profile', 'home-ready', 'done'];
    assert.deepEqual(calls, expected);
    assert.equal(firstScene.current, failure === undefined ? 'first' : null, 'the scene-plan metadata must be retained only after all account writes succeed');
  }
});

test('repair completion preserves an unanswered consent and aborts failed or stale durable writes', async () => {
  for (const consent of [null, true]) for (const failure of [undefined, 'consent', 'profile', 'account']) {
    const calls: string[] = []; let generation = 1;
    const invoke = completion('repair', {
      existing: {}, completeProfile: () => ({}), createStoredProfile: () => ({}), withChosenVoice: (profile: unknown) => profile,
      scopeGeneration: () => generation,
      saveConsent: async () => { calls.push('consent'); if (failure === 'account') generation++; return failure === 'consent' ? 'volatile' : 'durable'; },
      saveProfile: async () => { calls.push('profile'); if (failure === 'account') generation++; return failure !== 'profile'; },
      setJustOnboarded: () => {}, done: () => calls.push('done'), trackProductEvent: async () => { calls.push('metric'); },
    });
    const failed = failure === 'profile' || failure === 'account' || (consent !== null && failure === 'consent');
    assert.equal(await invoke({ name: null, tutorVoice: null, analyticsConsent: consent }), !failed);
    assert.equal(calls.includes('consent'), consent !== null);
    assert.equal(calls.includes('done'), !failed);
    assert.equal(calls.includes('metric'), !failed);
  }
});
