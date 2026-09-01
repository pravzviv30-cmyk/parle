/**
 * The form checks, and how little they are allowed to do — F156.
 *
 * validate.ts says of itself that it is deliberately gentle and that the server
 * has the final word. Untested, that sentence is an intention; the second half
 * of this file is what makes it a rule, by pinning addresses a stricter check
 * would wrongly refuse. Tightening these is a regression even when it feels
 * like an improvement: every false refusal here is a learner who cannot sign in
 * with an address that works.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { looksLikeEmail, passwordTooShort, PASSWORD_MIN } from './validate.ts';

const AUTH_DIR = import.meta.dirname;
const read = (name: string): string => readFileSync(path.join(AUTH_DIR, name), 'utf8');

describe('what the form checks before the server does — F156', () => {
  test('the email and password checks catch what would certainly bounce and nothing more', () => {
    // Certain bounces. Each of these cannot be delivered anywhere.
    for (const value of ['', '   ', 'nobody', '@example.com', 'me@ex', 'me@', 'you@example.com extra', 'you @example.com']) {
      assert.equal(looksLikeEmail(value), false, `"${value}" was accepted and cannot receive a confirmation email`);
    }

    // Ordinary addresses.
    for (const value of ['you@example.com', 'you@example.co.uk', '  you@example.com  ']) {
      assert.equal(looksLikeEmail(value), true, `"${value}" was refused`);
    }

    // The gentleness, which is the part worth holding. Every one of these is a
    // deliverable address that a tighter regex would refuse, and the refusal
    // would happen on this device, where no server can overrule it.
    for (const value of [
      'first.last+luvani@sub.example.co.uk',
      'UPPER@EXAMPLE.COM',
      "o'brien@example.com",
      'jose@example.museum',
      'jose@exemple.fr',
      'josé@example.com',
      'a..b@example.com',
      'me@localhost.dev',
      'x@y.internal',
    ]) {
      assert.equal(looksLikeEmail(value), true, `"${value}" is deliverable and was refused before the server ever saw it`);
    }

    // The password check is length and nothing else, on purpose.
    assert.equal(PASSWORD_MIN, 8);
    for (let length = 0; length < PASSWORD_MIN; length += 1) {
      assert.equal(passwordTooShort('a'.repeat(length)), true, `${length} characters passed a check for at least ${PASSWORD_MIN}`);
    }
    for (const value of ['a'.repeat(PASSWORD_MIN), 'a'.repeat(PASSWORD_MIN + 1), 'a'.repeat(200)]) {
      assert.equal(passwordTooShort(value), false, `"${value.length} characters" was called too short`);
    }
    for (const value of ['password', '12345678', '        ', 'ÀÉÎÔÙàéîôù']) {
      assert.equal(passwordTooShort(value), false, `"${value}" was refused by a rule this app does not have`);
    }
    assert.doesNotMatch(
      read('validate.ts'),
      /uppercase|lowercase|symbol|digit|complexity/i,
      'validate.ts has grown a complexity rule the server never asked for, and it would be applied where no server can overrule it',
    );

    // One number, in one place. The screens say it out loud and must say the
    // same one, or a learner is told a rule that is not the rule being applied.
    for (const name of ['SignUpScreen.tsx', 'SetNewPasswordScreen.tsx']) {
      const screen = read(name);
      assert.match(screen, /PASSWORD_MIN/, `${name} types the minimum length itself instead of reading it`);
      assert.doesNotMatch(screen, /at least 8/i, `${name} has the number typed into its copy`);
    }
  });
});
