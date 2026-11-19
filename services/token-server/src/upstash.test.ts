import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { RedisGuestSceneLedger } from './guestSceneAdmission.ts';
import { RedisGuestSpeechLedger } from './guestSpeechAdmission.ts';
import { RedisGuestStore } from './onboardingGuest.ts';
import { UpstashRateLimiter, UpstashSessionLeaseStore } from './rateLimit.ts';
import { upstashCommand } from './upstash.ts';

const BASE = 'https://redis.example';
const TOKEN = 'test-token';
const speechKeys = { guest: 'g', installation: 'i', address: 'a', global: 'all' };

interface Seen { url: string; init: RequestInit }
type Answer = () => Response;

/** One entry per Upstash adapter: the command it should send, a good answer, its read cap and its own failure wording. */
const adapters = [
  {
    name: 'RedisGuestStore', cap: 1024 * 1024, wording: 'guest store unavailable',
    command: ['GET', 'luvani:guest:k'], ok: { result: null },
    run: (f: typeof fetch) => new RedisGuestStore(BASE, TOKEN, f).get('k'),
  },
  {
    name: 'RedisGuestSceneLedger', cap: 64 * 1024, wording: 'guest scene ledger unavailable',
    command: ['GET', 'install-key'], ok: { result: null },
    run: (f: typeof fetch) => new RedisGuestSceneLedger(BASE, TOKEN, f).installationUsed('install-key'),
  },
  {
    name: 'RedisGuestSpeechLedger', cap: 64 * 1024, wording: 'guest speech ledger unavailable',
    command: ['MGET', 'g', 'i', 'a', 'all'], ok: { result: [null, null, null, null] },
    run: (f: typeof fetch) => new RedisGuestSpeechLedger(BASE, TOKEN, f).used(speechKeys),
  },
  {
    name: 'UpstashRateLimiter', cap: 64 * 1024, wording: 'distributed rate limiter returned',
    command: null, ok: { result: [1, 60] },
    run: (f: typeof fetch) => new UpstashRateLimiter(BASE, TOKEN, f).consume({ name: 'r', limit: 2, windowSec: 60 }, 's'),
  },
  {
    name: 'UpstashSessionLeaseStore', cap: 64 * 1024, wording: 'distributed session lease returned',
    command: ['SET', 'luvani:active-session:u', 'sid', 'NX', 'EX', '30'], ok: { result: 'OK' },
    run: (f: typeof fetch) => new UpstashSessionLeaseStore(BASE, TOKEN, f).acquire('u', 'sid', 30),
  },
] as const;

function fake(answer: Answer, seen: Seen[] = []): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), init: init ?? {} });
    return answer();
  }) as typeof fetch;
}
const json = (status: number, body: unknown) => () =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('Upstash REST adapters', () => {
  test('each Upstash adapter posts its command as JSON with the bearer token', async () => {
    for (const adapter of adapters) {
      const seen: Seen[] = [];
      await adapter.run(fake(json(200, adapter.ok), seen));
      assert.equal(seen.length, 1, adapter.name);
      const { url, init } = seen[0]!;
      assert.equal(url, BASE, adapter.name);
      assert.equal(init.method, 'POST', adapter.name);
      const headers = new Headers(init.headers);
      assert.equal(headers.get('authorization'), `Bearer ${TOKEN}`, adapter.name);
      assert.equal(headers.get('content-type'), 'application/json', adapter.name);
      const body = JSON.parse(String(init.body)) as unknown[];
      if (adapter.command) assert.deepEqual(body, adapter.command, adapter.name);
      else assert.deepEqual([body[0], body[2], body[3], body[4]], ['EVAL', '1', 'luvani:limit:r:s', '60'], adapter.name);
      assert.ok(init.signal instanceof AbortSignal, adapter.name);
    }
  });

  test("an Upstash failure keeps each adapter's own error wording", async () => {
    for (const adapter of adapters) {
      const exact = adapter.wording.endsWith('returned');
      for (const [status, answer] of [
        [500, json(500, { error: 'ERR something failed' })],
        [503, () => new Response(null, { status: 503 })],
      ] as const) {
        const message = exact ? `${adapter.wording} ${status}` : adapter.wording;
        await assert.rejects(adapter.run(fake(answer)), { message }, `${adapter.name} ${status}`);
      }
    }
    // A 200 carrying an error is a failure for the guest stores in the same words.
    for (const adapter of adapters.filter((a) => !a.wording.endsWith('returned'))) {
      await assert.rejects(adapter.run(fake(json(200, { error: 'ERR wrong type' }))), { message: adapter.wording }, adapter.name);
    }
  });

  test('every Upstash command goes through one bounded helper that refuses a redirect and an oversized answer', async () => {
    const oversized = (cap: number) => () => new Response(JSON.stringify({ result: 'a'.repeat(cap) }), { status: 200 });
    const tooLarge = { message: 'network-response-limit' };
    for (const adapter of adapters) {
      const seen: Seen[] = [];
      await adapter.run(fake(json(200, adapter.ok), seen));
      assert.equal(seen[0]!.init.redirect, 'error', adapter.name);
      await assert.rejects(adapter.run(fake(oversized(adapter.cap))), tooLarge, adapter.name);
    }
    const seen: Seen[] = [];
    assert.equal(await upstashCommand(fake(json(200, { result: 'OK' }), seen), BASE, TOKEN, ['PING'], (s) => new Error(`x ${s}`)), 'OK');
    assert.equal(seen[0]!.init.redirect, 'error');
    await assert.rejects(upstashCommand(fake(oversized(64 * 1024)), BASE, TOKEN, ['PING'], (s) => new Error(`x ${s}`)), tooLarge);
  });

  test('an error answer from the lease store is a failure, not a busy session', async () => {
    const leases = new UpstashSessionLeaseStore(BASE, TOKEN, fake(json(200, { error: 'ERR wrong type' })));
    await assert.rejects(leases.acquire('u', 'sid', 30), { message: 'distributed session lease returned 200' });
    await assert.rejects(leases.release('u', 'sid'), { message: 'distributed session lease returned 200' });
    const seen: Seen[] = [];
    await new UpstashSessionLeaseStore(BASE, TOKEN, fake(json(200, { result: 1 }), seen)).release('u', 'sid');
    const { url, init } = seen[0]!;
    assert.equal(url, BASE);
    assert.equal(init.redirect, 'error');
    assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${TOKEN}`);
    const [verb, script, ...rest] = JSON.parse(String(init.body)) as string[];
    assert.equal(verb, 'EVAL');
    assert.match(script!, /redis\.call\('GET', KEYS\[1\]\) == ARGV\[1\]/);
    assert.match(script!, /redis\.call\('DEL', KEYS\[1\]\)/);
    assert.deepEqual(rest, ['1', 'luvani:active-session:u', 'sid']);
  });

  test('a guest row the agent route accepts can always be read back', async () => {
    // An in-memory Redis behind the fake: create stores ARGV[1], GET answers it as a JSON string inside JSON.
    const rows = new Map<string, string>();
    const request = (async (_url: string | URL | Request, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body)) as string[];
      if (command[0] === 'EVAL') { rows.set(command[3]!, command[5]!); return json(200, { result: 1 })(); }
      if (command[0] === 'GET') return json(200, { result: rows.get(command[1]!) ?? null })();
      return new Response(null, { status: 500 });
    }) as typeof fetch;
    const store = new RedisGuestStore(BASE, TOKEN, request);
    const row = { id: 'guest', installation: 'install', expiresAt: 1, createdAt: 0, goal: 'travel', drink: 'coffee',
      minutes: 5, attempts: {}, seconds: 0, analyticsAllowed: false, variant: 'full', live: { baseline: { note: '' } } };
    // Quote-heavy content sized so the stored row is the 160 KB the agent route reads (server.ts readJson 160 * 1024).
    const base = JSON.stringify(row).length;
    row.live.baseline.note = '"'.repeat(Math.floor((160 * 1024 - base) / 2));
    assert.ok(JSON.stringify(row).length <= 160 * 1024 && JSON.stringify(row).length > 160 * 1024 - 4);
    assert.equal(await store.create('k', row as never), true);
    assert.deepEqual(await store.get('k'), row);
  });
});
