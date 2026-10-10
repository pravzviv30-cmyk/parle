import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { NATIVE_AUTH_CALLBACK, readOAuthCallback, securePkceUrl } from './oauthCallback.ts';

test('only the registered OAuth callback can supply a code; malformed or error callbacks never exchange one', () => {
  assert.deepEqual(readOAuthCallback(`${NATIVE_AUTH_CALLBACK}?code=abc%2D123`, NATIVE_AUTH_CALLBACK), {code:'abc-123',error:null});
  assert.deepEqual(readOAuthCallback('http://localhost:3000/?code=abc', NATIVE_AUTH_CALLBACK), {code:null,error:'callback_mismatch'});
  assert.deepEqual(readOAuthCallback(`${NATIVE_AUTH_CALLBACK}/other?code=abc`, NATIVE_AUTH_CALLBACK), {code:null,error:'callback_mismatch'});
  assert.deepEqual(readOAuthCallback(`${NATIVE_AUTH_CALLBACK}?code=%ZZ`, NATIVE_AUTH_CALLBACK), {code:null,error:'missing_code'});
  assert.deepEqual(readOAuthCallback(`${NATIVE_AUTH_CALLBACK}#code=abc`, NATIVE_AUTH_CALLBACK), {code:null,error:'missing_code'});
  assert.deepEqual(readOAuthCallback(`${NATIVE_AUTH_CALLBACK}?error=access_denied&error_description=private&code=abc`, NATIVE_AUTH_CALLBACK), {code:null,error:'access_denied'});
});

test('native PKCE upgrades a plain challenge to the RFC S256 digest without changing the redirect or verifier storage', async () => {
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const original = `https://example.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(NATIVE_AUTH_CALLBACK)}&code_challenge=${verifier}&code_challenge_method=plain`;
  const hardened = await securePkceUrl(original, async (value) => createHash('sha256').update(value).digest('base64'));
  const url = new URL(hardened);
  assert.equal(url.searchParams.get('code_challenge'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  assert.equal(url.searchParams.get('code_challenge_method'), 's256');
  assert.equal(url.searchParams.get('redirect_to'), NATIVE_AUTH_CALLBACK);
  assert.equal(url.searchParams.get('provider'), 'google');
  assert.equal(await securePkceUrl(hardened, async () => { throw new Error('must not rehash S256'); }), hardened);
  await assert.rejects(securePkceUrl('https://example.supabase.co/auth/v1/authorize?provider=google', async () => 'digest'), /Missing PKCE/);
});
