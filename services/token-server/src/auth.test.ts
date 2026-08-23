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

describe('not configured: the pre-auth contract, unchanged', () => {
  const resolver = createUserResolver({});

  test('the asserted id passes straight through', async () => {
    assert.equal(resolver.configured, false);
    assert.deepEqual(await resolver.resolve(undefined, 'learner-1'), { ok: true, userId: 'learner-1' });
  });

  test('no asserted id is the same 400 it always was', async () => {
    const result = await resolver.resolve(undefined, null);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 400);
  });

  test('a stray bearer header changes nothing', async () => {
    assert.deepEqual(await resolver.resolve('Bearer whatever', 'learner-1'), { ok: true, userId: 'learner-1' });
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
});
