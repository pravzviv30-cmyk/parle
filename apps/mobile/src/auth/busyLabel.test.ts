/**
 * What an auth screen says while it is waiting on the network — F152.
 *
 * There is no renderer in this workspace, so this proves two halves and is
 * honest about the seam between them. The copy is a pure module and is called
 * directly. Whether the screens actually use it is a source walk over the three
 * auth `.tsx` files: it can see that a button which greys out also relabels,
 * and it cannot see a pixel, a real tap, or the order the two happen in.
 *
 * What it therefore cannot claim: that the label changes at the moment the
 * request starts. It can only claim that no auth button greys out in silence.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { authButtonLabel, type AuthAction } from './busyLabel.ts';

const AUTH_DIR = import.meta.dirname;
const SRC_DIR = path.resolve(AUTH_DIR, '..');

const read = (relative: string): string => readFileSync(path.join(SRC_DIR, relative), 'utf8');

/** The opening tag whole, brace-aware so `icon={<GoogleMark size={18} />}` does not end it early. */
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

const SCREENS = ['auth/SignInScreen.tsx', 'auth/SignUpScreen.tsx', 'auth/SetNewPasswordScreen.tsx'] as const;
const ACTIONS: AuthAction[] = ['signIn', 'createAccount', 'saveNewPassword', 'google', 'apple', 'sendReset'];

describe('a screen that is waiting says so — F152', () => {
  test('a busy auth button says what it is doing', () => {
    // Every wait a learner can start from an auth screen, each named by the
    // thing that is happening rather than by a spinner.
    assert.equal(authButtonLabel('signIn', false), 'Sign in');
    assert.equal(authButtonLabel('signIn', true), 'Signing in…');
    assert.equal(authButtonLabel('createAccount', false), 'Create account');
    assert.equal(authButtonLabel('createAccount', true), 'Creating account…');
    assert.equal(authButtonLabel('saveNewPassword', false), 'Save new password');
    assert.equal(authButtonLabel('saveNewPassword', true), 'Saving…');
    assert.equal(authButtonLabel('google', false), 'Continue with Google');
    assert.equal(authButtonLabel('google', true), 'Waiting for Google…');
    assert.equal(authButtonLabel('apple', false), 'Continue with Apple');
    assert.equal(authButtonLabel('apple', true), 'Waiting for Apple…');
    assert.equal(authButtonLabel('sendReset', false), 'Send reset link');
    assert.equal(authButtonLabel('sendReset', true), 'Sending…');

    for (const action of ACTIONS) {
      const ready = authButtonLabel(action, false);
      const busy = authButtonLabel(action, true);
      assert.notEqual(busy, ready, `${action} says the same thing busy as it does ready, so nothing changed on screen`);
      assert.ok(busy.length > 0 && busy.length <= 32, `"${busy}" is not a glance`);
      assert.ok(!/—/.test(busy), `"${busy}" carries an em dash`);
      assert.ok(!/\d/.test(busy), `"${busy}" carries a number, which reads as a timer`);
      assert.doesNotMatch(busy, /sorry|please wait|hang on|slow|still/i, `"${busy}" apologises or nags`);
    }

    // The screens: every button that greys out while busy also relabels while
    // busy. A button that only greys is a button that stopped working.
    let greyed = 0;
    for (const where of SCREENS) {
      const body = read(where);
      const buttons = [...tags(body, 'PillButton'), ...tags(body, 'BoldButton'), ...tags(body, 'OutlineButton'), ...tags(body, 'GhostButton')];
      const waiting = buttons.filter((tag) => /disabled=\{[^}]*\bbusy\b/.test(tag) && !/Cancel and sign out/.test(tag));
      assert.ok(waiting.length > 0, `${where} has no button that greys out while busy; this test is reading the wrong file`);
      for (const tag of waiting) {
        greyed += 1;
        if (/Return to sign in|Forgot your password\?|Resend reset email/.test(tag)) {
          assert.match(tag, /disabled=\{busy\}/);
          continue;
        }
        const call = /authButtonLabel\('(\w+)',\s*([^)]*)\)/.exec(tag);
        assert.ok(
          call,
          `${where} greys a button out while busy and leaves its label alone, so the screen looks broken rather than busy:\n${tag}`,
        );
        const [, action, flag] = call as unknown as [string, string, string];
        // One flag greys everything, and that is right: two requests at once on
        // one form is the bug underneath. But the words are per button. A
        // screen that relabelled all three from the shared flag would tell a
        // learner who tapped Sign in that it is waiting for Google.
        const ownWait = flag.trim() === 'busy' || flag.includes(`pending === '${action}'`);
        assert.ok(
          ownWait,
          `${where} labels the ${action} button from ${flag.trim()}, which is not that button's own wait`,
        );
        if (waiting.length > 1) {
          assert.ok(
            flag.includes(`pending === '${action}'`),
            `${where} has ${waiting.length} buttons sharing one flag, so ${action} would claim to be running when another one is`,
          );
        }
      }
      for (const provider of tags(body, 'ProviderButton')) {
        assert.match(provider, /disabled=\{busy\}/);
        assert.match(provider, /busy=\{pending === '(apple|google)'\}/);
        greyed++;
      }
      const provider = read('auth/ProviderButtonBase.tsx');
      assert.match(provider, /busy && <Text accessibilityLiveRegion="polite"/);
      assert.match(provider, /Connecting to/);
      assert.match(body, /from '\.\/busyLabel\.ts'/, `${where} writes its own busy copy instead of using the shared module`);
    }
    assert.ok(greyed >= 6, `only ${greyed} busy buttons found across the three auth screens; the walk is missing some`);
  });

  test('forgot password cannot be tapped while the screen is busy', () => {
    const signIn = read('auth/SignInScreen.tsx');
    const ghosts = tags(signIn, 'GhostButton');
    const forgot = ghosts.find(tag => /Forgot your password\?/.test(tag));
    assert.ok(forgot, 'the sign-in screen must have a password-reset door');
    assert.match(
      forgot,
      /label="Forgot your password\?"/,
      'the ghost button on the sign-in screen is no longer the reset link',
    );
    assert.equal(authButtonLabel('sendReset', false), 'Send reset link', 'the link stopped saying what it always said');
    assert.match(
      forgot,
      /disabled=\{busy\}/,
      'Forgot password stays tappable while the screen is busy, so a second tap sends a second reset email and races the first request',
    );

    // The prop is not decorative. GhostButton lives in another territory, so it
    // is read rather than edited here: the point is that the value handed to it
    // reaches the Pressable and the label, or the sign-in screen is passing a
    // prop into a component that ignores it.
    const components = read('components.tsx');
    const ghost = components.slice(
      components.indexOf('export function GhostButton('),
      components.indexOf('export function OptionCard('),
    );
    assert.ok(ghost.length > 0, 'GhostButton moved or was renamed; this test is reading nothing');
    assert.match(ghost, /disabled\?: boolean/, 'GhostButton takes no disabled prop, so the sign-in screen is passing one into a void');
    assert.match(ghost, /disabled=\{disabled\}/, 'GhostButton never hands disabled to its Pressable, so the tap still lands');
    // Revamp B (F597, F627): a live ghost is ink by default and a busy one is
    // soft ink. The two pins together are what keep them apart, since the
    // sign-in screen passes no colour and so draws in the default.
    assert.match(ghost, /disabled \? paper\.inkSoft : color/, 'a disabled ghost looks exactly like a live one');
    assert.match(ghost, /color = paper\.ink,/, 'a live ghost no longer defaults to ink, so it may be drawn in the same soft ink as a busy one');

    // And the flag it reads is really raised for the whole request.
    //
    // The end marker is searched for *from* the handler rather than from the
    // top of the file, the way surfaceContract.test.ts does it. A cleanup
    // returned from a `useEffect` is also a `return (`, and the screen grew one
    // when the Apple door arrived (F376), which silently emptied this slice and
    // made the assertion below read nothing at all.
    const forgotAt = signIn.indexOf('const forgot = async');
    assert.ok(forgotAt >= 0, 'the forgot handler moved or was renamed; this test is reading nothing');
    const forgotHandler = signIn.slice(forgotAt, signIn.indexOf('return (', forgotAt));
    assert.ok(forgotHandler.length > 0, 'the forgot handler slice is empty, so the assertion below would pass on nothing');
    assert.match(
      forgotHandler,
      /setPending\('sendReset'\)[\s\S]*sendPasswordReset[\s\S]*setPending\(null\)/,
      'the reset request does not run inside the flag the button reads, so the link is live while it is in flight',
    );
  });
});
