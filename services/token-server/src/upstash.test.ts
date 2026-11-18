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

/** One entry per Upstash adapter: the command it should send, a good answer, and its own failure wording. */
const adapters = [
  {
    name: 'RedisGuestStore', converted: true, wording: 'guest store unavailable',
    command: ['GET', 'luvani:guest:k'], ok: { result: null },
    run: (f: typeof fetch) => new RedisGuestStore(BASE, TOKEN, f).get('k'),
  },
  {
    name: 'RedisGuestSceneLedger', converted: true, wording: 'guest scene ledger unavailable',
    command: ['GET', 'install-key'], ok: { result: null },
    run: (f: typeof fetch) => new RedisGuestSceneLedger(BASE, TOKEN, f).installationUsed('install-key'),
  },
  {
    name: 'RedisGuestSpeechLedger', converted: true, wording: 'guest speech ledger unavailable',
    command: ['MGET', 'g', 'i', 'a', 'all'], ok: { result: [null, null, null, null] },
    run: (f: typeof fetch) => new RedisGuestSpeechLedger(BASE, TOKEN, f).used(speechKeys),
  },
  {
    name: 'UpstashRateLimiter', converted: true, wording: 'distributed rate limiter returned',
    command: null, ok: { result: [1, 60] },
    run: (f: typeof fetch) => new UpstashRateLimiter(BASE, TOKEN, f).consume({ name: 'r', limit: 2, windowSec: 60 }, 's'),
  },
  {
    name: 'UpstashSessionLeaseStore', converted: false, wording: 'distributed session lease returned',
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
    const oversized = () => new Response(JSON.stringify({ result: 'a'.repeat(64 * 1024) }), { status: 200 });
    for (const adapter of adapters.filter((a) => a.converted)) {
      const seen: Seen[] = [];
      await adapter.run(fake(json(200, adapter.ok), seen));
      assert.equal(seen[0]!.init.redirect, 'error', adapter.name);
      await assert.rejects(adapter.run(fake(oversized)), adapter.name);
    }
    const seen: Seen[] = [];
    assert.equal(await upstashCommand(fake(json(200, { result: 'OK' }), seen), BASE, TOKEN, ['PING'], (s) => new Error(`x ${s}`)), 'OK');
    assert.equal(seen[0]!.init.redirect, 'error');
    await assert.rejects(upstashCommand(fake(oversized), BASE, TOKEN, ['PING'], (s) => new Error(`x ${s}`)));
  });
});
