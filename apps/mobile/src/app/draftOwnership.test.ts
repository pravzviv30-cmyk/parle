import { evidence } from '../../test/evidence.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const bootstrap = app.slice(app.indexOf('function PreAccountProfileBootstrap('), app.indexOf('/** ProfileGate mounts'));
const effect = bootstrap.slice(bootstrap.indexOf('    // React'), bootstrap.indexOf('  }, [confirmed,'));

async function run(confirmed: boolean, switchAfterConsent = false) {
  const calls: string[] = []; let generation = 1;
  const bindings = { confirmed, delivered: { current: false }, draft: { analyticsConsent: true },
    scopeGeneration: () => generation, profileFromDraft: () => { calls.push('build'); return {}; },
    reminderFromDraft: () => ({}), saveConsent: async () => { calls.push('consent'); if (switchAfterConsent) generation++; },
    saveReminder: async () => { calls.push('reminder'); }, saveProfile: async () => { calls.push('durable'); return true; }, setBootstrapError: () => {}, done: () => calls.push('profile'), onConsumed: () => calls.push('consume'),
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
  assert.deepEqual(await run(true, true), ['build', 'consent']);
});
