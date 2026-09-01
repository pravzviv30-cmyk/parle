import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { productionConfigurationProblems } from './config.ts';

describe('production starts closed', () => {
  test('development keeps the keyless path', () => {
    assert.deepEqual(
      productionConfigurationProblems({ NODE_ENV: 'development', LUVANI_LOCAL_DEVELOPMENT: '1' }),
      [],
    );
  });

  test('an omitted or misspelled production mode fails closed', () => {
    assert.ok(productionConfigurationProblems({}).includes('NODE_ENV=production or LUVANI_LOCAL_DEVELOPMENT=1'));
    assert.ok(
      productionConfigurationProblems({ NODE_ENV: 'prod' }).includes(
        'NODE_ENV=production or LUVANI_LOCAL_DEVELOPMENT=1',
      ),
    );
  });

  test('production refuses client-trusted identity, open debit and volatile balances', () => {
    const problems = productionConfigurationProblems({ NODE_ENV: 'production' });
    assert.ok(problems.includes('HTTPS Supabase JWKS authentication'));
    assert.ok(problems.includes('secure WSS LiveKit URL'));
    assert.ok(problems.includes('LUVANI_AGENT_SECRET'));
    assert.ok(problems.includes('LUVANI_ALLOWED_ORIGINS'));
    assert.ok(problems.includes('distributed rate limiting'));
    assert.ok(problems.includes('LUVANI_RATE_LIMIT_SALT'));
    assert.ok(problems.includes('atomic Supabase entitlement storage'));
  });

  test('a local entitlement file is never accepted as production purchase authority', () => {
    const problems = productionConfigurationProblems({
      NODE_ENV: 'production',
      SUPABASE_JWT_SECRET: 'legacy-auth-secret',
      LIVEKIT_URL: 'wss://luvani.livekit.cloud',
      LUVANI_AGENT_SECRET: 'agent-secret',
      LUVANI_ALLOWED_ORIGINS: 'https://app.luvani.example',
      UPSTASH_REDIS_REST_URL: 'https://redis.example',
      UPSTASH_REDIS_REST_TOKEN: 'redis-token',
      LUVANI_RATE_LIMIT_SALT: 'a-unique-deployment-salt-at-least-32-chars',
      ENTITLEMENT_STORE_PATH: './entitlements.json',
    });
    assert.ok(problems.includes('atomic Supabase entitlement storage'));
  });

  test('production rejects wildcard and non-HTTPS browser origins', () => {
    const base = {
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      LIVEKIT_URL: 'wss://luvani.livekit.cloud',
      LUVANI_AGENT_SECRET: 'agent-secret',
    };
    assert.ok(productionConfigurationProblems({ ...base, LUVANI_ALLOWED_ORIGINS: '*' }).includes('exact HTTPS origins'));
    assert.ok(
      productionConfigurationProblems({ ...base, LUVANI_ALLOWED_ORIGINS: 'http://app.luvani.example' }).includes(
        'exact HTTPS origins',
      ),
    );
  });

  test('production rejects plaintext service and room endpoints', () => {
    const problems = productionConfigurationProblems({
      NODE_ENV: 'production',
      SUPABASE_URL: 'http://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      LIVEKIT_URL: 'ws://livekit.example',
      LUVANI_AGENT_SECRET: 'agent-secret',
      LUVANI_ALLOWED_ORIGINS: 'https://app.luvani.example',
      UPSTASH_REDIS_REST_URL: 'https://redis.example',
      UPSTASH_REDIS_REST_TOKEN: 'redis-token',
      LUVANI_RATE_LIMIT_SALT: 'a-unique-deployment-salt-at-least-32-chars',
    });
    assert.ok(problems.includes('HTTPS Supabase JWKS authentication'));
    assert.ok(problems.includes('secure WSS LiveKit URL'));
  });

  test('a complete Supabase deployment passes', () => {
    assert.deepEqual(
      productionConfigurationProblems({
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        LIVEKIT_URL: 'wss://luvani.livekit.cloud',
        LUVANI_AGENT_SECRET: 'agent-secret',
        LUVANI_ALLOWED_ORIGINS: 'https://app.luvani.example',
        UPSTASH_REDIS_REST_URL: 'https://redis.example',
        UPSTASH_REDIS_REST_TOKEN: 'redis-token',
        LUVANI_RATE_LIMIT_SALT: 'a-unique-deployment-salt-at-least-32-chars',
      }),
      [],
    );
  });

  test('half a billing configuration refuses to boot in production', () => {
    const base = {
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      LIVEKIT_URL: 'wss://luvani.livekit.cloud',
      LUVANI_AGENT_SECRET: 'agent-secret',
      LUVANI_ALLOWED_ORIGINS: 'https://app.luvani.example',
      UPSTASH_REDIS_REST_URL: 'https://redis.example',
      UPSTASH_REDIS_REST_TOKEN: 'redis-token',
      LUVANI_RATE_LIMIT_SALT: 'a-unique-deployment-salt-at-least-32-chars',
    };
    assert.ok(
      productionConfigurationProblems({ ...base, REVENUECAT_SECRET_API_KEY: 'only-one-key' }).includes(
        'complete RevenueCat billing configuration',
      ),
    );
    assert.deepEqual(
      productionConfigurationProblems({
        ...base,
        REVENUECAT_SECRET_API_KEY: 'api',
        LUVANI_REVENUECAT_WEBHOOK_SECRET: 'hook',
        REVENUECAT_ENTITLEMENT_ID: 'luvani',
        REVENUECAT_STARTER_PRODUCT_ID: 'starter',
        REVENUECAT_REGULAR_PRODUCT_ID: 'regular',
      }),
      [],
    );
  });
});
