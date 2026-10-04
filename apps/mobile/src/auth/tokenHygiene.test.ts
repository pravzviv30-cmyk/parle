/**
 * A lexical walk of the auth layer, not a runtime proof.
 *
 * F71 splits in two, and the split is the honest part. Keychain and Keystore
 * persistence, the plaintext-session migration on real hardware, a failed
 * secure write forcing a safe sign-in, and reauthentication before deletion all
 * need a build on a device; no representative iOS or Android build exists on
 * this machine. That half is `docs/DEVICE_VERIFICATION.md` — a runbook, written
 * to be run, and honest about not having been.
 *
 * This is the half that is provable here today. It reads every source file in
 * `apps/mobile/src/auth/` as text and holds three shapes:
 *
 *   1. Nothing in this layer logs a value. A plain string literal is allowed;
 *      an interpolation or a variable is not, because `console.log('session',
 *      session)` added during a debugging afternoon is exactly how a bearer
 *      token reaches a device log that survives the session.
 *   2. The only persistence a bearer token has is device-only encrypted
 *      storage. AsyncStorage is plaintext: on the Supabase path it is the
 *      migration source and nothing else, and `secureSessionStorage` never
 *      writes back into it.
 *   3. A bearer leaves this layer in an `authorization` header, never in a URL,
 *      which is where tokens end up in proxy logs and browser history.
 *
 * What it cannot see, and so does not claim: what the Supabase SDK does with
 * the value after we hand it over, anything inside a native module, and any log
 * written by a dependency. Those are the device runbook's job, not this file's.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

const AUTH_DIR = import.meta.dirname;
const REPO_ROOT = path.resolve(AUTH_DIR, '..', '..', '..', '..');

/**
 * Comments blanked out, so prose about `localStorage` is never mistaken for a
 * call to it. Deliberately simple: block comments go first, then a line comment
 * only when the `//` is not part of a `://` scheme. The auth layer is small
 * enough that a real parser would be a heavier dependency than the risk.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/(^|[^:"'`\\])\/\/.*$/, '$1'))
    .join('\n');
}

/**
 * The argument text of a call, given the index of its opening paren. Quotes are
 * tracked so a paren inside a string does not close the call early. Safe to run
 * from inside a call expression, which is why it is never pointed at JSX prose:
 * `tutor's memory` in a screen is an apostrophe, not a string.
 */
function callArguments(source: string, open: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < source.length; i += 1) {
    const c = source[i];
    if (quote !== null) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      continue;
    }
    if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return source.slice(open + 1);
}

/** Every logging call in a file, as `{ line, args }`. */
function loggingCalls(source: string): { line: number; args: string }[] {
  const calls: { line: number; args: string }[] = [];
  const pattern = /\bconsole\s*\.\s*\w+\s*\(/g;
  for (const match of source.matchAll(pattern)) {
    const open = match.index + match[0].length - 1;
    calls.push({ line: source.slice(0, match.index).split('\n').length, args: callArguments(source, open) });
  }
  return calls;
}

/** True when every argument is a literal string with nothing interpolated into it. */
function literalOnly(args: string): boolean {
  const withoutStrings = args
    .replace(/'(?:[^'\\]|\\.)*'/g, '')
    .replace(/"(?:[^"\\]|\\.)*"/g, '')
    .replace(/`(?:[^`\\$]|\\.|\$(?!\{))*`/g, '');
  return /^[\s,]*$/.test(withoutStrings);
}

interface Source {
  name: string;
  raw: string;
  code: string;
}

function authSources(): Source[] {
  return readdirSync(AUTH_DIR)
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .sort()
    .map((name) => {
      const raw = readFileSync(path.join(AUTH_DIR, name), 'utf8');
      return { name, raw, code: withoutComments(raw) };
    });
}

const sources = authSources();
const byName = (name: string): Source => {
  const found = sources.find((s) => s.name === name);
  assert.ok(found, `${name} has left apps/mobile/src/auth/ — this walk names it, so it cannot silently stop covering it`);
  return found;
};

/** AsyncStorage is plaintext. These two are the only files allowed to write to it. */
const PLAINTEXT_WRITERS = new Set(['installation.ts', 'mockAdapter.ts', 'installHistory.ts', 'installHistory.native.ts']);

describe('auth token hygiene — what a static walk can prove without a device', () => {
  test('the walk actually covers the auth layer', () => {
    // A walk that matches nothing passes everything. This is the tripwire for a
    // renamed directory or a filter that quietly stops matching .tsx.
    for (const required of [
      'adapter.ts',
      // Both halves of the Apple split, named for the same reason as the Google
      // pair: they hold an identity token, a nonce and an email address, and a
      // file that quietly stopped being walked is a file that can start logging.
      'apple.native.ts',
      'apple.ts',
      'authMode.ts',
      'installation.ts',
      'mockAdapter.ts',
      'oauth.native.ts',
      'oauth.ts',
      'secureSessionStorage.ts',
      'supabaseAdapter.ts',
      'types.ts',
      'useAuth.tsx',
      'SignInScreen.tsx',
      'SignUpScreen.tsx',
    ]) {
      assert.ok(sources.some((s) => s.name === required), `${required} was not read, so nothing below says anything about it`);
    }
    assert.ok(sources.length >= 17, `only ${sources.length} auth sources were read; the layer has more than that`);
  });

  test('no bearer token is written to logs or plain storage by the auth layer', () => {
    // --- logs -------------------------------------------------------------
    // A device log outlives the session that wrote it, is readable over USB on
    // both platforms, and on Android is readable by adb without a jailbreak.
    // The rule is not "do not log secrets" — nobody ever thinks they are — it
    // is "do not log values". A fixed sentence is fine; anything with a value
    // in it is not.
    for (const { name, code } of sources) {
      for (const { line, args } of loggingCalls(code)) {
        assert.ok(
          literalOnly(args),
          `${name}:${line} logs a value. The auth layer may log a fixed sentence and nothing else: ` +
            'the session, the result, the callback URL and the form state all carry a bearer token, a code or an email.',
        );
      }
    }

    for (const name of ['installHistory.ts', 'installHistory.native.ts']) {
      assert.match(byName(name).code, /AsyncStorage\.setItem\([^,]+, 'yes'\)/);
      assert.doesNotMatch(byName(name).code, /SupabaseClient|getAccessToken|authorization|identityToken/);
    }

    // --- plain storage ----------------------------------------------------
    // AsyncStorage is unencrypted on both platforms: a SQLite file on Android
    // and a plist-backed manifest on iOS, both readable from a device backup.
    for (const { name, code } of sources) {
      if (/\bAsyncStorage\s*\.\s*setItem\s*\(/.test(code) || /\bAsyncStorage\s*\.\s*multiSet\s*\(/.test(code)) {
        assert.ok(
          PLAINTEXT_WRITERS.has(name),
          `${name} writes to AsyncStorage, which is plaintext. Only ${[...PLAINTEXT_WRITERS].join(' and ')} may, ` +
            'and only because neither of them ever holds a bearer token.',
        );
      }
      for (const sink of [/\blocalStorage\s*\./, /\bsessionStorage\s*\./, /\bdocument\s*\.\s*cookie/]) {
        assert.doesNotMatch(
          code,
          sink,
          `${name} reaches for browser storage directly. Web session persistence is the Supabase SDK's own; ` +
            'a second copy written by hand is a plaintext copy nothing in this repo would ever clear.',
        );
      }
      assert.doesNotMatch(
        code,
        /from\s+'expo-file-system'/,
        `${name} imports the filesystem. A session written to a file is a session outside the keychain.`,
      );
    }

    // The Supabase adapter imports AsyncStorage and must use it for exactly one
    // thing: the `legacy` argument of createSecureSessionStorage, the migration
    // source. Any direct call would be a plaintext read or write of a session.
    const supabase = byName('supabaseAdapter.ts');
    assert.doesNotMatch(
      supabase.code,
      /\bAsyncStorage\s*\./,
      'supabaseAdapter.ts must hand AsyncStorage to createSecureSessionStorage as the migration source and never touch it itself',
    );
    assert.match(
      supabase.code,
      /createSecureSessionStorage\(/,
      'the native session store is the chunked SecureStore wrapper, not whatever the SDK would default to',
    );
    assert.match(
      supabase.code,
      /storage:\s*nativeSessionStorage/,
      'the client must be handed the encrypted storage on native, or the session lands in AsyncStorage in plaintext',
    );
    assert.match(
      supabase.code,
      /SecureStore\.setItemAsync\(/,
      'the encrypted half of that wrapper has to be SecureStore itself',
    );
    assert.match(
      supabase.code,
      /keychainAccessible:\s*SecureStore\.WHEN_UNLOCKED_THIS_DEVICE_ONLY/,
      'without THIS_DEVICE_ONLY the session travels in an encrypted device backup and can be restored onto another phone',
    );

    // The migration is one-way by construction. If secureSessionStorage ever
    // writes to `legacy`, the plaintext copy it exists to retire comes back.
    const secure = byName('secureSessionStorage.ts');
    assert.doesNotMatch(
      secure.code,
      /\blegacy\s*\.\s*setItem\s*\(/,
      'secureSessionStorage may read the legacy plaintext session and remove it, never write one',
    );
    assert.match(
      secure.code,
      /\blegacy\s*\.\s*removeItem\s*\(/,
      'and it has to remove it, including when the encrypted write failed — a bearer must not stay readable as a fallback',
    );

    // The two files that do write plaintext are allowed to because neither can
    // hold a bearer. Both halves of that argument are pinned here, because the
    // day one of them stops being true this test would otherwise stay green.
    const mock = byName('mockAdapter.ts');
    assert.match(
      mock.code,
      /async getAccessToken\(\)\s*\{\s*return null;\s*\}/,
      'the mock adapter writes accounts to plaintext storage and is only safe because it has no bearer token to write',
    );
    const installation = byName('installation.ts');
    assert.match(
      installation.code,
      /const created = Crypto\.randomUUID\(\)/,
      'the installation signal must be a random value',
    );
    assert.match(
      installation.code,
      /AsyncStorage\.setItem\(KEY, created\)/,
      'and that random value is the only thing installation.ts is allowed to persist',
    );
  });

  test('a bearer token leaves the auth layer only in an authorization header', () => {
    // A token in a query string is a token in a proxy log, a referrer header
    // and browser history. Header or nothing.
    let bearers = 0;
    for (const { name, code } of sources) {
      for (const match of code.matchAll(/Bearer\s/g)) {
        bearers += 1;
        const context = code.slice(Math.max(0, match.index - 80), match.index);
        assert.match(
          context,
          /authorization/i,
          `${name} builds a Bearer value somewhere that is not an authorization header`,
        );
      }
      assert.doesNotMatch(
        code,
        /[?&](access_token|refresh_token|token|jwt)=/,
        `${name} puts a token in a URL, where it is logged by every hop between here and the server`,
      );
    }
    assert.ok(bearers >= 2, `only ${bearers} Bearer headers were found; the adapter and the delete call both build one`);
  });

  test('the device runbook names auth functions that still exist', () => {
    // The runbook is the other half of F71, and the way a runbook dies is by
    // quietly becoming generic: the code is renamed, the steps still read
    // plausibly, and the tester follows instructions for a function that is no
    // longer there. Every symbol it leans on is held against the source here.
    const runbook = readFileSync(path.join(REPO_ROOT, 'docs', 'DEVICE_VERIFICATION.md'), 'utf8');

    for (const heading of [
      '## What a device proves that this machine cannot',
      '## Before you start',
      '## The matrix',
      '## iOS',
      '## Android',
      '## Recording the result',
      '## What this runbook cannot prove',
    ]) {
      assert.ok(runbook.includes(heading), `the runbook lost its "${heading}" section`);
    }

    const anchors: [symbol: string, file: string][] = [
      ['createSecureSessionStorage', path.join(AUTH_DIR, 'secureSessionStorage.ts')],
      ['luvani-secure-meta', path.join(AUTH_DIR, 'secureSessionStorage.ts')],
      ['WHEN_UNLOCKED_THIS_DEVICE_ONLY', path.join(AUTH_DIR, 'supabaseAdapter.ts')],
      ['reauthenticateForDeletion', path.join(AUTH_DIR, 'types.ts')],
      ['deleteAccount', path.join(AUTH_DIR, 'types.ts')],
      ['getAccessToken', path.join(AUTH_DIR, 'types.ts')],
      ['selectAuthMode', path.join(AUTH_DIR, 'authMode.ts')],
      ['startGoogleSignIn', path.join(AUTH_DIR, 'oauth.native.ts')],
      ['exchangeCodeForSession', path.join(AUTH_DIR, 'oauth.native.ts')],
      ['installationId', path.join(AUTH_DIR, 'installation.ts')],
      ['clearActiveUserData', path.resolve(AUTH_DIR, '..', 'storage', 'scope.ts')],
      ['userKey', path.resolve(AUTH_DIR, '..', 'storage', 'scope.ts')],
      ['signedInRecently', path.join(REPO_ROOT, 'services', 'token-server', 'src', 'accountDeletion.ts')],
    ];

    for (const [symbol, file] of anchors) {
      assert.ok(runbook.includes(symbol), `the runbook must name ${symbol}; a step that names no function is generic advice`);
      assert.ok(
        readFileSync(file, 'utf8').includes(symbol),
        `the runbook names ${symbol} but ${path.relative(REPO_ROOT, file)} no longer defines it — the steps are now fiction`,
      );
    }

    // The one sentence that stops a written runbook from being read as a
    // finished run. F71 closes when a device pass is recorded, not when this
    // file exists.
    assert.match(
      runbook,
      /not run/i,
      'the runbook must say plainly that it has not been executed, or its existence will be mistaken for its result',
    );
  });
});
