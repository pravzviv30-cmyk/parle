import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { attempt, guardAdapter, toFailure, GUARDED_METHODS } from './attempt.ts';
import { GENERIC_FAILURE } from './friendly.ts';
import type { AuthAdapter } from './types.ts';

describe('a provider call that throws instead of returning', () => {
  /**
   * F259. The screens await the adapter once and clear `pending` once. If the
   * SDK throws, that await never resolves, the flag is never cleared, and the
   * button reads "Signing in…" for ever. The contract this pins is narrow and
   * total: `attempt` resolves, always.
   */
  test('a provider that throws still leaves the learner a sentence and a working button', async () => {
    const result = await attempt(async () => {
      throw new TypeError('Failed to fetch');
    });

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.message, 'The connection dropped. Check your internet and try again.');
  });

  test('a thrown auth error keeps the code that names it', async () => {
    const result = await attempt(async () => {
      throw Object.assign(new Error('Invalid login credentials'), { code: 'invalid_credentials' });
    });

    assert.equal(result.ok === false && result.message, 'That email and password do not match an account.');
  });

  test('a thrown weak-password error keeps the reason that says which rule broke', async () => {
    const result = await attempt(async () => {
      throw Object.assign(new Error('weak'), { code: 'weak_password', reasons: ['characters'] });
    });

    assert.equal(
      result.ok === false && result.message,
      'That password needs a wider mix. Try adding capital letters, numbers or symbols.',
    );
  });

  test('a value with nothing to say becomes the generic sentence, never [object Object]', async () => {
    for (const thrown of [null, undefined, 42, {}, Symbol('x')]) {
      const result = await attempt(async () => {
        throw thrown;
      });
      assert.equal(result.ok === false && result.message, GENERIC_FAILURE);
    }
  });

  test('a call that succeeds is passed through untouched', async () => {
    assert.deepEqual(await attempt(async () => ({ ok: true, message: 'kept' })), { ok: true, message: 'kept' });
  });

  test('a failure the provider returned rather than threw is left exactly as it was', async () => {
    const returned = { ok: false as const, message: 'already translated' };
    assert.deepEqual(await attempt(async () => returned), returned);
  });

  test('a thrown string is read rather than discarded', () => {
    assert.deepEqual(toFailure('Invalid login credentials'), { message: 'Invalid login credentials' });
  });
});

describe('every result-returning method is guarded', () => {
  /**
   * The adapter itself cannot be imported here — it pulls in react-native,
   * SecureStore and the Supabase SDK — so the guarantee is held at the interface
   * instead, which is the thing that actually defines the surface. Add an eighth
   * method returning `Promise<AuthResult>` and forget to guard it, and this
   * fails. That is the exact mistake F259 was.
   */
  test('the guarded list is every AuthResult method the interface declares', () => {
    const source = readFileSync(new URL('./types.ts', import.meta.url), 'utf8');
    const body = source.slice(source.indexOf('interface AuthAdapter'));
    const declared = [...body.matchAll(/^\s{2}(\w+)\??\(.*\)\s*:\s*Promise<AuthResult>/gm)].map((m) => m[1]);

    assert.ok(declared.length >= 7, `expected to find the AuthResult methods, found ${declared.length}`);
    assert.deepEqual([...GUARDED_METHODS].sort(), declared.sort());
  });

  test('a guarded adapter turns a throwing method into a sentence', async () => {
    const base = {
      kind: 'supabase',
      async signInWithPassword() {
        throw new TypeError('Failed to fetch');
      },
      async signOut() {},
    } as unknown as AuthAdapter;

    const result = await guardAdapter(base).signInWithPassword('a@b.co', 'pw');
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.message, 'The connection dropped. Check your internet and try again.');
  });

  test('a method the adapter does not have is not invented by guarding it', () => {
    const base = { kind: 'mock', async signOut() {} } as unknown as AuthAdapter;
    assert.equal(guardAdapter(base).completePasswordReset, undefined);
  });

  test('methods that do not return a result are passed through untouched', async () => {
    let signedOut = false;
    const base = {
      kind: 'mock',
      async signOut() {
        signedOut = true;
      },
      async getAccessToken() {
        return 'token';
      },
    } as unknown as AuthAdapter;

    const guarded = guardAdapter(base);
    await guarded.signOut();
    assert.equal(signedOut, true);
    assert.equal(await guarded.getAccessToken(), 'token');
  });
});

describe('the guard is actually applied', () => {
  /**
   * `guardAdapter` being correct is worth nothing if nobody calls it. The
   * adapter module cannot be imported in node, so this reads it — the one fact
   * that matters is that the exported `auth` is the guarded value and not the
   * raw `build()`.
   */
  test('the adapter every screen uses is the guarded one', () => {
    const source = readFileSync(new URL('./adapter.ts', import.meta.url), 'utf8');
    assert.match(source, /export const auth: AuthAdapter = guardAdapter\(build\(\)\);/);
  });
});
