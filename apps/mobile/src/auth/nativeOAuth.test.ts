import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { APPLE_CLOSED, APPLE_START_FAILED, GOOGLE_START_FAILED, friendly } from './friendly.ts';
import { makeNonce } from './appleNonce.ts';
import { NATIVE_AUTH_CALLBACK, readOAuthCallback, securePkceUrl } from './oauthCallback.ts';

// Run the native module with the system browser replaced, without importing
// React Native into Node. The sign-in and PKCE storage belong to the real SDK.
const source = readFileSync(new URL('oauth.native.ts', import.meta.url), 'utf8');
const nativeModule = stripTypeScriptTypes(source.replace(/^import .*;\n/gm, '').replace(/^export /gm, ''));
function browserSignIn(browser: { openAuthSessionAsync: (url: string, redirect: string) => Promise<unknown> }) {
  const bindings = {
    WebBrowser: { ...browser, maybeCompleteAuthSession() {} },
    Crypto: { CryptoDigestAlgorithm: { SHA256: 'SHA256' }, CryptoEncoding: { BASE64: 'base64' },
      digestStringAsync: async (_algorithm: string, value: string) => createHash('sha256').update(value).digest('base64') },
    APPLE_START_FAILED, GOOGLE_START_FAILED, friendly, NATIVE_AUTH_CALLBACK, readOAuthCallback, securePkceUrl,
  };
  return new Function(...Object.keys(bindings), nativeModule + '\nreturn startBrowserSignIn;')(...Object.values(bindings));
}

test('Google on a Hermes-style runtime exchanges the callback with the SDK-stored verifier and flow ID', async () => {
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  // Expo installs random values on Hermes; SHA-256 is supplied by expo-crypto.
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) } });
  const storage = new Map<string, string>();
  const exchanges: Record<string, unknown>[] = [];
  let challenge = '';
  const client = createClient('https://example.supabase.co', 'public-test-key', {
    auth: { flowType: 'pkce', detectSessionInUrl: false, autoRefreshToken: false, persistSession: true,
      storage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); }, removeItem: (key) => { storage.delete(key); } } },
    global: { fetch: async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      exchanges.push(body);
      assert.equal(body.auth_code, 'test-code');
      assert.equal(createHash('sha256').update(String(body.code_verifier)).digest('base64url'), challenge);
      return new Response(JSON.stringify({ access_token: 'test-access-token', refresh_token: 'test-refresh-token', token_type: 'bearer', expires_in: 3600,
        user: { id: 'test-user', app_metadata: { provider: 'google' }, user_metadata: {}, aud: 'authenticated', created_at: '2026-10-10T00:00:00Z' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const exchange = client.auth.exchangeCodeForSession.bind(client.auth);
  client.auth.exchangeCodeForSession = async (code, options) => {
    assert.equal(typeof options?.flowId, 'string');
    return exchange(code, options);
  };
  try {
    const signIn = browserSignIn({ openAuthSessionAsync: async (url, redirect) => {
      const authorization = new URL(url);
      assert.equal(redirect, NATIVE_AUTH_CALLBACK);
      assert.equal(authorization.searchParams.get('redirect_to'), NATIVE_AUTH_CALLBACK);
      assert.equal(authorization.searchParams.get('code_challenge_method'), 's256');
      challenge = authorization.searchParams.get('code_challenge')!;
      assert.ok(challenge);
      return { type: 'success', url: `${NATIVE_AUTH_CALLBACK}?code=test-code` };
    } });
    assert.deepEqual(await signIn(client, 'google'), { ok: true });
    assert.equal(exchanges.length, 1);
    assert.equal((await client.auth.getSession()).data.session?.user.id, 'test-user');
  } finally {
    await client.auth.signOut({ scope: 'local' });
    if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
    else Reflect.deleteProperty(globalThis, 'crypto');
  }
});

test('dismissed, denied, malformed and wrong-destination callbacks never exchange a code', async () => {
  for (const result of [
    { type: 'cancel' }, { type: 'dismiss' },
    { type: 'success', url: `${NATIVE_AUTH_CALLBACK}#error=access_denied&code=untrusted` },
    { type: 'success', url: `${NATIVE_AUTH_CALLBACK}?code=%ZZ` },
    { type: 'success', url: 'https://example.com/?code=untrusted' },
  ]) {
    let exchanges = 0;
    const client = { auth: {
      signInWithOAuth: async () => ({ data: { url: 'https://example.supabase.co/auth/v1/authorize?code_challenge=verified&code_challenge_method=s256' }, error: null }),
      exchangeCodeForSession: async () => { exchanges++; return { error: null }; },
    } };
    const signIn = browserSignIn({ openAuthSessionAsync: async () => result });
    assert.equal((await signIn(client, 'google')).ok, false);
    assert.equal(exchanges, 0);
  }
});

test('a failed code exchange remains signed out and offers another attempt', async () => {
  const client = { auth: {
    signInWithOAuth: async () => ({ data: { url: 'https://example.supabase.co/auth/v1/authorize?code_challenge=verified&code_challenge_method=s256', flowId: 'test-flow' }, error: null }),
    exchangeCodeForSession: async () => ({ error: new Error('expired') }),
  } };
  const signIn = browserSignIn({ openAuthSessionAsync: async () => ({ type: 'success', url: `${NATIVE_AUTH_CALLBACK}?code=test-code` }) });
  assert.deepEqual(await signIn(client, 'google'), { ok: false, message: 'The sign-in code did not check out. Try again.' });
});

const appleSource = stripTypeScriptTypes(readFileSync(new URL('apple.native.ts', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replace(/^export /gm, ''));
function appleSignIn(sheet: (options: { nonce: string; requestedScopes: number[] }) => Promise<unknown>) {
  const bindings = {
    Platform: { OS: 'ios' },
    AppleAuthentication: { AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 }, signInAsync: sheet },
    Crypto: { CryptoDigestAlgorithm: { SHA256: 'SHA256' }, getRandomBytesAsync: async () => new Uint8Array(32).fill(7),
      digestStringAsync: async (_algorithm: string, value: string) => createHash('sha256').update(value).digest('hex') },
    friendly, APPLE_CLOSED, APPLE_START_FAILED, makeNonce,
    startBrowserSignIn: () => { throw new Error('iOS must use the system sheet'); },
  };
  return new Function(...Object.keys(bindings), appleSource + '\nreturn startAppleSignIn;')(...Object.values(bindings));
}

test('Apple on iOS gives the sheet a hashed nonce and exchanges its token with the original nonce', async () => {
  const rawNonce = '07'.repeat(32);
  let exchanges = 0;
  const client = { auth: { signInWithIdToken: async (request: Record<string, unknown>) => {
    exchanges++;
    assert.deepEqual(request, { provider: 'apple', token: 'apple-test-token', nonce: rawNonce });
    return { error: null };
  } } };
  const signIn = appleSignIn(async (request) => {
    assert.equal(request.nonce, createHash('sha256').update(rawNonce).digest('hex'));
    assert.deepEqual(request.requestedScopes, [0, 1]);
    // Apple may omit email and name after the first sign-in.
    return { identityToken: 'apple-test-token', email: null, fullName: null };
  });
  assert.deepEqual(await signIn(client), { ok: true });
  assert.equal(exchanges, 1);
});

test('Apple cancellation or a missing identity token never establishes a session', async () => {
  let exchanges = 0;
  const client = { auth: { signInWithIdToken: async () => { exchanges++; return { error: null }; } } };
  assert.deepEqual(await appleSignIn(async () => { throw { code: 'ERR_REQUEST_CANCELED' }; })(client), { ok: false, message: APPLE_CLOSED });
  assert.deepEqual(await appleSignIn(async () => ({ identityToken: null }))(client), { ok: false, message: APPLE_START_FAILED });
  assert.equal(exchanges, 0);
});
