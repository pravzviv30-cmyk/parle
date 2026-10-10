import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

/** Lift the production callback, keeping its guards and await ordering intact. */
function callback(kind: 'setup' | 'repair', bindings: Record<string, unknown>): () => Promise<void> {
  const file = kind === 'setup' ? 'PreAccountOnboarding.tsx' : 'OnboardingFlow.tsx';
  const name = kind === 'setup' ? 'saveAccount' : 'complete';
  const next = kind === 'setup' ? 'nextQuestion' : 'confirmAge';
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const start = source.indexOf(`  const ${name} = `);
  const end = source.indexOf(`  const ${next} = `, start);
  assert.ok(start > 0 && end > start);
  const lifted = stripTypeScriptTypes(source.slice(start, end));
  return new Function(...Object.keys(bindings), lifted + `\nreturn () => ${name}('emilie');`)(...Object.values(bindings));
}

function pendingCompletion(kind: 'setup' | 'repair') {
  const calls: string[] = [];
  let generation = 1;
  let settle!: (result: boolean) => void;
  const pending = new Promise<boolean>((resolve) => { settle = resolve; });
  const alive = { current: true };
  const save = () => { calls.push('save'); return pending; };
  const run = callback(kind, {
    operation: { current: false }, submission: { current: false }, pageMotion: { locked: { current: false } },
    refused: false, draft: { eligibilityConfirmed: true }, draftRef: { current: {} }, page: 'keep',
    oldEnough: true, name: 'Camille', existing: null, analyticsConsent: false,
    current: alive, alive, signedIn: true, scopeGeneration: () => generation,
    setBusy: () => {}, setIssue: (message: string) => { if (message) calls.push('error'); }, stopSound: () => {}, metric: () => {}, preview: { stop: () => {} },
    answersFrom: (answers: unknown) => answers, onCreateAccount: save, onDone: save,
    clearSetupDraft: async () => { calls.push('clear'); }, clearRepairDraft: async () => { calls.push('clear'); },
  });
  return { run, calls, settle, switchAccount: () => { generation++; }, unmount: () => { alive.current = false; } };
}

for (const kind of ['setup', 'repair'] as const) {
  test(`${kind} completion ignores repeated taps and never clears a new account's draft`, async () => {
    const attempt = pendingCompletion(kind);
    const first = attempt.run();
    await attempt.run();
    assert.deepEqual(attempt.calls, ['save']);
    attempt.switchAccount(); attempt.settle(true); await first;
    assert.deepEqual(attempt.calls, ['save']);
  });
  test(`${kind} completion clears the saved account draft even when successful navigation unmounts the form`, async () => {
    const attempt = pendingCompletion(kind);
    const first = attempt.run();
    attempt.unmount(); attempt.settle(true); await first;
    assert.deepEqual(attempt.calls, ['save', 'clear']);
  });
  test(`${kind} completion keeps failed answers available for retry`, async () => {
    const attempt = pendingCompletion(kind);
    const first = attempt.run();
    attempt.settle(false); await first;
    assert.deepEqual(attempt.calls, ['save', 'error']);
  });
}
