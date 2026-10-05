import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { STARTER_GOALS, checkStarter, secondsRemaining, starterTasks } from '@luvani/core';
import { MemoryGuestStore, claimGuest, createGuest, guestAttempt, guestKey } from './onboardingGuest.ts';
import { GUEST_SPEECH_LIMITS, MemoryGuestSpeechLedger, guestSpeechAdmission, guestSpeechKeys, type GuestSpeechReservation } from './guestSpeechAdmission.ts';
import { guestSpeechAvailable, transcribeGuestTake } from './onboardingSpeech.ts';
import { parseGuestMetric } from './guestMetrics.ts';
import { privateSignal } from './rateLimit.ts';

// Execute the real /onboarding/ branch of server.ts with in-memory stores and
// controlled HTTP edges. This is not a hosted server or socket test.
const source = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
const start = source.indexOf("    if (req.method === 'POST' && url.pathname.startsWith('/onboarding/')) {");
const end = source.indexOf("\n    // RevenueCat's event is a doorbell", start);
assert.ok(start >= 0 && end > start);
const stripped = stripTypeScriptTypes(`async function branch() { ${source.slice(start, end)} }`);
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const names = ['req', 'url', 'res', 'json', 'installationSignal', 'privateSignal', 'rateLimitSalt', 'withinLimits', 'ipCheck',
  'GUEST_START_LIMIT', 'GUEST_EVENT_LIMIT', 'GUEST_REPLY_LIMIT', 'readJson', 'STARTER_GOALS', 'createGuest', 'guestStore',
  'guestSpeechAvailable', 'process', 'guestSpeech', 'guestSpeechSignals', 'users', 'parseGuestMetric', 'guestKey', 'claimGuest',
  'claimTrialWithEvidence', 'store', 'eventSink', 'secondsRemaining', 'starterTasks', 'guestAttempt', 'readAudio',
  'withRequestSignal', 'transcribeGuestTake', 'checkStarter'];
const run = new AsyncFunction(...names, stripped.slice(stripped.indexOf('{') + 1, stripped.lastIndexOf('}')));

const SALT = 'isolated-route-test-salt';
const ADDRESS = '198.51.100.23';
const local = { LUVANI_LOCAL_DEVELOPMENT: '1', DEEPGRAM_API_KEY: 'synthetic-key' };

function harness(env: Record<string, string>, globalDailySeconds: number) {
  const guestStore = new MemoryGuestStore();
  const ledger = new MemoryGuestSpeechLedger();
  const guestSpeech = guestSpeechAdmission(ledger, { ...GUEST_SPEECH_LIMITS, globalDailySeconds });
  let vendorCalls = 0;
  const request: typeof fetch = async () => {
    vendorCalls++;
    return Response.json({ metadata: { duration: 3.2 }, results: { channels: [{ alternatives: [{ transcript: 'Un café, merci.' }] }] } });
  };
  async function call(path: string, options: { installation: string; token?: string; body?: Record<string, unknown>; audio?: Uint8Array; task?: string }) {
    const reply: { status?: number; body?: Record<string, unknown> } = {};
    const req = {
      method: 'POST',
      headers: { ...(options.token ? { 'x-luvani-guest': options.token } : {}), ...(options.task ? { 'x-luvani-task': options.task } : {}), 'x-luvani-active-seconds': '5' },
      socket: { remoteAddress: ADDRESS },
    };
    const values = [
      req, { pathname: path, search: '' }, {},
      (_res: unknown, status: number, value: Record<string, unknown>) => { reply.status = status; reply.body = value; },
      () => options.installation, privateSignal, SALT, async () => true, () => [],
      {}, {}, {}, async () => options.body ?? {}, STARTER_GOALS, createGuest, guestStore,
      guestSpeechAvailable, { env }, guestSpeech,
      // server.ts derives the same three hashed signals; its helper is checked by source below.
      (request: typeof req, token: string, installHash: string) => ({ guest: guestKey(token), installation: installHash, address: privateSignal(SALT, 'ip', request.socket.remoteAddress) }),
      {}, parseGuestMetric, guestKey, claimGuest, async () => false, {}, null, secondsRemaining, starterTasks, guestAttempt,
      async () => options.audio ?? new Uint8Array(),
      async (_req: unknown, _res: unknown, work: (signal: AbortSignal) => Promise<unknown>) => work(new AbortController().signal),
      (take: Uint8Array, admitted: GuestSpeechReservation, signal: AbortSignal) => transcribeGuestTake(take, admitted, signal, env, { request }),
      checkStarter,
    ];
    await run(...values);
    return reply;
  }
  const begin = (installation: string) => call('/onboarding/start', { installation, body: { eligible: true, goal: 'food', drink: 'coffee', minutes: 5 } });
  const used = (token: string, installation: string) => ledger.used(guestSpeechKeys({
    guest: guestKey(token), installation: privateSignal(SALT, 'installation', installation), address: privateSignal(SALT, 'ip', ADDRESS),
  }, Date.now()));
  return { call, begin, used, guestStore, vendorCalls: () => vendorCalls };
}

test('server.ts budgets guest speech on the hashed capability, installation and address', () => {
  assert.match(source, /function guestSpeechSignals\(req: IncomingMessage, token: string, installHash: string\)[^\n]*\n\s*return \{ guest: guestKey\(token\), installation: installHash, address: privateSignal\(rateLimitSalt, 'ip', clientIp\(req, trustProxy\)\) \};/);
  assert.match(source, /new RedisGuestSpeechLedger\(process\.env\.UPSTASH_REDIS_REST_URL, process\.env\.UPSTASH_REDIS_REST_TOKEN\)/);
});

test('a refused guest speech take spends no attempt and the learner can still type', async () => {
  const route = harness(local, 20);
  const installation = 'route-installation-0001';
  const started = await route.begin(installation);
  assert.equal(started.status, 200);
  assert.equal(started.body?.speechAvailable, true);
  const token = started.body?.token as string;
  const audio = Buffer.from('RIFF0000WAVEfmt ');

  // The first take is admitted, transcribed and settled to the reported duration.
  const spoken = await route.call('/onboarding/audio', { installation, token, audio, task: 'drink' });
  assert.equal(spoken.status, 200);
  assert.equal(spoken.body?.reply, 'Un café, merci.');
  assert.equal((await route.used(token, installation)).global, 4);

  // The day's ceiling now has no room for another twenty seconds: speech is refused before the attempt.
  const refused = await route.call('/onboarding/audio', { installation, token, audio, task: 'drink' });
  assert.deepEqual(refused, { status: 503, body: { error: 'guest speech unavailable; type instead' } });
  assert.equal(route.vendorCalls(), 1);
  assert.deepEqual((await route.guestStore.get(guestKey(token)))?.attempts, { drink: 1 });
  assert.equal((await route.used(token, installation)).global, 4);

  // The second attempt is still the learner's, typed.
  const typed = await route.call('/onboarding/attempt', { installation, token, body: { taskId: 'drink', reply: 'Un café, merci.', activeSeconds: 5 } });
  assert.equal(typed.status, 200);
  assert.equal(typed.body?.accepted, true);

  // A new guest is told up front that speech is closed, and types from the start.
  const later = await route.begin('route-installation-0002');
  assert.equal(later.status, 200);
  assert.equal(later.body?.speechAvailable, false);
});

test('a guest speech take that cannot use its attempt or its audio returns its reservation', async () => {
  const route = harness(local, 3600);
  const installation = 'route-installation-0003';
  const token = (await route.begin(installation)).body?.token as string;
  const audio = Buffer.from('RIFF0000WAVEfmt ');
  assert.equal((await route.call('/onboarding/audio', { installation, token, audio: new Uint8Array(), task: 'drink' })).status, 400);
  assert.equal((await route.used(token, installation)).guest, 0);
  assert.equal((await route.call('/onboarding/audio', { installation, token, audio, task: 'drink' })).status, 200);
  const limit = await route.call('/onboarding/audio', { installation, token, audio, task: 'drink' });
  assert.equal(limit.status, 409);
  assert.equal((await route.used(token, installation)).guest, 4);
  assert.equal(route.vendorCalls(), 1);
});

test('production guest audio without its admission context books nothing and reaches no vendor', async () => {
  const route = harness({ NODE_ENV: 'production', DEEPGRAM_API_KEY: 'synthetic-key', LUVANI_LOCAL_DEVELOPMENT: '1' }, 3600);
  const installation = 'route-installation-0004';
  const started = await route.begin(installation);
  assert.equal(started.body?.speechAvailable, false);
  const token = started.body?.token as string;
  const refused = await route.call('/onboarding/audio', { installation, token, audio: Buffer.from('RIFF0000WAVEfmt '), task: 'drink' });
  assert.deepEqual(refused, { status: 503, body: { error: 'guest speech unavailable; type instead' } });
  assert.deepEqual(await route.used(token, installation), { guest: 0, installation: 0, address: 0, global: 0 });
  assert.deepEqual((await route.guestStore.get(guestKey(token)))?.attempts, {});
  assert.equal(route.vendorCalls(), 0);
});
