import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { parseFirstPracticeBrief, firstPracticeScenario, secondsRemaining, GUEST_SCENE, GUEST_CAFE_SCENE } from '@luvani/core';
import { MemoryGuestStore, createGuest, guestKey, claimGuest } from './onboardingGuest.ts';
import { prepareGuestLive, prepareGuestScene, guestLiveResult, endGuestLive, guestLiveOperation, GUEST_SCENE_MODES } from './guestLive.ts';
import { MemoryGuestSceneLedger, guestSceneAdmission, guestSceneDaily, guestSceneGaps, guestSceneKeys } from './guestSceneAdmission.ts';
import { MemoryRateLimiter, clientIp, privateSignal, type RateLimitRule } from './rateLimit.ts';
import { grantSession } from './tokens.ts';
import { tutorDigest } from '../../shared/tutorLifecycle.ts';

// Execute the real /onboarding/ branch of server.ts with in-memory stores and a
// real per-address limiter. This is not a hosted server or socket test.
const source = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
const start = source.indexOf("    if (req.method === 'POST' && url.pathname.startsWith('/onboarding/')) {");
const end = source.indexOf("\n    // RevenueCat's event is a doorbell", start);
assert.ok(start > 0 && end > start);
const js = stripTypeScriptTypes(`async function branch() {${source.slice(start, end)}}`);
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const SALT = 'scene-route-salt';
const INSTALL = 'installation-0000001';
const brief = { version: 1, goals: ['trip'], level: 'zero', confidence: 'hesitant', focus: 'speaking', minutes: 5, tutorVoice: 'emilie' };
const PRODUCTION = { NODE_ENV: 'production', LUVANI_GUEST_SCENE: '1', UPSTASH_REDIS_REST_URL: 'https://fixture.invalid', UPSTASH_REDIS_REST_TOKEN: 'fixture',
  LIVEKIT_API_KEY: 'devkey', LIVEKIT_API_SECRET: 'fixture-secret-long-enough-for-hmac-signing' };

function harness(env: Record<string, string | undefined> = PRODUCTION, options: { agentSecret?: string; trialAllowed?: unknown[] } = {}) {
  const guestStore = new MemoryGuestStore(), ledger = new MemoryGuestSceneLedger(), limiter = new MemoryRateLimiter();
  const guestScene = guestSceneAdmission(ledger, guestSceneDaily(env) ?? 24);
  const trialCalls: unknown[] = options.trialAllowed ?? [];
  async function call(path: string, { installation = INSTALL, token, body = {}, user = 'account-a', address = '203.0.113.7', forwarded }:
    { installation?: string; token?: string; body?: Record<string, unknown>; user?: string | null; address?: string; forwarded?: string } = {}) {
    const response: { status: number; body: Record<string, unknown> } = { status: 0, body: {} };
    const req = { method: 'POST', socket: { remoteAddress: address },
      headers: { 'x-luvani-guest': token, authorization: user, ...(forwarded ? { 'x-forwarded-for': forwarded } : {}) } };
    const json = (_res: unknown, status: number, value: Record<string, unknown>) => { response.status = status; response.body = value; };
    const world = {
      req, url: { pathname: path, search: '' }, res: {}, json,
      installationSignal: () => installation, privateSignal, rateLimitSalt: SALT,
      // The real limiter and the real address derivation, with LUVANI_TRUST_PROXY off.
      withinLimits: async (_req: unknown, res: unknown, checks: readonly (readonly [RateLimitRule, string, string])[]) => {
        const decisions = await Promise.all(checks.map(([rule, kind, signal]) => limiter.consume(rule, privateSignal(SALT, kind as 'ip', signal))));
        if (decisions.every(d => d.allowed)) return true;
        json(res, 429, { error: 'request limit reached' }); return false;
      },
      ipCheck: (r: typeof req, rule: RateLimitRule) => [rule, 'ip', clientIp(r as never, false)],
      GUEST_START_LIMIT: { name: 'guest-start', limit: 5, windowSec: 86400 }, GUEST_EVENT_LIMIT: {}, GUEST_REPLY_LIMIT: { name: 'guest-reply', limit: 20, windowSec: 3600 },
      readJson: async () => body, process: { env }, AGENT_SECRET: options.agentSecret ?? 'agent-fixture',
      supportsSessionMode: () => true, supportedSessionModes: () => ['lesson', 'convo', 'lesson-text', 'convo-text'],
      parseFirstPracticeBrief, firstPracticeScenario, guestStore, createGuest, guestKey, prepareGuestLive, guestLiveResult, endGuestLive, claimGuest,
      grantSession, config: { apiKey: 'devkey', apiSecret: 'fixture-secret-long-enough-for-hmac-signing' }, livekitUrl: 'wss://fixture.invalid',
      users: { resolve: async (header: string | null) => header ? { ok: true, userId: header } : { ok: false, status: 401, message: 'sign in required' } },
      saveConversationPack: async () => { throw new Error('a scene never saves a pack'); },
      claimTrialWithEvidence: async (...args: unknown[]) => { trialCalls.push(args[5]); return true; },
      store: { get: async () => ({ plan: 'trial' as const, secondsUsed: 0 }) }, eventSink: undefined, secondsRemaining,
      GUEST_SCENE, GUEST_CAFE_SCENE, GUEST_SCENE_MODES, prepareGuestScene, guestSceneGaps, guestSceneDaily, randomUUID, guestScene,
    };
    await new AsyncFunction(...Object.keys(world), js.slice(js.indexOf('{') + 1, js.lastIndexOf('}')))(...Object.values(world));
    return response;
  }
  const begin = (opts: Parameters<typeof call>[1] = {}) => call('/onboarding/start', { ...opts, body: { live: true, eligible: true, scene: 'guest-cafe', brief, analyticsAllowed: true, ...opts.body } });
  return { call, begin, guestStore, ledger, guestScene, trialCalls };
}

const claims = (token: string) => JSON.parse(JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()).metadata);

test('the switch off, any missing dependency or a malformed ceiling refuses with guest-live-unavailable and creates nothing', async () => {
  for (const [env, secret] of [
    [{ ...PRODUCTION, LUVANI_GUEST_SCENE: undefined }, undefined],
    [{ ...PRODUCTION, UPSTASH_REDIS_REST_URL: undefined }, undefined],
    [{ ...PRODUCTION, LIVEKIT_API_KEY: '' }, undefined],
    [PRODUCTION, ''],
    [{ ...PRODUCTION, LUVANI_GUEST_SCENE_DAILY: '0' }, undefined],
    [{ ...PRODUCTION, LUVANI_GUEST_SCENE_DAILY: 'lots' }, undefined],
    [{ ...PRODUCTION, LUVANI_LOCAL_DEVELOPMENT: '1' }, undefined],
  ] as const) {
    const h = harness(env, { agentSecret: secret });
    const r = await h.begin();
    assert.equal(r.status, 503);
    assert.equal(r.body.error, 'guest-live-unavailable');
    assert.equal(h.guestStore.rows.size, 0);
  }
  const local = harness({ NODE_ENV: 'test', LUVANI_LOCAL_DEVELOPMENT: '1', LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: 's' });
  assert.equal((await local.begin()).status, 200, 'local development opens it as for the convo path');
});

test('a production convo guest is still refused while scenes are open', async () => {
  const h = harness();
  const r = await h.call('/onboarding/start', { body: { live: true, eligible: true, brief } });
  assert.equal(r.status, 503);
  assert.equal(r.body.error, 'guest-live-unavailable');
  assert.equal(h.guestStore.rows.size, 0);
  assert.equal((await h.begin()).status, 200);
});

test('one scene per installation per 30 days; a repeat with the same capability books nothing', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 23, 9) });
  const h = harness();
  const first = await h.begin();
  assert.equal(first.status, 200);
  assert.equal(first.body.scene, 'guest-cafe');
  const token = first.body.token as string;
  const again = await h.begin({ token });
  assert.equal(again.status, 200);
  assert.equal(again.body.token, token);
  assert.equal(h.guestStore.rows.size, 1, 'the repeat start created nothing');
  assert.equal((await h.begin({ token, installation: 'installation-0000002' })).body.error, undefined, 'another installation starts its own');
  const used = await h.begin();
  assert.equal(used.status, 503);
  assert.equal(used.body.error, 'guest-scene-used');
  t.mock.timers.tick(29 * 86400_000);
  assert.equal((await h.begin({ address: '203.0.113.8' })).body.error, 'guest-scene-used');
  t.mock.timers.tick(86400_000 + 1000);
  // The ledger clock is the real Date.now, which the mock moves too.
  const later = await h.begin({ address: '203.0.113.9' });
  assert.equal(later.status, 200, JSON.stringify(later.body));
});

test('a spent ceiling refuses the start (read-only) without burning the installation', async () => {
  const h = harness({ ...PRODUCTION, LUVANI_GUEST_SCENE_DAILY: '1' });
  await h.guestScene.book(randomUUID());
  const r = await h.begin();
  assert.equal(r.body.error, 'guest-live-unavailable');
  assert.equal(await h.ledger.used(guestSceneKeys.day(Date.now())), 1, 'the start booked nothing');
  assert.ok(await h.ledger.reserveInstallation(guestSceneKeys.installation(privateSignal(SALT, 'installation', INSTALL)), 'x'), 'the marker was not taken');
});

test('with LUVANI_TRUST_PROXY off, a forged x-forwarded-for gets no fresh address budget', async () => {
  const h = harness();
  for (let i = 1; i <= 3; i++) assert.equal((await h.begin({ installation: `installation-forged-${i}`, forwarded: `198.51.100.${i}` })).status, 200);
  const fourth = await h.begin({ installation: 'installation-forged-4', forwarded: '198.51.100.250' });
  assert.equal(fourth.status, 429);
  assert.equal((await h.begin({ installation: 'installation-forged-5', address: '203.0.113.99' })).status, 200);
});

test('the scene grant signs exactly the contract fields; a bad mode is 400; churn and retries give one room; a claimed room is never reissued', async () => {
  const h = harness();
  const token = (await h.begin()).body.token as string;
  for (const body of [{}, { mode: 'convo' }, { mode: 'convo-text' }, { mode: 'lesson', brief }])
    assert.equal((await h.call('/onboarding/live', { token, body })).status, 400, JSON.stringify(body));
  const grant = await h.call('/onboarding/live', { token, body: { mode: 'lesson' } });
  assert.equal(grant.status, 200);
  assert.equal(grant.body.secondsRemaining, 180);
  const meta = claims(grant.body.token as string);
  assert.deepEqual(Object.keys(meta).sort(), ['guestLifecycleKey', 'lessonId', 'lifecycleVersion', 'memoryLocked', 'mode', 'scene', 'secondsRemaining', 'sessionId', 'tutorVoice']);
  assert.equal(meta.tutorVoice, 'emilie');
  assert.equal(meta.scene, 'guest-cafe'); assert.equal(meta.mode, 'lesson'); assert.equal(meta.lessonId, 'cafe-guest');
  assert.equal(meta.memoryLocked, true); assert.equal(meta.secondsRemaining, 180); assert.equal(meta.guestLifecycleKey, guestKey(token));
  for (const absent of ['firstPractice', 'seedTopic', 'missionId']) assert.equal(absent in meta, false);
  // A changed brief on a repeat start, and a retried grant in the other mode, keep the same room.
  await h.begin({ token, body: { brief: { ...brief, goals: ['food'], minutes: 15 } } });
  const retry = await h.call('/onboarding/live', { token, body: { mode: 'lesson-text' } });
  assert.equal(retry.body.roomName, grant.body.roomName);
  assert.equal(claims(retry.body.token as string).mode, 'lesson-text');
  const row = (await h.guestStore.get(guestKey(token)))!;
  await guestLiveOperation(h.guestStore, guestKey(token), 'claim', { userId: row.id, sessionId: row.live!.sessionId, roomName: row.live!.roomName, mode: 'lesson-text', claimNonce: randomUUID() }, Date.now(), h.guestScene);
  assert.equal(await h.ledger.used(guestSceneKeys.day(Date.now())), 1);
  assert.equal((await h.call('/onboarding/live', { token, body: { mode: 'lesson-text' } })).status, 409);
});

test('results and claim return the scene turns; the claim passes analytics consent, keeps D24 and shrinks the record; 409s are distinct', async () => {
  const h = harness();
  const token = (await h.begin()).body.token as string, key = guestKey(token);
  await h.call('/onboarding/live', { token, body: { mode: 'lesson' } });
  const row = (await h.guestStore.get(key))!, fence = randomUUID(), now = Date.now();
  const id = { userId: row.id, sessionId: row.live!.sessionId };
  await guestLiveOperation(h.guestStore, key, 'claim', { ...id, roomName: row.live!.roomName, mode: 'lesson', claimNonce: fence }, now, h.guestScene);
  const active = await h.call('/onboarding/claim', { token });
  assert.equal(active.status, 409); assert.equal(active.body.error, 'guest-active');
  const payload = { revision: 1, seconds: 0, learnerTurns: 2, serviceFailure: null, baseline: null, firstPracticeComplete: true, sceneTurns: ['t1-greet', 't2-order'] };
  await guestLiveOperation(h.guestStore, key, 'complete', { ...id, fence, ...payload, digest: tutorDigest(payload) }, now, h.guestScene);
  const result = await h.call('/onboarding/live-result', { token });
  assert.equal(result.body.scene, 'guest-cafe'); assert.deepEqual(result.body.sceneTurns, ['t1-greet', 't2-order']); assert.equal(result.body.pack, null);
  const claimed = await h.call('/onboarding/claim', { token });
  assert.equal(claimed.status, 200);
  assert.deepEqual(claimed.body.sceneTurns, ['t1-greet', 't2-order']);
  assert.deepEqual(h.trialCalls, [true], "the guest's analytics consent reaches the trial claim");
  const shrunk = (await h.guestStore.get(key))!;
  assert.equal(shrunk.live, undefined);
  assert.equal('goal' in shrunk, false);
  assert.ok(h.guestStore.ttlUntil.get(key)! - Date.now() <= 48 * 3600_000);
  const retry = await h.call('/onboarding/claim', { token });
  assert.equal(retry.status, 200); assert.deepEqual(retry.body.sceneTurns, ['t1-greet', 't2-order']);
  const elsewhere = await h.call('/onboarding/claim', { token, user: 'account-b' });
  assert.equal(elsewhere.status, 409); assert.equal(elsewhere.body.error, 'guest-claimed-elsewhere');

  const late = harness();
  const lateToken = (await late.begin()).body.token as string;
  await late.guestStore.update(guestKey(lateToken), r => { r.createdAt -= 31 * 86400_000; });
  const expired = await late.call('/onboarding/claim', { token: lateToken });
  assert.equal(expired.status, 409); assert.equal(expired.body.error, 'guest-expired');
});
