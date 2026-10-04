import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from 'jose';
import { createUserResolver } from './auth.ts';
import { liveIdentityVerifier } from './identity.ts';

const userId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
const issuer = 'https://project.supabase.co/auth/v1';
const keys = await generateKeyPair('ES256');
function resolver(check: ((user: string, session: string) => Promise<boolean>) | undefined = async () => true) {
  return createUserResolver({ nodeEnv: 'production', supabaseUrl: 'https://project.supabase.co' }, {
    getKey: async () => keys.publicKey, ...(check ? { isIdentityActive: check } : {}),
  });
}
async function token(overrides: Record<string, unknown> = {}, omit: string[] = []) {
  const now = Math.floor(Date.now() / 1000);
  const claims: Record<string, unknown> = { sub: userId, iss: issuer, aud: 'authenticated', iat: now, exp: now + 3600, role: 'authenticated', session_id: sessionId, ...overrides };
  for (const name of omit) delete claims[name];
  return new SignJWT(claims).setProtectedHeader({ alg: 'ES256' }).sign(keys.privateKey);
}
test('production binds the signature to project issuer, user audience and complete session claims', async () => {
  let checks = 0;
  const auth = resolver(async (user, session) => { checks++; assert.equal(user, userId); assert.equal(session, sessionId); return true; });
  assert.deepEqual(await auth.resolve(`Bearer ${await token()}`, 'forged'), { ok: true, userId, authSessionId: sessionId });
  for (const claims of [
    { iss: 'https://stranger.supabase.co/auth/v1' }, { aud: 'service_role' }, { role: 'service_role' },
    { sub: 'not-a-user-uuid' }, { session_id: 'not-a-session' }, { is_anonymous: true },
    { iat: Math.floor(Date.now() / 1000) + 3600 }, { exp: 0 },
  ]) assert.equal((await auth.resolve(`Bearer ${await token(claims)}`, null)).ok, false);
  for (const name of ['exp', 'iat', 'iss', 'aud', 'role', 'session_id', 'sub']) {
    assert.equal((await auth.resolve(`Bearer ${await token({}, [name])}`, null)).ok, false, name);
  }
  assert.equal(checks, 1, 'invalid JWT never reaches the database');
});
test('valid signed credentials cannot outlive sign-out, deletion or a missing identity service', async () => {
  const bearer = `Bearer ${await token()}`;
  const revoked = await resolver(async () => false).resolve(bearer, null);
  assert.deepEqual(revoked, { ok: false, status: 401, message: 'Sign in to use this.' });
  const unavailable = await resolver(async () => { throw new Error('private provider detail'); }).resolve(bearer, null);
  assert.equal(unavailable.ok, false);
  if (!unavailable.ok) { assert.equal(unavailable.status, 503); assert.ok(!unavailable.message.includes('private')); }
  const missing = createUserResolver({ nodeEnv: 'production', supabaseUrl: 'https://project.supabase.co' }, { getKey: async () => keys.publicKey });
  assert.equal((await missing.resolve(bearer, null) as { status: number }).status, 503);
  assert.equal((await createUserResolver({ nodeEnv: 'production', jwtSecret: 'test-secret' }).resolve(bearer, null)).ok, false);
});
test('live identity response is strictly boolean and bounded, with a cancellable deadline', async () => {
  const make = (body: string, status = 200) => liveIdentityVerifier('https://project.supabase.co/', 'example-test-service-key', (async (url, init) => {
    assert.equal(url, 'https://project.supabase.co/rest/v1/rpc/active_tutor_identity_v1');
    assert.deepEqual(JSON.parse(init!.body as string), { p_user_id: userId, p_auth_session_id: sessionId });
    assert.ok(init!.signal instanceof AbortSignal);
    return new Response(body, { status });
  }) as typeof fetch);
  assert.equal(await make('true')(userId, sessionId), true);
  assert.equal(await make('false')(userId, sessionId), false);
  for (const body of ['{}', '"true"', 'true'.repeat(30)]) await assert.rejects(make(body)(userId, sessionId));
  await assert.rejects(make('private error', 503)(userId, sessionId));
});
