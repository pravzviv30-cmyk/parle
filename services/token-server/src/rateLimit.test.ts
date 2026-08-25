import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';
import { describe, test } from 'node:test';

import {
  MemoryRateLimiter,
  MemorySessionLeaseStore,
  RATE_LIMITS,
  UpstashRateLimiter,
  UpstashSessionLeaseStore,
  clientIp,
  privateSignal,
  type RateLimitRule,
} from './rateLimit.ts';

const rule: RateLimitRule = { name: 'session-user', limit: 2, windowSec: 60 };

/** Only the two fields clientIp reads; enough to forge a request by hand. */
function request(headers: Record<string, string | string[]>, remoteAddress = '198.51.100.7'): IncomingMessage {
  return { headers, socket: { remoteAddress } } as unknown as IncomingMessage;
}

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

// ---------------------------------------------------------------------------
// F59 — the address a request is budgeted against
// ---------------------------------------------------------------------------

describe('the forwarded address — who the budget actually belongs to', () => {
  test('a client-supplied forwarded header cannot choose its own rate-limit address behind a trusted proxy', async () => {
    // A proxy APPENDS. Everything left of the last entry was typed by the caller.
    const spoofed = request({ 'x-forwarded-for': '203.0.113.9, 198.51.100.7' });
    assert.equal(clientIp(spoofed, true), '198.51.100.7', 'the nearest hop is the last entry, not the first');

    // The attack: rotate the header, expect a fresh budget. It must not work.
    const salt = 'deployment-salt';
    const signals = new Set(
      ['203.0.113.9', '203.0.113.10', 'not-an-address', '::1', '10.0.0.1, 10.0.0.2'].map((forged) =>
        privateSignal(salt, 'ip', clientIp(request({ 'x-forwarded-for': `${forged}, 198.51.100.7` }), true)),
      ),
    );
    assert.equal(signals.size, 1, 'header rotation must land on one signal, so it spends one budget');

    // And that budget really does run out, however the header is dressed up.
    const limiter = new MemoryRateLimiter(() => 1_000);
    const ipRule: RateLimitRule = { ...RATE_LIMITS.sessionIp, limit: 2 };
    const attempt = async (forged: string) =>
      (
        await limiter.consume(
          ipRule,
          privateSignal(salt, 'ip', clientIp(request({ 'x-forwarded-for': `${forged}, 198.51.100.7` }), true)),
        )
      ).allowed;
    assert.equal(await attempt('203.0.113.1'), true);
    assert.equal(await attempt('203.0.113.2'), true);
    assert.equal(await attempt('203.0.113.3'), false, 'a rotated header must not buy a third request');

    // A genuinely different peer is still a different budget.
    assert.notEqual(
      clientIp(request({ 'x-forwarded-for': '203.0.113.9, 198.51.100.7' }), true),
      clientIp(request({ 'x-forwarded-for': '203.0.113.9, 198.51.100.8' }), true),
    );

    // Repeated headers fold to a list; the nearest hop is still last.
    assert.equal(clientIp(request({ 'x-forwarded-for': ['203.0.113.9', '198.51.100.7'] }), true), '198.51.100.7');

    // Padding, empties and oversized junk cannot displace the appended entry.
    assert.equal(clientIp(request({ 'x-forwarded-for': `${'9'.repeat(200)},, 198.51.100.7 ,` }), true), '198.51.100.7');

    // Without a proxy in front, the header is worth nothing at all.
    assert.equal(clientIp(request({ 'x-forwarded-for': '203.0.113.9' }), false), '198.51.100.7');
    assert.equal(clientIp(request({}), true), '198.51.100.7', 'no header falls back to the socket peer');
    assert.equal(clientIp(request({ 'x-forwarded-for': '   ,  ' }), true), '198.51.100.7');
  });
});

// ---------------------------------------------------------------------------
// F60 — the redis boundary: failures refuse, keys are hashed
// ---------------------------------------------------------------------------

const serverSource = readFileSync(path.join(import.meta.dirname, 'server.ts'), 'utf8');
const rateLimitSource = readFileSync(path.join(import.meta.dirname, 'rateLimit.ts'), 'utf8');

/** Every argument list passed to `callee`, split on top-level commas. */
function callArguments(source: string, callee: string): string[][] {
  const calls: string[][] = [];
  for (let at = source.indexOf(callee); at !== -1; at = source.indexOf(callee, at + 1)) {
    let depth = 1;
    let cursor = at + callee.length;
    const start = cursor;
    while (cursor < source.length && depth > 0) {
      const ch = source[cursor];
      if (ch === '(' || ch === '[' || ch === '{') depth += 1;
      else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
      cursor += 1;
    }
    const inner = source.slice(start, cursor - 1);
    const args: string[] = [];
    let level = 0;
    let current = '';
    for (const ch of inner) {
      if (ch === '(' || ch === '[' || ch === '{') level += 1;
      if (ch === ')' || ch === ']' || ch === '}') level -= 1;
      if (ch === ',' && level === 0) {
        args.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    if (current.trim()) args.push(current.trim());
    calls.push(args);
  }
  return calls;
}

/** Hashed at the callsite, or bound once to a `privateSignal` result. */
function isHashedAtSource(argument: string): boolean {
  if (argument.startsWith('privateSignal(')) return true;
  if (!/^[A-Za-z_$][\w$]*$/.test(argument)) return false;
  return new RegExp(`const\\s+${argument}\\s*=\\s*privateSignal\\(`).test(serverSource);
}

describe('the redis boundary — failures refuse, keys are hashed', () => {
  test('a distributed limiter failure refuses the request instead of granting it', async () => {
    const rejecting = async () => {
      throw new Error('upstash unreachable');
    };
    const limiter = new UpstashRateLimiter('https://redis.example', 'token', rejecting as unknown as typeof fetch);
    await assert.rejects(() => limiter.consume(rule, 'signal'), /upstash unreachable/);

    for (const status of [401, 429, 500, 503]) {
      const failing = async () => new Response('', { status });
      const refused = new UpstashRateLimiter('https://redis.example', 'token', failing as typeof fetch);
      await assert.rejects(
        () => refused.consume(rule, 'signal'),
        new RegExp(String(status)),
        `HTTP ${status} from the provider must not be read as a grant`,
      );
    }

    // A 200 with a body that is not a counter is still not permission.
    for (const body of ['{}', '{"result":[]}', '{"result":["nope","nope"]}', '{"result":null}']) {
      const odd = async () => new Response(body, { status: 200 });
      const limited = new UpstashRateLimiter('https://redis.example', 'token', odd as typeof fetch);
      await assert.rejects(() => limited.consume(rule, 'signal'), `a ${body} answer must not be read as a grant`);
    }

    // The lease is the same boundary: an error is never an acquired lease.
    const leases = new UpstashSessionLeaseStore('https://redis.example', 'token', rejecting as unknown as typeof fetch);
    await assert.rejects(() => leases.acquire('signal', 'session-a', 60), /upstash unreachable/);
    for (const result of ['null', '"nope"', '0', 'false']) {
      const notOk = async () => new Response(`{"result":${result}}`, { status: 200 });
      const store = new UpstashSessionLeaseStore('https://redis.example', 'token', notOk as typeof fetch);
      assert.equal(await store.acquire('signal', 'session-a', 60), false, `SET → ${result} is not a lease`);
    }

    // And nothing between the limiter and the handler turns a throw into a grant:
    // withinLimits does not catch, so the one catch in the pipeline answers 500.
    const withinLimits = serverSource.slice(
      serverSource.indexOf('async function withinLimits('),
      serverSource.indexOf('function ipCheck('),
    );
    assert.ok(withinLimits.length > 0, 'withinLimits must still exist to be checked');
    assert.doesNotMatch(withinLimits, /\bcatch\b/, 'a caught limiter failure would become a silent grant');
    assert.match(serverSource, /catch \(err\)[\s\S]{0,200}json\(res, 500/);
  });

  test('no raw ip, user or installation value reaches a redis key without the deployment-salted hmac', () => {
    const consumeCalls = callArguments(serverSource, 'rateLimiter.consume(');
    assert.ok(consumeCalls.length > 0, 'the limiter must still be called from the server');
    for (const args of consumeCalls) {
      assert.ok(isHashedAtSource(args[1] ?? ''), `rateLimiter.consume key argument is raw: ${args[1]}`);
    }

    const leaseCalls = [
      ...callArguments(serverSource, 'sessionLeases.acquire('),
      ...callArguments(serverSource, 'sessionLeases.release('),
    ];
    assert.ok(leaseCalls.length >= 2, 'both lease callsites must still exist');
    for (const args of leaseCalls) {
      assert.ok(isHashedAtSource(args[0] ?? ''), `session lease key argument is raw: ${args[0]}`);
    }

    // The raw readers exist, and their results must never be the key themselves.
    for (const reader of ['clientIp(', 'installationSignal(', 'resolved.userId', 'body.userId']) {
      for (const args of [...consumeCalls.map((a) => a[1] ?? ''), ...leaseCalls.map((a) => a[0] ?? '')]) {
        assert.ok(
          !args.startsWith(reader),
          `${reader} reaches a redis key unhashed`,
        );
      }
    }

    // Inside the adapter, the key is built from the passed signal and the rule
    // name only — it never reaches back into the request for an identity.
    const keyTemplates = [...rateLimitSource.matchAll(/`parle:[^`]*`/g)].map((m) => m[0]);
    assert.ok(keyTemplates.length >= 2, 'the redis key templates must still be here');
    for (const template of keyTemplates) {
      for (const slot of [...template.matchAll(/\$\{([^}]+)\}/g)].map((m) => (m[1] ?? '').trim())) {
        assert.ok(
          ['rule.name', 'signal', 'userSignal'].includes(slot),
          `redis key template interpolates ${slot}, which is not a hashed signal`,
        );
      }
    }
    const adapters = rateLimitSource.slice(
      rateLimitSource.indexOf('class UpstashRateLimiter'),
      rateLimitSource.indexOf('export function createRateLimiter('),
    );
    assert.ok(adapters.length > 0, 'both distributed adapters must still be here');
    assert.doesNotMatch(adapters, /req\.headers|remoteAddress/, 'the adapter must not read an identity of its own');

    // Finally the hash itself: 43 base64url characters, salted, and carrying
    // none of the value it stands for.
    const salt = 'a'.repeat(48);
    const raw = {
      ip: '203.0.113.42',
      user: 'learner@example.com',
      installation: 'installation-0123456789abcdef',
    } as const;
    const seen = new Set<string>();
    for (const [kind, value] of Object.entries(raw) as [keyof typeof raw, string][]) {
      const signal = privateSignal(salt, kind, value);
      assert.match(signal, /^[A-Za-z0-9_-]{43}$/, `${kind} signal is not a 43-character base64url hmac`);
      assert.ok(!signal.includes(value));
      assert.ok(!signal.includes(value.split('@')[0] ?? value));
      assert.notEqual(signal, privateSignal('b'.repeat(48), kind, value), 'the deployment salt must change the key');
      seen.add(signal);
    }
    assert.equal(seen.size, 3, 'kinds must not collide into one namespace');
    assert.notEqual(privateSignal(salt, 'ip', 'x'), privateSignal(salt, 'user', 'x'));
  });
});
