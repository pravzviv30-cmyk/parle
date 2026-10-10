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
  assert.equal(passwordStrength('abcdefgh').text, 'Fair');
  assert.equal(passwordStrength('long unusual passphrase').level, 'good');
  assert.ok(passwordStrength('abcdefghijk').progress < passwordStrength('abcdefghijkl').progress);
  assert.ok(passwordStrength('a'.repeat(200)).progress < passwordStrength('long unusual passphrase').progress, 'length alone must not fill a low-strength value');
  assert.equal(passwordTooShort('a'.repeat(200)), false);
  assert.equal(passwordTooShort('abcdefgh'), false, 'guidance must not become a new acceptance rule');
});

test('strength targets evaluate full values after typing, deletion, paste and autofill', () => {
  const values = ['', 'a', 'ab', 'abcdefg', 'abcdefgh', 'abcdefghi', 'Ab1!cdef', 'Ab1!cdefmnopqrstuvwx', 'Ab1!', '', 'a'.repeat(200), 'a long unusual password-manager phrase'];
  for (const value of values) {
    const strength = passwordStrength(value);
    assert.equal(strength.met, !passwordTooShort(value), 'advice must not add a registration requirement');
    assert.ok(strength.progress >= 0 && strength.progress <= 1, 'every target stays inside the stable track');
  }
  assert.equal(passwordStrength('').progress, 0);
  assert.ok(passwordStrength('Ab1!cdef').progress > passwordStrength('abcdefgh').progress);
  assert.ok(passwordStrength('Ab1!').progress < passwordStrength('Ab1!cdef').progress);
  assert.equal(passwordStrength('Ab1!cdefmnopqrstuvwx').progress, 1);
  assert.equal(passwordStrength('        ').met, true, 'the existing policy does not trim password values');
});

test('signup keeps strength beneath Password and uses separate confirmation feedback', () => {
  const signup = readFileSync(new URL('./SignUpScreen.tsx', import.meta.url), 'utf8');
  assert.match(signup, /<PasswordMeter value=\{password\}/);
  assert.equal((signup.match(/<PasswordMeter\b/g) ?? []).length, 1);
  assert.doesNotMatch(signup, /<PasswordMeter value=\{confirm\}/);
  assert.doesNotMatch(signup, /maxLength=|At least 8 characters/);
  const flow = readFileSync(new URL('./AuthFlow.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(flow, /<Sheet|<SignUpScreen\s+embedded/);
  assert.match(flow, /display: screen === 'welcome' \? 'flex' : 'none'/);
});
