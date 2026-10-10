import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { passwordsMatch, signupProblems, signupReady, visibleFormHeight } from './signupForm.ts';

test('submission eligibility is independent of keyboard dismissal and strength advice', () => {
  for (const [email, password, confirm] of [
    ['', '', ''], ['james@example.com', '', ''], ['bad-email', 'a'.repeat(8), 'a'.repeat(8)],
    ['james@example.com', 'short', 'short'], ['james@example.com', 'long enough', 'long enoug'],
  ]) assert.equal(signupReady(email!, password!, confirm!), false);
  // Low estimated strength still passes the existing local length policy.
  assert.equal(signupReady('james@example.com', 'aaaaaaaa', 'aaaaaaaa'), true);
  assert.equal(signupReady('  james@example.com  ', 'a'.repeat(200), 'a'.repeat(200)), true);
  assert.ok(signupProblems('', '', '').confirm);
  assert.ok(signupProblems('james@example.com', 'long enough', 'different').confirm);
});

test('partial identical values are never described as complete passwords', () => {
  assert.equal(passwordsMatch('', ''), false);
  assert.equal(passwordsMatch('abc', 'abc'), false);
  assert.equal(passwordsMatch('abcdefgh', 'abc'), false);
  assert.equal(passwordsMatch('abcdefgh', 'abcdefgh'), true);
  assert.equal(passwordsMatch('abcdefgh!', 'abcdefgh'), false);
});

test('visible form bounds handle native iOS insets, Android resize and hardware keyboards', () => {
  assert.equal(visibleFormHeight(120, 650, 480), 360);
  assert.equal(visibleFormHeight(120, 360, 480), 360);
  assert.equal(visibleFormHeight(120, 650, null), 650);
  assert.equal(visibleFormHeight(120, 650, 100), 0);
  assert.equal(visibleFormHeight(120, 650, 900), 650);
});

test('Next and Done preserve focus until explicit progression; only the primary tap submits', () => {
  const source = readFileSync(new URL('./SignUpScreen.tsx', import.meta.url), 'utf8');
  const done = source.slice(source.indexOf('  const finishEditing ='), source.indexOf('  const leave ='));
  assert.match(done, /validateForm\(\)/);
  assert.match(done, /Keyboard\.dismiss\(\)/);
  assert.doesNotMatch(done, /submit\(|signUpWithPassword/);
  assert.match(source, /onSubmitEditing=\{finishEditing\}/);
  assert.equal((source.match(/submitBehavior="submit"/g) ?? []).length, 3);
  assert.equal((source.match(/blurOnSubmit=\{false\}/g) ?? []).length, 3);
  assert.doesNotMatch(source, /setTimeout|emailReadyToAdvance|useCompactPhone|footer=|PasswordMeter value=\{confirm\}/);
  assert.match(source, /disabled=\{busy \|\| !ready \|\| formOk\}/);
});

test('a pending signup cannot discard its duplicate-request lock by navigating away', () => {
  const source = readFileSync(new URL('./SignUpScreen.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('  const leave =');
  const end = source.indexOf('  // Asked once', start);
  assert.ok(start > 0 && end > start, 'the guarded auth navigation handler is missing');
  // Exercise the actual callback without importing a native screen or engines.
  const callback = stripTypeScriptTypes(source.slice(start, end));
  const makeLeave = new Function('busy', 'requestRunning', 'Keyboard', `${callback}\nreturn leave;`) as (
    busy: boolean, requestRunning: { current: boolean }, keyboard: { dismiss: () => void },
  ) => (next: () => void) => unknown;
  for (const [busy, running] of [[true, true], [true, false], [false, true], [false, false]]) {
    let dismissed = 0;
    let navigated = 0;
    makeLeave(busy!, { current: running! }, { dismiss: () => { dismissed += 1; } })(() => { navigated += 1; });
    const allowed = !busy && !running;
    assert.equal(navigated, allowed ? 1 : 0);
    assert.equal(dismissed, allowed ? 1 : 0);
  }
  assert.match(source, /back=\{\{ onPress: \(\) => leave\(onBack\), disabled: busy \}\}/);
  assert.match(source, /<Press[^>]*disabled=\{busy\} accessibilityState=\{\{ disabled: busy \}\} onPress=\{\(\) => leave\(onSignIn\)\}/);
});
