import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  MemoryRateLimiter,
  MemorySessionLeaseStore,
  UpstashRateLimiter,
  UpstashSessionLeaseStore,
  privateSignal,
  type RateLimitRule,
} from './rateLimit.ts';

const rule: RateLimitRule = { name: 'session-user', limit: 2, windowSec: 60 };

describe('request budgets — shared contract', () => {
  test('a fixed window refuses the request after its budget is spent', async () => {
    let now = 1_000;
    const limiter = new MemoryRateLimiter(() => now);
    assert.equal((await limiter.consume(rule, 'learner')).allowed, true);
    assert.equal((await limiter.consume(rule, 'learner')).allowed, true);
    assert.equal((await limiter.consume(rule, 'learner')).allowed, false);
    now += 61_000;
    assert.equal((await limiter.consume(rule, 'learner')).allowed, true);
  });

  test('different signals never spend each other’s budget', async () => {
    const limiter = new MemoryRateLimiter(() => 1_000);
    await limiter.consume({ ...rule, limit: 1 }, 'learner-a');
    assert.equal((await limiter.consume({ ...rule, limit: 1 }, 'learner-b')).allowed, true);
  });

  test('the distributed adapter fails closed on an invalid provider answer', async () => {
    const fetcher = async () => new Response(JSON.stringify({ result: 'not-a-counter' }), { status: 200 });
    const limiter = new UpstashRateLimiter('https://redis.example', 'secret', fetcher as typeof fetch);
    await assert.rejects(() => limiter.consume(rule, 'learner'), /invalid decision/);
  });

  test('the distributed adapter accepts only the provider counter and TTL', async () => {
    const fetcher = async () => new Response(JSON.stringify({ result: [2, 47] }), { status: 200 });
    const limiter = new UpstashRateLimiter('https://redis.example', 'secret', fetcher as typeof fetch);
    assert.deepEqual(await limiter.consume(rule, 'private-user-signal'), {
      allowed: true,
      remaining: 0,
      retryAfterSec: 47,
    });
  });

  test('raw user and network identities are not used as Redis keys', () => {
    const user = privateSignal('deployment-salt', 'user', 'user@example.com');
    const ip = privateSignal('deployment-salt', 'ip', '203.0.113.42');
    assert.ok(!user.includes('user@example.com'));
    assert.ok(!ip.includes('203.0.113.42'));
    assert.notEqual(user, privateSignal('deployment-salt', 'installation', 'user@example.com'));
  });
});

describe('active voice sessions — one lease per learner', () => {
  test('a second room is refused until the matching first session ends', async () => {
    let now = 1_000;
    const leases = new MemorySessionLeaseStore(() => now);
    assert.equal(await leases.acquire('learner', 'session-a', 60), true);
    assert.equal(await leases.acquire('learner', 'session-b', 60), false);
    await leases.release('learner', 'session-b');
    assert.equal(await leases.acquire('learner', 'session-b', 60), false, 'a stranger session cannot clear the lease');
    await leases.release('learner', 'session-a');
    assert.equal(await leases.acquire('learner', 'session-b', 60), true);
    now += 61_000;
    assert.equal(await leases.acquire('learner', 'session-c', 60), true, 'an abandoned room eventually expires');
  });

  test('the distributed lease is atomic and only its matching id can release it', async () => {
    const commands: unknown[][] = [];
    const fetcher = async (_input: string | URL | Request, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body)) as unknown[];
      commands.push(command);
      return new Response(JSON.stringify({ result: command[0] === 'SET' ? 'OK' : 1 }), { status: 200 });
    };
    const leases = new UpstashSessionLeaseStore('https://redis.example', 'secret', fetcher as typeof fetch);
    assert.equal(await leases.acquire('private-user-signal', 'session-a', 900), true);
    await leases.release('private-user-signal', 'session-a');
    assert.deepEqual(commands[0], [
      'SET',
      'parle:active-session:private-user-signal',
      'session-a',
      'NX',
      'EX',
      '900',
    ]);
    assert.equal(commands[1]?.[0], 'EVAL');
    assert.equal(commands[1]?.at(-1), 'session-a');
  });
});
