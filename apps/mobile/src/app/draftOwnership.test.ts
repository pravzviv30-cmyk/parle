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
    saveReminder: async () => { calls.push('reminder'); }, done: () => calls.push('profile'), onConsumed: () => calls.push('consume'),
  };
  new Function(...Object.keys(bindings), stripTypeScriptTypes('function runEffect() {\n' + effect + '\n}') + '\nreturn runEffect();')(...Object.values(bindings));
  await new Promise<void>(resolve => setImmediate(resolve)); return calls;
}

test('an existing empty OAuth account must confirm the on-phone draft before any preference or profile adoption', async () => {
  assert.deepEqual(await run(false), []);
  assert.deepEqual(await run(true), ['build', 'consent', 'reminder', 'profile', 'consume']);
  assert.match(app, /requireReview=\{user.provider === 'google' \|\| user.provider === 'apple'\}/);
  assert.match(bootstrap, /Use this plan for my account/);
  assert.match(bootstrap, /label="Start a new plan instead" onPress=\{onConsumed\}/);
});

test('a scope change during draft adoption cannot apply the plan or reminder to the next account', async () => {
  assert.deepEqual(await run(true, true), ['build', 'consent']);
});
