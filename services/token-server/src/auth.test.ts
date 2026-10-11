import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { SignJWT, generateKeyPair, exportJWK, importJWK, type JWTVerifyGetKey } from 'jose';

import { createUserResolver } from './auth.ts';

const SECRET = 'a-test-secret-long-enough-to-not-embarrass-hs256';

async function hs256Token(sub: string, expiresIn = '1h'): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(SECRET));
}

describe('asserted identity is an explicit local-development exception', () => {
  const resolver = createUserResolver({ nodeEnv: 'development', localDevelopment: '1' });

  test('the asserted id passes straight through', async () => {
    assert.equal(resolver.configured, false);
    assert.deepEqual(await resolver.resolve(undefined, 'learner-1'), { ok: true, userId: 'learner-1' });
  });

  test('no asserted id is the same 400 it always was', async () => {
    const result = await resolver.resolve(undefined, null);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 400);
  });

  test('a bearer that cannot be verified never downgrades to the asserted id', async () => {
    const result = await resolver.resolve('Bearer whatever', 'learner-1');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });

  test('missing or misspelled local opt-in fails closed', async () => {
    for (const candidate of [
      createUserResolver({ nodeEnv: 'development' }),
      createUserResolver({ nodeEnv: 'development', localDevelopment: 'true' }),
      createUserResolver({ nodeEnv: 'test', localDevelopment: '0' }),
    ]) {
      const result = await candidate.resolve(undefined, 'forged-user');
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.status, 401);
    }
  });

  test('production ignores the local flag and still refuses asserted identity', async () => {
    const production = createUserResolver({ nodeEnv: 'production', localDevelopment: '1' });
    const result = await production.resolve(undefined, 'forged-user');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });
});

describe('configured with the shared secret (HS256)', () => {
  const resolver = createUserResolver({ jwtSecret: SECRET });

  test('a valid token resolves its sub and the asserted id is ignored', async () => {
    const token = await hs256Token('real-user');
    const result = await resolver.resolve(`Bearer ${token}`, 'forged-user');
    assert.deepEqual(result, { ok: true, userId: 'real-user' });
  });

  test('a missing header is a 401, whatever the body asserts', async () => {
    const result = await resolver.resolve(undefined, 'forged-user');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });

  test('an expired token is a 401', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('real-user')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(SECRET));
    const result = await resolver.resolve(`Bearer ${token}`, null);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });

  test('garbage is a 401, not a crash', async () => {
    const result = await resolver.resolve('Bearer not.a.token', null);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });

  test('a token without a sub is a 401', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SECRET));
    const result = await resolver.resolve(`Bearer ${token}`, null);
    assert.equal(result.ok, false);
  });

  test('lowercase bearer works — proxies rewrite casing', async () => {
    const token = await hs256Token('real-user');
    assert.deepEqual(await resolver.resolve(`bearer ${token}`, null), { ok: true, userId: 'real-user' });
  });
});

describe('configured with a JWKS (asymmetric, the new Supabase default)', () => {
  test('a token signed by the project key resolves; a stranger key is refused', async () => {
    const project = await generateKeyPair('ES256');
    const stranger = await generateKeyPair('ES256');
    // The injected getKey stands in for the remote JWKS — no network in tests.
    const getKey: JWTVerifyGetKey = async () => {
      const jwk = await exportJWK(project.publicKey);
      return (await importJWK(jwk, 'ES256')) as CryptoKey;
    };
    const resolver = createUserResolver({}, { getKey });
    assert.equal(resolver.configured, true);

    const good = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256' })
      .setSubject('jwks-user')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(project.privateKey);
    assert.deepEqual(await resolver.resolve(`Bearer ${good}`, 'forged'), { ok: true, userId: 'jwks-user' });

    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256' })
      .setSubject('jwks-user')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(stranger.privateKey);
    const result = await resolver.resolve(`Bearer ${forged}`, null);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });

  test('a project URL keeps verification on JWKS even when a legacy secret is also present', async () => {
    const project = await generateKeyPair('ES256');
    const getKey: JWTVerifyGetKey = async () => project.publicKey;
    const resolver = createUserResolver(
      { supabaseUrl: 'https://project.supabase.co', jwtSecret: SECRET },
      { getKey },
    );
    const hsToken = await hs256Token('legacy-user');
    const result = await resolver.resolve(`Bearer ${hsToken}`, null);
    assert.equal(result.ok, false, 'HS256 must not downgrade a configured asymmetric project');
  });

  test('explicit local development accepts the mock app without removing Supabase from .env', async () => {
    const project = await generateKeyPair('ES256');
    const resolver = createUserResolver(
      {
        supabaseUrl: 'https://project.supabase.co',
        nodeEnv: 'development',
        localDevelopment: '1',
      },
      { getKey: async () => project.publicKey },
    );

    assert.equal(resolver.configured, true, 'Supabase remains configured for requests that carry a bearer');
    assert.deepEqual(await resolver.resolve(undefined, 'mock-google-dev'), { ok: true, userId: 'mock-google-dev' });
  });

  test('a bearer still wins in local mode, and an invalid one cannot fall back to mock identity', async () => {
    const project = await generateKeyPair('ES256');
    const stranger = await generateKeyPair('ES256');
    const resolver = createUserResolver(
      {
        supabaseUrl: 'https://project.supabase.co',
        nodeEnv: 'development',
        localDevelopment: '1',
      },
      { getKey: async () => project.publicKey },
    );
    const verified = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256' })
      .setSubject('verified-user')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(project.privateKey);
    assert.deepEqual(await resolver.resolve(`Bearer ${verified}`, 'mock-google-dev'), { ok: true, userId: 'verified-user' });

    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256' })
      .setSubject('forged-user')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(stranger.privateKey);
    const result = await resolver.resolve(`Bearer ${forged}`, 'mock-google-dev');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });

  test('production with the local flag still requires the verified bearer', async () => {
    const project = await generateKeyPair('ES256');
    const resolver = createUserResolver(
      {
        supabaseUrl: 'https://project.supabase.co',
        nodeEnv: 'production',
        localDevelopment: '1',
      },
      { getKey: async () => project.publicKey },
    );
    const result = await resolver.resolve(undefined, 'mock-google-dev');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });
});


test('the recent-authentication proof comes only from the verified bearer session', async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ role: 'authenticated', session_id: 'current-session', amr: [{ method: 'oauth', timestamp: now - 30 }] })
    .setProtectedHeader({ alg: 'HS256' }).setSubject('real-user').setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(SECRET));
  const resolver = createUserResolver({ jwtSecret: SECRET });
  assert.deepEqual(await resolver.resolve(`Bearer ${token}`, 'fake-user'), { ok: true, userId: 'real-user', authenticatedAt: (now - 30) * 1000 });
  // Changing the auth time without the project's signature makes it unusable.
  const parts = token.split('.');
  const forged = { ...JSON.parse(Buffer.from(parts[1]!, 'base64url').toString()), amr: [{ method: 'oauth', timestamp: now }] };
  parts[1] = Buffer.from(JSON.stringify(forged)).toString('base64url');
  assert.equal((await resolver.resolve(`Bearer ${parts.join('.')}`, 'real-user')).ok, false);
});

test('local staging preserves and checks the verified Supabase session for durable tutor admission', async () => {
  const project = await generateKeyPair('ES256');
  const userId = '12345678-1234-4234-8234-123456789abc';
  const sessionId = '12345678-1234-4234-8234-123456789def';
  const token = await new SignJWT({ role: 'authenticated', session_id: sessionId })
    .setProtectedHeader({ alg: 'ES256' }).setSubject(userId).setIssuedAt().setExpirationTime('1h').sign(project.privateKey);
  const config = { supabaseUrl: 'https://project.supabase.co', nodeEnv: 'development', localDevelopment: '1' };
  const seen: string[][] = [];
  const resolver = createUserResolver(config, { getKey: async () => project.publicKey,
    isIdentityActive: async (user, session) => { seen.push([user, session]); return true; } });
  assert.deepEqual(await resolver.resolve(`Bearer ${token}`, 'forged'), { ok: true, userId, authSessionId: sessionId });
  assert.deepEqual(seen, [[userId, sessionId]]);
  const revoked = createUserResolver(config, { getKey: async () => project.publicKey, isIdentityActive: async () => false });
  assert.deepEqual(await revoked.resolve(`Bearer ${token}`, userId), { ok: false, status: 401, message: 'Sign in to use this.' });
  const unavailable = createUserResolver(config, { getKey: async () => project.publicKey });
  assert.equal((await unavailable.resolve(`Bearer ${token}`, userId)).ok, false);
});
