import assert from 'node:assert/strict';
import { test } from 'node:test';
import { passwordStrength } from './passwordStrength.ts';
import { passwordTooShort } from './validate.ts';
import { readFileSync } from 'node:fs';

test('password guidance separates the eight-character rule from colour and never caps a password', () => {
  assert.equal(passwordStrength('Ab1!cde').met, false);
  assert.equal(passwordStrength('Ab1!cdef').met, true);
  assert.equal(passwordStrength('Ab1!cdef').level, 'good');
  assert.equal(passwordStrength('abcdefgh').level, 'medium');
  assert.equal(passwordStrength('aaaaaaaaaaaa').level, 'low');
  assert.equal(passwordStrength('Password123!').level, 'low');
  assert.equal(passwordStrength('abcdefgh').text, 'Add symbols and numbers');
  assert.equal(passwordStrength('long unusual passphrase').level, 'good');
  assert.equal(passwordStrength('abcdefghijk').progress, 11 / 12);
  assert.equal(passwordStrength('abcdefghijkl').progress, 1);
  assert.equal(passwordStrength('a'.repeat(200)).progress, 1);
  assert.equal(passwordTooShort('a'.repeat(200)), false);
  assert.equal(passwordTooShort('abcdefgh'), false, 'guidance must not become a new acceptance rule');
});

test('signup gives both passwords a meter without limiting their length', () => {
  const signup = readFileSync(new URL('./SignUpScreen.tsx', import.meta.url), 'utf8');
  assert.match(signup, /<PasswordMeter value=\{password\}/);
  assert.match(signup, /<PasswordMeter value=\{confirm\}/);
  assert.doesNotMatch(signup, /maxLength=|At least 8 characters/);
  assert.match(signup, /EMAIL_ADVANCE_IDLE_MS/);
  const flow = readFileSync(new URL('./AuthFlow.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(flow, /<Sheet|<SignUpScreen\s+embedded/);
  assert.match(flow, /display: screen === 'welcome' \? 'flex' : 'none'/);
});
