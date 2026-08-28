/**
 * Where the reset screen puts its two errors — F157.
 *
 * A source walk, in the style of surfaceContract.test.ts, because there is no
 * renderer in this workspace. It can see which prop each message is handed to,
 * and that the screen still keeps a place for a failure that belongs to no
 * single field. It cannot hear VoiceOver: the announcement itself lives in
 * Field, is held by surfaceContract.test.ts, and is the reason routing an error
 * onto the Field is worth more than moving a line of text.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

const AUTH_DIR = import.meta.dirname;
const read = (name: string): string => readFileSync(path.join(AUTH_DIR, name), 'utf8');

function openingTag(body: string, from: number): string {
  let depth = 0;
  for (let i = from; i < body.length; i += 1) {
    const char = body[i]!;
    if (char === '{') depth += 1;
    else if (char === '}') depth -= 1;
    else if (char === '>' && depth === 0) return body.slice(from, i + 1);
  }
  return body.slice(from);
}

function tags(body: string, tag: string): string[] {
  const found: string[] = [];
  for (const match of body.matchAll(new RegExp(`<${tag}\\b`, 'g'))) found.push(openingTag(body, match.index));
  return found;
}

describe('the reset screen, and which line owns which mistake — F157', () => {
  test('set new password errors sit beside their fields', () => {
    const screen = read('SetNewPasswordScreen.tsx');
    const fields = tags(screen, 'Field');
    assert.equal(fields.length, 2, 'the reset screen has two fields, and this test is about both of them');

    const [password, confirm] = fields as [string, string];
    assert.match(password, /label="New password"/);
    assert.match(confirm, /label="Confirm password"/);

    // Both of this screen's own checks belong to one field each: too short is
    // about the password, not the same is about the confirmation. Field is what
    // announces an error to a screen reader, so a message that never reaches it
    // is a message somebody browsing by touch never hears.
    assert.match(
      password,
      /error=\{passwordError\}/,
      'the too-short message never reaches the field it is about, so nothing announces it',
    );
    assert.match(
      confirm,
      /error=\{confirmError\}/,
      'the passwords-do-not-match message never reaches the field it is about',
    );

    // Every field error this screen computes is handed to a field. This is the
    // same rule surfaceContract.test.ts holds the two sign-in screens to.
    const states = [...screen.matchAll(/const \[(\w*[eE]rror)\b/g)].map((m) => m[1]!);
    assert.ok(states.length >= 2, 'the reset screen no longer tracks a field error; this test is stale');
    for (const state of states) {
      assert.match(
        screen,
        new RegExp(`error=\\{${state}\\}`),
        `the reset screen computes ${state} and never hands it to a Field`,
      );
    }

    // The two checks set the state that belongs to them, and clear the other,
    // or a fixed password would leave its old complaint sitting under the field.
    const submit = screen.slice(screen.indexOf('const submit = async'), screen.indexOf('return ('));
    assert.match(submit, /passwordTooShort\(password\)[\s\S]*setPasswordError\(/, 'the length check writes to some other line');
    assert.match(submit, /confirm !== password[\s\S]*setConfirmError\(/, 'the match check writes to some other line');
    // Both are written on every submit and both are written before either can
    // stop it. Checking one at a time is what made a learner fix the length,
    // press save, and only then be told about the second field.
    assert.match(
      submit,
      /setPasswordError\(passwordProblem\)[\s\S]*setConfirmError\(confirmProblem\)[\s\S]*if \(passwordProblem \|\| confirmProblem\) return;/,
      'the two checks are not both computed and shown before the screen gives up, so a fixed field can keep its old complaint',
    );

    // A failure from the provider belongs to neither field, so the screen keeps
    // one place for it. Losing that would strand a learner whose reset link had
    // expired with a saved button that silently does nothing.
    assert.match(
      screen,
      /completePasswordReset/,
      'the reset screen no longer completes the reset; this test is reading the wrong file',
    );
    assert.match(
      submit,
      /setFormMessage\(/,
      'a failure that belongs to no field has nowhere left to appear, so the screen would fail in silence',
    );
    assert.match(screen, /\{formMessage != null &&/, 'the screen never renders the failure it stores');
  });
});
