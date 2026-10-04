import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from 'jose';
const { createUserResolver } = await import(new URL('../../services/token-server/src/auth.ts', import.meta.url));
const { deleteAccountWithProcessor } = await import(new URL('../../services/token-server/src/accountDeletion.ts', import.meta.url));
const { productionConfigurationProblems } = await import(new URL('../../services/token-server/src/config.ts', import.meta.url));
const SYNTHETIC_KEY = 'synthetic-key';
const fakeSecret = 'dummy-agent-secret';
const fakeSalt = 'dummy-rate-limit-salt-with-at-least-32-characters';

// Synthetic trusted signing key and mocked HTTP; no real credentials or network.
const { privateKey, publicKey } = await generateKeyPair('ES256');
const resolver = createUserResolver({ nodeEnv: 'production', supabaseUrl: 'https://expected-project.example.invalid' }, { getKey: async () => publicKey });
const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const cases = [
  ['wrong issuer/audience', { iss: 'https://other-project.example.invalid', aud: 'other-app', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 60 }],
  ['nonlearner role', { role: 'service_role', exp: Math.floor(Date.now() / 1000) + 60 }],
  ['missing expiry', { role: 'authenticated' }],
];
for (const [name, claims] of cases) {
  const token = await new SignJWT(claims).setProtectedHeader({ alg: 'ES256' }).setSubject(userId).sign(privateKey);
  const result = await resolver.resolve(`Bearer ${token}`, null);
  assert.equal(result.ok, true);
  console.log(JSON.stringify({ case: name, acceptedByTrustedKeyFixture: result.ok, outsiderForgery: false }));
}
const expired = await new SignJWT({ exp: 1 }).setProtectedHeader({ alg: 'ES256' }).setSubject(userId).sign(privateKey);
assert.equal((await resolver.resolve(`Bearer ${expired}`, null)).ok, false);
console.log(JSON.stringify({ case: 'supplied expired token', rejected: true }));

const problems = productionConfigurationProblems({
  NODE_ENV: 'production',
  LIVEKIT_URL: 'wss://livekit.example.invalid',
  SUPABASE_URL: 'https://supabase.example.invalid',
  SUPABASE_SERVICE_ROLE_KEY: SYNTHETIC_KEY,
  LUVANI_AGENT_SECRET: fakeSecret,
  LUVANI_ALLOWED_ORIGINS: 'https://app.example.invalid',
  UPSTASH_REDIS_REST_URL: 'https://redis.example.invalid',
  UPSTASH_REDIS_REST_TOKEN: SYNTHETIC_KEY,
  LUVANI_RATE_LIMIT_SALT: fakeSalt,
});
assert.deepEqual(problems, []);
let requests = 0;
const deleted = await deleteAccountWithProcessor('https://supabase.example.invalid', 'synthetic-key', userId, undefined, async () => { requests += 1; return new Response('{}', { status: 200 }); });
assert.equal(deleted, false);
assert.equal(requests, 0);
console.log(JSON.stringify({ case: 'billing-dark deletion', productionConfigurationAccepted: true, deleted, databaseOrProcessorRequests: requests }));
