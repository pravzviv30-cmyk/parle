import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = readFileSync(new URL('SignInScreen.tsx', import.meta.url), 'utf8');
const actions = ['submit', 'google', 'apple', 'forgot'] as const;
type Action = typeof actions[number];
type Result = { ok: boolean; message?: string };

/** Run the actual handlers with a pending adapter, before React can render busy. */
function form() {
  const calls: string[] = []; const states: unknown[] = [];
  const alive = { current: true }; const lock = { current: false };
  let resolve!: (result: Result) => void; let reject!: (error: Error) => void;
  let pending = new Promise<Result>((done, fail) => { resolve = done; reject = fail; });
  const adapterCall = (action: string) => { calls.push(action); return pending; };
  const bindings = { busy: false, requestRunning: lock, alive, email: 'camille@example.com', password: 'secret',
    looksLikeEmail: () => true, friendly: () => 'Try again.',
    setEmailError: (value: unknown) => states.push(value), setFormMessage: (value: unknown) => states.push(value),
    setProviderMessage: (value: unknown) => states.push(value), Keyboard: { dismiss: () => {} },
    setMode: (value: unknown) => states.push(value), passwordRef: { current: { focus: () => {} } },
    setFormOk: (value: unknown) => states.push(value), setPending: (value: unknown) => states.push(value),
    adapter: { signInWithPassword: () => adapterCall('submit'), signInWithGoogle: () => adapterCall('google'),
      signInWithApple: () => adapterCall('apple'), sendPasswordReset: () => adapterCall('forgot') } };
  const start = source.indexOf('  const submit = async');
  const end = source.indexOf('  const Frame = ', start);
  assert.ok(start > 0 && end > start);
  const handlers = new Function(...Object.keys(bindings), stripTypeScriptTypes(source.slice(start, end)) + '\nreturn { submit, google, apple, forgot };')(...Object.values(bindings)) as Record<Action, () => Promise<void>>;
  return { handlers, calls, states, alive, lock,
    resolve: (result: Result) => resolve(result), reject: () => reject(new Error('network')),
    reset: () => { pending = new Promise<Result>((done, fail) => { resolve = done; reject = fail; }); } };
}

for (const action of actions) {
  test(`${action} blocks all other auth actions during the same render and releases after failure`, async () => {
    const page = form();
    const request = page.handlers[action]();
    for (const repeat of actions) await page.handlers[repeat]();
    assert.deepEqual(page.calls, [action]);
    assert.equal(page.lock.current, true);
    page.reject(); await request;
    assert.equal(page.lock.current, false);
    assert.ok(page.states.includes('Try again.'));
    page.reset(); const retry = page.handlers[action]();
    page.resolve({ ok: true }); await retry;
    assert.deepEqual(page.calls, [action, action]);
    assert.equal(page.lock.current, false);
  });
  test(`${action} ignores a late result after the form unmounts`, async () => {
    const page = form();
    const request = page.handlers[action]();
    const before = [...page.states];
    page.alive.current = false; page.resolve({ ok: false, message: 'late error' }); await request;
    assert.deepEqual(page.states, before);
    assert.equal(page.lock.current, false);
  });
}

function effect(startMarker: string, endMarker: string, bindings: Record<string, unknown>) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start > 0 && end > start);
  const code = stripTypeScriptTypes('function run() {\n' + source.slice(start, end) + '\n}');
  return new Function(...Object.keys(bindings), code + '\nreturn run();')(...Object.values(bindings));
}

test('introductory heading focus leaves returning forms and embedded sheets alone', () => {
  for (const onboarding of [false, true]) for (const embedded of [false, true]) {
    const focused: unknown[] = [];
    for (const OS of ['web', 'ios']) effect('    if (!onboarding || embedded) return;', '  }, [onboarding, embedded]);', {
      onboarding, embedded, Platform: { OS }, headingRef: { current: { focus: () => focused.push('web') } },
      findNodeHandle: () => 7, AccessibilityInfo: { setAccessibilityFocus: (handle: number) => focused.push(handle) },
    });
    assert.deepEqual(focused, onboarding && !embedded ? ['web', 7] : []);
  }
  assert.match(source, /<Text ref=\{headingRef\}.*tabIndex: -1.*accessibilityRole="header"/);
});

test('Android system back waits for auth work and is restricted to full introductory forms', () => {
  let listener: (() => boolean) | undefined; let backs = 0;
  const requestRunning = { current: true };
  const bindings = { onboarding: true, embedded: false, busy: false, onBack: () => { backs++; }, requestRunning,
    Platform: { OS: 'android' }, BackHandler: { addEventListener: (_name: string, callback: () => boolean) => { listener = callback; return { remove: () => {} }; } } };
  const run = (props: Record<string, unknown>) => effect('    if (!onboarding || !onBack || embedded) return;', '  }, [onboarding, onBack, embedded, busy]);', { ...bindings, ...props });
  run({}); assert.equal(listener?.(), true); assert.equal(backs, 0);
  requestRunning.current = false; listener?.(); assert.equal(backs, 1);
  for (const props of [{ onboarding: false }, { embedded: true }, { onBack: undefined }, { Platform: { OS: 'ios' } }]) {
    listener = undefined; run(props); assert.equal(listener, undefined);
  }
  assert.match(source, /disabled=\{busy\} onPress=\{\(\) => \{ if \(!requestRunning\.current && !busy\) onCreateAccount\(\); \}\}/);
});
