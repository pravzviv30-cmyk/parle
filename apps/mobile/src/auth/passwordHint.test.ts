/**
 * The one password rule, visible while it is being met — F156.
 *
 * The hint is a pure function of what has been typed, so the first half of this
 * is a direct call. The second half is a source walk over SignUpScreen.tsx,
 * because there is no renderer here: it can see that the line is rendered under
 * the password field and that it changes colour on the met state, and it cannot
 * see the colour on a screen or the moment it flips.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { passwordHint } from './passwordHint.ts';
import { PASSWORD_MIN } from './validate.ts';

const AUTH_DIR = import.meta.dirname;
const read = (name: string): string => readFileSync(path.join(AUTH_DIR, name), 'utf8');

describe('the password requirement while it is being met — F156', () => {
  test('the password hint updates as the requirement is met', () => {
    // Nothing typed yet: the rule is on screen before the first keystroke, and
    // it is still there after it, which is the whole point. A placeholder is
    // not, because a placeholder is gone the moment the learner starts.
    const empty = passwordHint('');
    assert.equal(empty.met, false);
    assert.ok(empty.text.includes(String(PASSWORD_MIN)), 'the hint does not say how long the password has to be');

    // Every length short of the rule says the same thing, so the line does not
    // flicker its wording while somebody types.
    for (let length = 0; length < PASSWORD_MIN; length += 1) {
      const hint = passwordHint('a'.repeat(length));
      assert.equal(hint.met, false, `${length} characters was treated as long enough`);
      assert.equal(hint.text, empty.text, `the hint rewords itself at ${length} characters`);
    }

    // And it flips exactly once, at the boundary the server was told about.
    for (const length of [PASSWORD_MIN, PASSWORD_MIN + 1, 40]) {
      const hint = passwordHint('a'.repeat(length));
      assert.equal(hint.met, true, `${length} characters was still treated as too short`);
      assert.notEqual(hint.text, empty.text, 'the line says nothing new once the rule is met');
    }
    assert.equal(passwordHint('12345678').met, true, 'the hint invented a rule beyond length');
    assert.equal(passwordHint('        ').met, true, 'the hint trims, and the server is the one that decides that');

    // It is a hint, not a verdict. Nothing here scolds and nothing is red.
    for (const value of ['', 'abc', 'abcdefgh', 'a'.repeat(50)]) {
      const { text } = passwordHint(value);
      assert.ok(text.length > 0 && text.length <= 40, `"${text}" is not a glance`);
      assert.ok(!/—/.test(text), `"${text}" carries an em dash`);
      assert.doesNotMatch(text, /must|invalid|error|wrong|fail|need to|required/i, `"${text}" reads as a telling-off`);
    }

    // The screen: one line, under the password field, above the confirm field.
    const screen = read('SignUpScreen.tsx');
    assert.match(screen, /from '\.\/passwordHint\.ts'/, 'the sign-up screen does not use the hint module');
    assert.match(
      screen,
      /const \w*[hH]int = passwordHint\(password\)/,
      'the hint is not computed from what has been typed, so it cannot update as the learner types',
    );
    assert.match(screen, /signal\.good/, 'nothing on the sign-up screen turns affirmative when the rule is met');
    assert.match(
      screen,
      /\w*[hH]int\.met \?\s*signal\.good/,
      'the hint does not change colour on the met state, so meeting the rule looks the same as not meeting it',
    );

    const passwordField = screen.indexOf('label="Password"');
    const confirmField = screen.indexOf('label="Confirm password"');
    const hintLine = screen.indexOf('hint.text');
    assert.ok(passwordField > 0 && confirmField > passwordField, 'the sign-up fields moved; this test is reading the wrong shape');
    assert.ok(
      hintLine > passwordField && hintLine < confirmField,
      'the hint is not rendered between the password field and the one below it, so it is a line about nothing',
    );

    // Not an error state. surfaceContract.test.ts requires every `*Error` state
    // on this screen to reach a Field, and a hint is not a field error.
    assert.doesNotMatch(screen, /const \[\w*[hH]int\w*Error/, 'the hint is named as an error, which it is not');
  });
});
