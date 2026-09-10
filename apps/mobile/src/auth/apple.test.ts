/**
 * The Apple door — F375 and F376.
 *
 * There is no renderer here, no simulator, and no Apple Developer capability on
 * this machine, so this file is deliberately explicit about which half of each
 * claim it can hold. The provider-status rule is a pure module and is called
 * directly. Everything else is a source read: the adapter's preflight order,
 * the two screens' buttons, the config the build needs, and the sentence the
 * delete sheet owes an Apple account.
 *
 * What it therefore cannot claim, and what `docs/DEVICE_VERIFICATION.md` owes
 * instead: that the system sheet appears, that Apple signs the nonce it was
 * given, that Supabase accepts the identity token, or that the entitlement is
 * on the provisioning profile. Every one of those needs a paid Apple Developer
 * account and a device, and none of them is asserted anywhere in this repo.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { appleAvailable, appleEnabled, providerEnabled } from './providerStatus.ts';
import { authButtonLabel } from './busyLabel.ts';

const AUTH_DIR = import.meta.dirname;
const SRC_DIR = path.resolve(AUTH_DIR, '..');
const MOBILE_DIR = path.resolve(SRC_DIR, '..');

const read = (name: string): string => readFileSync(path.join(AUTH_DIR, name), 'utf8');
const readSrc = (relative: string): string => readFileSync(path.join(SRC_DIR, relative), 'utf8');

/**
 * The body of `const name = async () => { … }`, brace-matched.
 *
 * Not `slice(indexOf(name), indexOf('return ('))`: a `useEffect` cleanup is
 * also a `return (`, so that shape silently produces an empty string and every
 * assertion made against it passes on nothing. Braces inside string literals
 * would fool this, and there are none in the handlers it reads.
 */
function handlerBody(source: string, name: string): string {
  const start = source.indexOf(`const ${name} = async`);
  assert.ok(start >= 0, `the ${name} handler is gone or was renamed; this test would be reading nothing`);
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return source.slice(start);
}

const settings = (apple: unknown) =>
  new Response(JSON.stringify({ external: { apple, google: true, email: true } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('is Apple actually switched on, and does the adapter ask — F375', () => {
  test('a project with apple off says so, and the adapter asks before it opens the sheet — F375', async () => {
    // The rule, read from the same settings document Google is read from.
    assert.equal(providerEnabled({ external: { apple: false } }, 'apple'), false);
    assert.equal(providerEnabled({ external: { apple: true } }, 'apple'), true);
    assert.equal(appleEnabled({ external: { apple: false, google: true } }), false);
    assert.equal(appleEnabled({ external: { apple: true, google: false } }), true);

    // The two doors are read independently. One switched off must never take
    // the other down with it, which a shared "any provider" flag would do.
    assert.equal(providerEnabled({ external: { apple: false, google: true } }, 'google'), true);
    assert.equal(providerEnabled({ external: { apple: true, google: false } }, 'google'), false);

    // Everything unrecognised is "could not tell", never "off". Reading a shape
    // this code does not understand as a refusal would close a door that is
    // open, and the learner would have no way to know why.
    for (const body of [null, undefined, 'nope', 42, {}, { external: null }, { external: { apple: 'yes' } }, { external: {} }]) {
      assert.equal(providerEnabled(body, 'apple'), null, `${JSON.stringify(body)} was read as a definite answer`);
    }

    // And over the wire, with the anon key the endpoint answers 401 without.
    let headers: Record<string, string> = {};
    let asked = '';
    assert.equal(
      await appleAvailable('https://p.supabase.co', 'the-anon-key', async (url, init) => {
        asked = String(url);
        headers = (init?.headers ?? {}) as Record<string, string>;
        return settings(false);
      }),
      false,
    );
    assert.equal(asked, 'https://p.supabase.co/auth/v1/settings');
    assert.equal(headers.apikey, 'the-anon-key', 'without an apikey header /auth/v1/settings answers 401');
    assert.equal(await appleAvailable('https://p.supabase.co', 'anon-key', async () => settings(true)), true);
    // A preflight that cannot answer never blocks the attempt.
    assert.equal(
      await appleAvailable('https://p.supabase.co', 'anon-key', async () => {
        throw new TypeError('Failed to fetch');
      }),
      null,
    );
    assert.equal(
      await appleAvailable('https://p.supabase.co', 'anon-key', async () => new Response('', { status: 500 })),
      null,
    );

    // The wiring. The adapter cannot be imported in node, so the order is read,
    // and the order is the whole point: on iOS the sheet is a system modal, and
    // a learner who signs into it only to be told the project has no Apple
    // provider has been made to prove who they are for nothing.
    const adapter = read('supabaseAdapter.ts');
    const method = adapter.slice(adapter.indexOf('signInWithApple('), adapter.indexOf('sendPasswordReset('));
    assert.ok(method.length > 0, 'signInWithApple moved or was renamed; this test is reading nothing');

    const asks = method.indexOf('appleAvailable(url, anonKey)');
    const opens = method.indexOf('startAppleSignIn(client)');
    assert.ok(asks >= 0, 'signInWithApple must check whether the provider is enabled');
    assert.ok(opens > asks, 'the check must happen before the sheet opens, not after');
    assert.match(method, /APPLE_NOT_CONFIGURED/, 'a switched-off provider does not get its own sentence');
    // Only on a hard false. `null` is "could not tell", and a flaky network
    // must never be the reason somebody cannot sign in.
    assert.match(
      method,
      /appleAvailable\(url, anonKey\)\)\s*===\s*false/,
      'the preflight blocks on anything other than a definite no, so an unreachable settings endpoint closes the door',
    );

    // The seam carries the call on every implementation, including the ones
    // that never draw the button. A method only one adapter has is a crash
    // waiting for a config change.
    assert.match(read('types.ts'), /signInWithApple\(\): Promise<AuthResult>/, 'the interface does not declare the Apple method');
    assert.match(read('mockAdapter.ts'), /async signInWithApple\(\)/, 'the mock adapter cannot answer a call the interface declares');
    assert.match(read('mockAdapter.ts'), /apple-dev@luvani\.local/, 'the mock has no stand-in Apple account, so the flow is untestable without keys');
    assert.match(read('apple.ts'), /export async function appleSignInOffered/, 'the web half does not answer whether the door exists');
    assert.match(read('apple.native.ts'), /export async function appleSignInOffered/, 'the native half does not answer whether the door exists');

    // Deleting an Apple account re-proves it the same way it was made.
    const reauth = adapter.slice(adapter.indexOf('async reauthenticateForDeletion('), adapter.indexOf('async deleteAccount('));
    assert.ok(reauth.length > 0, 'reauthenticateForDeletion moved or was renamed; this test is reading nothing');
    assert.match(reauth, /provider === 'apple'/, 'an Apple account is asked for a password it does not have');
    assert.match(reauth, /startAppleSignIn\(client\)/, 'an Apple account is not re-proved through Apple');
  });
});

describe('the Apple door is offered only where it works — F376', () => {
  test('the apple door is drawn above the google one, only when the platform offers it — F376', () => {
    // The label is the shared one, so the words are tested in busyLabel.test.ts
    // and cannot drift between the two screens.
    assert.equal(authButtonLabel('apple', false), 'Continue with Apple');

    for (const where of ['auth/SignInScreen.tsx', 'auth/SignUpScreen.tsx']) {
      const body = readSrc(where);

      // Asked once, on mount, rather than assumed from the platform constant.
      // An iPhone too old for Sign in with Apple answers false, and only the
      // module knows that.
      assert.match(body, /import \{ appleSignInOffered \} from '\.\/apple\.ts';/, `${where} does not ask whether the door exists`);
      assert.match(
        body,
        /useEffect\(\(\) => \{[\s\S]*?appleSignInOffered\(\)/,
        `${where} calls appleSignInOffered outside an effect, so it runs on every render`,
      );
      assert.match(
        body,
        /const \[appleOffered, setAppleOffered\] = useState\(false\)/,
        `${where} starts with the Apple door visible, so it flashes a button that was never there`,
      );

      // Drawn only when the answer is yes.
      const gate = body.indexOf('{appleOffered && (');
      assert.ok(gate >= 0, `${where} draws the Apple door unconditionally, so Android and web offer a button that cannot work`);
      const gated = body.slice(gate, gate + 400);
      assert.match(gated, /<OutlineButton/, `${where} gates something other than the Apple button on appleOffered`);
      assert.match(gated, /authButtonLabel\('apple', pending === 'apple'\)/, `${where}'s gated button is not the Apple one`);
      assert.match(gated, /<AppleMark size=\{18\} \/>/, `${where}'s Apple button carries no mark, or not the shared one`);
      assert.match(gated, /onPress=\{\(\) => void apple\(\)\}/, `${where}'s Apple button does not start the Apple sign-in`);

      // Above the Google outline. Both are in the footer, where a keyboard
      // cannot scroll them out of reach.
      const applePlace = body.indexOf("authButtonLabel('apple'");
      const googlePlace = body.indexOf("authButtonLabel('google'");
      assert.ok(googlePlace >= 0, `${where} lost its Google door`);
      assert.ok(applePlace < googlePlace, `${where} draws the Apple door below the Google one`);
      assert.ok(body.indexOf('footer={') < applePlace, `${where} draws the Apple door outside the footer`);

      // And the handler is a real one: its own pending flag, raised for the
      // whole request, so the button relabels instead of greying in silence.
      const handler = handlerBody(body, 'apple');
      assert.match(
        handler,
        /setPending\('apple'\)[\s\S]*signInWithApple\(\)[\s\S]*setPending\(null\)/,
        `${where} does not run the Apple request inside the flag its button reads`,
      );
      assert.match(handler, /if \(busy\) return;/, `${where} lets a second Apple sheet start while the first is open`);
    }
  });

  test('app.json asks for the Apple capability and its plugin — F376', () => {
    const config = JSON.parse(readFileSync(path.join(MOBILE_DIR, 'app.json'), 'utf8')) as {
      expo: { ios?: { usesAppleSignIn?: boolean }; plugins?: unknown[] };
    };

    // Without the capability the entitlement is never written into the build,
    // and `isAvailableAsync` is true while `signInAsync` fails on device. That
    // is the worst shape this feature has: a door that opens onto nothing.
    assert.equal(
      config.expo.ios?.usesAppleSignIn,
      true,
      'app.json does not ask for the Sign in with Apple capability, so the entitlement is missing from the build',
    );

    const plugins = config.expo.plugins ?? [];
    const names = plugins.map((plugin) => (Array.isArray(plugin) ? String(plugin[0]) : String(plugin)));
    assert.ok(
      names.includes('expo-apple-authentication'),
      `app.json does not register the expo-apple-authentication config plugin. Plugins: ${names.join(', ')}`,
    );
    // The plugins that were already there are still there. A config plugin list
    // is the easiest thing in this repo to shorten by accident.
    for (const required of ['expo-secure-store', 'expo-web-browser', 'expo-font', 'expo-notifications']) {
      assert.ok(names.includes(required), `app.json lost the ${required} plugin`);
    }

    // The dependency the plugin needs, at the version Expo pinned for this SDK.
    const manifest = JSON.parse(readFileSync(path.join(MOBILE_DIR, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    assert.ok(
      manifest.dependencies['expo-apple-authentication'],
      'the plugin is registered and the package is not installed, which fails the build rather than the sign-in',
    );
    assert.ok(
      manifest.dependencies['expo-crypto'],
      'expo-crypto is gone, and it is what hashes the nonce on device',
    );

    // The onboarding doc names the third door, so the written path and the
    // built one cannot drift.
    const onboarding = readFileSync(path.join(MOBILE_DIR, '..', '..', 'docs', 'ONBOARDING.md'), 'utf8');
    assert.match(
      onboarding,
      /Google, or Apple on iOS/,
      'docs/ONBOARDING.md still describes a sign-up screen with two doors on it',
    );
  });

  /**
   * The delete sheet, which is the one place an account's provider changes what
   * a learner is asked for. An Apple account has no password this app could
   * check, so the sheet must say what will happen instead of showing a field
   * that cannot be filled.
   *
   * `settings/SettingsScreen.tsx` is another engineer's file. This test is
   * written against the sentence it owes rather than written after the fact.
   *
   * The sheet moved there whole with F473, when Profile stopped holding the
   * account: sign out, delete, the export and the legal footer are all one
   * pushed screen now. The sentences moved with it verbatim, which is what this
   * test can actually see, so the file it reads is the only thing that changed
   * here. It is checked below that the sheet did not stay behind on Profile as
   * well, because two delete sheets is worse than either one.
   */
  test('the delete sheet tells an apple account what will happen — F376', () => {
    const settings = readSrc('settings/SettingsScreen.tsx');
    const APPLE_LINE = 'Apple will ask you to sign in again before anything is deleted.';
    const GOOGLE_LINE = 'Google will ask you to sign in again before anything is deleted.';

    assert.ok(
      settings.includes(APPLE_LINE),
      `the delete sheet does not say "${APPLE_LINE}", so an Apple account meets a sheet that asks for nothing and then opens a system prompt`,
    );
    assert.ok(settings.includes(GOOGLE_LINE), 'the Google twin of that sentence is gone');
    assert.match(
      settings,
      /provider === 'apple'/,
      'the Apple sentence is not gated on the provider, so a password account is told Apple will ask it something',
    );

    // No password field for an account that has no password. `hasPassword` is
    // the flag that decides it, and it is true only for a password sign-up.
    assert.match(
      settings,
      /const hasPassword = user\?\.provider === 'password'/,
      'the delete sheet decides whether to ask for a password some other way, so an Apple account may be shown a field it cannot fill',
    );

    // One sheet, in one place. A copy left behind on Profile would be a second
    // wording of the most consequential question the app asks, and the one that
    // stopped being edited would be the one somebody read.
    assert.ok(
      !readSrc('tabs/ProfileTab.tsx').includes(APPLE_LINE),
      'the delete sheet is drawn on Profile as well as on Settings, so there are two of it to keep in step',
    );
  });
});
