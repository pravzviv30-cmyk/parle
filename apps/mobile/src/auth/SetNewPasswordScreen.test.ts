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
    const submit = screen.slice(screen.indexOf('const submit = async'), screen.indexOf('return (', screen.indexOf('const submit = async')));
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

describe('the reset screen has a way out that grants nothing — whole-app phase 1', () => {
  test('cancel signs the recovery session out, and never skips the password or clears recovery by itself', () => {
    const screen = read('SetNewPasswordScreen.tsx');
    assert.match(screen, /label=\{leaving \? 'Signing out…' : 'Cancel and sign out'\}/);
    const cancel = screen.slice(screen.indexOf('const cancel = async'), screen.indexOf('const submit = async'));
    assert.ok(cancel.length > 0, 'the cancel handler moved; this test is stale');
    assert.match(cancel, /await adapter\.signOut\(\);/, 'cancel no longer ends the recovery session');
    assert.doesNotMatch(cancel, /onDone\(\)|clearRecovery/, 'cancel would drop the learner into the app without a new password');
  });
});

/**
 * Revamp B (F601). The recovery landing is a working screen on paper: a title
 * at the working size, the fields straight on the page, and a header row that
 * is only the frame's spacing. It used to say "Luvani · Your account" above a
 * feature card, which carried the middot STYLE retired and a card the board
 * does not draw.
 */
describe('the reset screen wears revamp B — F601', () => {
  /** The source with comments blanked, so a word in a note is not a word on screen. */
  const code = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);

  test('choosing a new password is a working title on paper, with no card and no middot in its header', () => {
    const screen = code(read('SetNewPasswordScreen.tsx'));

    // On paper: the frame's own ground, never a colour page for a form.
    assert.ok(screen.includes('<ScrollScreen'), 'the reset screen is not built on the frame; this test is reading the wrong shape');
    const frame = openingTag(screen, screen.indexOf('<ScrollScreen'));
    assert.match(frame, /automaticallyAdjustKeyboardInsets/, 'the native scroll viewport must follow the software keyboard');
    assert.doesNotMatch(frame, /\bavoidKeyboard\b/, 'a second keyboard avoidance must not double the native scroll inset');
    assert.doesNotMatch(frame, /\bground=/, 'the reset screen paints a ground of its own; a form sits on paper');

    // The header row is spacing and nothing else: no title to carry a middot,
    // no rule under it, and no way back, because the way out is the cancel link.
    const headers = tags(screen, 'ScreenHeader');
    assert.equal(headers.length, 1, 'the reset screen draws a different number of header rows than one');
    assert.equal(
      headers[0],
      '<ScreenHeader title={false} divider={false} />',
      'the header row carries a title, a rule or a back again',
    );
    assert.doesNotMatch(screen, /·/, 'a middot is back in the reset screen\'s copy');
    assert.doesNotMatch(screen, /Luvani · Your account/, 'the old header title is back');

    // No card around the form. The fields sit on the page, as sign-up's do.
    assert.doesNotMatch(screen, /<Card\b/, 'the reset form is wrapped in a card again');
    assert.doesNotMatch(screen, /tone="feature"/, 'the retired feature tone is back');

    // A working title, rolled as a heading, at the working size.
    assert.match(
      screen,
      /<Text accessibilityRole="header" style=\{\[type\.title, boldType\.title, \{ color: paper\.ink, textAlign: 'center' \}\]\}>Choose a new\{'\\n'\}password\.<\/Text>/,
      'the title is not a working title in ink, rolled as a heading',
    );
    assert.doesNotMatch(screen, /type\.display/, 'the reset screen still sets a display headline; a form takes the working title');

    // The rule is on screen while it is typed, from the one module, between the
    // two fields, and it steps up from soft ink to ink rather than turning green.
    assert.match(screen, /from '\.\/passwordHint\.ts'/, 'the reset screen does not use the shared password rule');
    assert.match(screen, /const hint = passwordHint\(password\)/, 'the rule is not computed from what has been typed');
    const first = screen.indexOf('label="New password"');
    const rule = screen.indexOf('{hint.text}');
    const second = screen.indexOf('label="Confirm password"');
    assert.ok(first >= 0 && rule > first && rule < second, 'the rule line is not between the new password and its confirmation');
    assert.match(screen, /hint\.met \? paper\.ink : paper\.inkSoft/, 'the rule line does not change on the met state');

    // Every line is ink. A failure carries the alert mark, never a colour.
    assert.doesNotMatch(screen, /\bsignal\./, 'the reset screen colours a line with a signal tone again');
    const failure = screen.slice(screen.indexOf('{formMessage != null &&'), screen.indexOf('{formMessage}') + '{formMessage}'.length);
    assert.match(failure, /<AlertGlyph size=\{16\} color=\{paper\.ink\} \/>/, 'the provider failure has no alert mark beside it');
    assert.match(failure, /color: paper\.ink/, 'the provider failure is not in ink');

    // The one ink pill is still in the footer, unchanged, and the way out is
    // still the quiet link in the body.
    assert.match(
      screen,
      /footer=\{!keyboardVisible \? <View[^>]*>[\s\S]*?<PillButton label=\{authButtonLabel\('saveNewPassword', busy\)\} onPress=\{\(\) => void submit\(\)\} disabled=\{busy \|\| leaving\} \/>/,
      'the save pill left the footer or changed its words',
    );
    assert.equal(tags(screen, 'PillButton').length, 1, 'the reset screen draws more than one ink pill');
    assert.equal(tags(screen, 'GhostButton').length, 1, 'the cancel link is gone or doubled');
  });
});
