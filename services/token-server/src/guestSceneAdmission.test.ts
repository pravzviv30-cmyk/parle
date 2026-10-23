import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  BOOK_SCRIPT, MemoryGuestSceneLedger, RedisGuestSceneLedger, RELEASE_INSTALLATION_SCRIPT, RESERVE_INSTALLATION_SCRIPT,
  guestSceneAdmission, guestSceneDaily, guestSceneGaps, guestSceneKeys,
} from './guestSceneAdmission.ts';
import { RedisGuestStore, SHRINK_SCRIPT, claimGuest, createGuest, guestKey } from './onboardingGuest.ts';
import { privateSignal } from './rateLimit.ts';

const INSTALL = privateSignal('salt', 'installation', 'device-1');
const DAY = 86400_000;

/**
 * A fake Upstash REST transport. Each command runs to completion synchronously,
 * like a Redis script, while the awaits around fetch let callers interleave.
 * It proves the TypeScript side of each script's contract, not the Lua itself.
 */
function fakeRedis(clock: () => number) {
  const data = new Map<string, { value: string; expiresAt: number | null }>();
  const read = (key: string) => {
    const row = data.get(key);
    if (row && row.expiresAt !== null && row.expiresAt <= clock()) { data.delete(key); return null; }
    return row ?? null;
  };
  const set = (key: string, value: string, ttlSec: number | 'keep' | null) => {
    const keep = ttlSec === 'keep' ? read(key)?.expiresAt ?? null : null;
    data.set(key, { value, expiresAt: ttlSec === 'keep' ? keep : ttlSec === null ? null : clock() + ttlSec * 1000 });
  };
  const run = (command: string[]): unknown => {
    const [name, script, , ...rest] = command;
    if (name === 'GET') return read(script!)?.value ?? null;
    if (name !== 'EVAL') throw new Error(`unexpected ${name}`);
    const count = Number(command[2]);
    const keys = rest.slice(0, count), argv = rest.slice(count);
    if (script === RESERVE_INSTALLATION_SCRIPT) {
      if (read(keys[0]!)) return 0;
      set(keys[0]!, argv[0]!, Number(argv[1])); return 1;
    }
    if (script === RELEASE_INSTALLATION_SCRIPT) { if (read(keys[0]!)?.value === argv[0]) data.delete(keys[0]!); return 1; }
    if (script === BOOK_SCRIPT) {
      if (read(keys[1]!)) return 1;
      const used = Number(read(keys[0]!)?.value ?? '0');
      if (used >= Number(argv[0])) return 0;
      set(keys[0]!, String(used + 1), Number(argv[1])); set(keys[1]!, '1', Number(argv[1])); return 1;
    }
    if (script === SHRINK_SCRIPT) {
      const row = read(keys[0]!);
      if (!row || row.value !== argv[0]) return 0;
      const ttl = row.expiresAt === null ? -1 : Math.ceil((row.expiresAt - clock()) / 1000);
      set(keys[0]!, argv[1]!, ttl < 0 || ttl > Number(argv[2]) ? Number(argv[2]) : 'keep'); return 1;
    }
    if (script!.startsWith("if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end")) {
      if (read(keys[1]!)) return 0;
      set(keys[0]!, argv[0]!, 2592000); set(keys[1]!, '1', 86400); return 1;
    }
    if (script!.startsWith("if redis.call('GET', KEYS[1]) ~= ARGV[1]")) {
      if (read(keys[0]!)?.value !== argv[0]) return 0;
      set(keys[0]!, argv[1]!, 'keep'); return 1;
    }
    throw new Error('unexpected script');
  };
  const request = (async (_url: unknown, init?: RequestInit) => {
    await new Promise((resolve) => setImmediate(resolve));
    const result = run(JSON.parse(String(init?.body)) as string[]);
    await new Promise((resolve) => setImmediate(resolve));
    return Response.json({ result });
  }) as typeof fetch;
  return { request, data, ttlSec: (key: string) => { const row = read(key); return row?.expiresAt == null ? null : (row.expiresAt - clock()) / 1000; } };
}

test('the daily ceiling is a whole number from 1 to 2,000, default 24; anything else keeps scenes off', () => {
  assert.equal(guestSceneDaily({}), 24);
  assert.equal(guestSceneDaily({ LUVANI_GUEST_SCENE_DAILY: '1' }), 1);
  assert.equal(guestSceneDaily({ LUVANI_GUEST_SCENE_DAILY: '2000' }), 2000);
  for (const bad of ['0', '2001', '-3', '1.5', '24 scenes', 'abc', '1e2', '0x10'])
    assert.equal(guestSceneDaily({ LUVANI_GUEST_SCENE_DAILY: bad }), null, bad);
  const open = { NODE_ENV: 'production', LUVANI_GUEST_SCENE: '1', UPSTASH_REDIS_REST_URL: 'https://u', UPSTASH_REDIS_REST_TOKEN: 't',
    LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: 's', LUVANI_AGENT_SECRET: 'a' };
  assert.deepEqual(guestSceneGaps(open), []);
  assert.deepEqual(guestSceneGaps({ ...open, LUVANI_GUEST_SCENE_DAILY: '0' }), ['LUVANI_GUEST_SCENE_DAILY']);
});

test('production opens only with the switch and every dependency; the local flag never opens it, and names never carry values', () => {
  const open = { NODE_ENV: 'production', LUVANI_GUEST_SCENE: '1', UPSTASH_REDIS_REST_URL: 'https://u', UPSTASH_REDIS_REST_TOKEN: 'secret-token-value',
    LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: 's', LUVANI_AGENT_SECRET: 'agent-secret-value' };
  for (const [patch, gap] of [
    [{ LUVANI_GUEST_SCENE: undefined }, 'LUVANI_GUEST_SCENE'],
    [{ UPSTASH_REDIS_REST_TOKEN: undefined }, 'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN'],
    [{ LUVANI_AGENT_SECRET: undefined }, 'LUVANI_AGENT_SECRET'],
    [{ LIVEKIT_API_SECRET: '' }, 'LIVEKIT_API_KEY and LIVEKIT_API_SECRET'],
    [{ LUVANI_LOCAL_DEVELOPMENT: '1' }, 'production without LUVANI_LOCAL_DEVELOPMENT'],
  ] as const) {
    const gaps = guestSceneGaps({ ...open, ...patch });
    assert.deepEqual(gaps, [gap]);
    assert.doesNotMatch(gaps.join(' '), /secret-token-value|agent-secret-value/);
  }
  assert.deepEqual(guestSceneGaps({ LUVANI_LOCAL_DEVELOPMENT: '1', LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: 's' }, 'a'), [], 'local development opens it as for the convo path');
  assert.deepEqual(guestSceneGaps({ LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: 's' }, 'a'), ['LUVANI_GUEST_SCENE']);
});

for (const kind of ['memory', 'redis'] as const) {
  const make = (clock: () => number) => {
    const redis = fakeRedis(clock);
    return { ledger: kind === 'memory' ? new MemoryGuestSceneLedger(clock) : new RedisGuestSceneLedger('https://fake.invalid', 't', redis.request), redis };
  };

  test(`${kind}: one scene per installation per 30 days, released only by its own holder`, async () => {
    let now = Date.UTC(2026, 9, 23, 12);
    const { ledger } = make(() => now), admission = guestSceneAdmission(ledger, 24);
    const release = await admission.reserveInstallation(INSTALL, 'a');
    assert.ok(release);
    assert.equal(await admission.reserveInstallation(INSTALL, 'b'), null);
    await ledger.releaseInstallation(guestSceneKeys.installation(INSTALL), 'b');
    assert.equal(await admission.reserveInstallation(INSTALL, 'c'), null, 'a different holder cannot release the marker');
    now += 30 * DAY - 1000;
    assert.equal(await admission.reserveInstallation(INSTALL, 'd'), null);
    now += 2000;
    assert.ok(await admission.reserveInstallation(INSTALL, 'e'), 'a new scene after 30 days');
    assert.throws(() => guestSceneKeys.installation('raw-installation-id'), /hashed/);
  });

  test(`${kind}: each fence books one slot; the 25th claim of a day with a ceiling of 24 is refused and logged once without identities`, async (t) => {
    let now = Date.UTC(2026, 9, 23, 12);
    const { ledger, redis } = make(() => now), admission = guestSceneAdmission(ledger, 24);
    const warn = t.mock.method(console, 'warn', () => {});
    assert.equal(await admission.open(now), true);
    const fences = Array.from({ length: 24 }, () => randomUUID());
    for (const fence of fences) assert.equal(await admission.book(fence, now), true);
    assert.equal(await admission.book(fences[0]!, now), true, 'a repeat claim with the same fence books nothing new');
    assert.equal(await ledger.used(guestSceneKeys.day(now)), 24);
    assert.equal(await admission.open(now), false);
    const late = randomUUID();
    assert.equal(await admission.book(late, now), false);
    assert.equal(await admission.book(randomUUID(), now), false);
    assert.equal(warn.mock.callCount(), 1);
    const line = String(warn.mock.calls[0]!.arguments[0]);
    assert.match(line, /guest scene: the service-wide daily ceiling of 24 is spent/);
    for (const secret of [late, INSTALL, ...fences]) assert.equal(line.includes(secret), false);
    if (kind === 'redis') {
      const ttl = redis.ttlSec(guestSceneKeys.day(now))!;
      assert.ok(ttl > 0 && ttl <= 2 * 86400, 'daily counters carry a two-day TTL');
      assert.ok([...redis.data.keys()].every((key) => key.startsWith('luvani:guest-scene:') && !key.includes(late)), 'fences are stored hashed');
    }
    now += DAY;
    assert.equal(await admission.book(randomUUID(), now), true, 'the next UTC day has a fresh ceiling');
    for (let i = 1; i < 24; i++) await admission.book(randomUUID(), now);
    assert.equal(await admission.book(randomUUID(), now), false);
    assert.equal(await admission.book(randomUUID(), now), false);
    assert.equal(warn.mock.callCount(), 2, 'once per UTC day per process');
  });
}

test('redis-backed guest store: two concurrent claims from two accounts yield exactly one owner, then the record shrinks to at most 48 hours', async () => {
  const now = Date.now(), redis = fakeRedis(() => now);
  const store = new RedisGuestStore('https://fake.invalid', 't', redis.request);
  const guest = await createGuest(store, { installation: INSTALL, eligible: true, goal: 'food', drink: 'coffee', minutes: 5, scene: 'guest-cafe' }, now);
  const results = await Promise.allSettled([claimGuest(store, guest.token, 'account-a', now), claimGuest(store, guest.token, 'account-b', now)]);
  const won = results.filter((r) => r.status === 'fulfilled');
  assert.equal(won.length, 1);
  const owner = (won[0] as PromiseFulfilledResult<{ owner?: string }>).value.owner!;
  const loser = owner === 'account-a' ? 'account-b' : 'account-a';
  await assert.rejects(claimGuest(store, guest.token, loser, now), /already claimed/);
  assert.equal((await store.get(guestKey(guest.token)))!.owner, owner);
  await store.shrinkClaimed(guestKey(guest.token), loser);
  assert.ok((await store.get(guestKey(guest.token)))!.goal, 'only the owner shrinks the record');
  await store.shrinkClaimed(guestKey(guest.token), owner);
  const shrunk = (await store.get(guestKey(guest.token)))!;
  assert.deepEqual(Object.keys(shrunk).sort(), ['analyticsAllowed', 'expiresAt', 'id', 'installation', 'owner', 'scene', 'sceneTurns']);
  const ttl = redis.ttlSec(`luvani:guest:${guestKey(guest.token)}`)!;
  assert.ok(ttl > 0 && ttl <= 48 * 3600);
  assert.equal((await claimGuest(store, guest.token, owner, now)).owner, owner, 'a same-owner retry still succeeds');
});
