import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { checkStarter, starterTasks } from '@luvani/core';
import {
  ADJUST_SCRIPT,
  GUEST_SPEECH_LIMITS,
  MemoryGuestSpeechLedger,
  RESERVE_SCRIPT,
  RedisGuestSpeechLedger,
  claimGuestSpeech,
  guestSpeechAdmission,
  guestSpeechKeys,
  releaseUnclaimed,
  type GuestSpeechAdmission,
  type GuestSpeechLedger,
  type GuestSpeechReservation,
} from './guestSpeechAdmission.ts';
import { guestKey } from './onboardingGuest.ts';
import { privateSignal } from './rateLimit.ts';
import { keyShapeProblem } from './verify/upstashLive.ts';

const SALT = 'synthetic-guest-speech-salt';
const NOON = Date.UTC(2026, 9, 5, 12);
const NEXT_DAY = NOON + 86_400_000;
const address = (value: string) => privateSignal(SALT, 'ip', value);
const guestOn = (installation: string, ip: string, capability = installation) => ({
  guest: guestKey(`capability-${capability}`),
  installation: privateSignal(SALT, 'installation', installation),
  address: address(ip),
});
function reservation(decision: Awaited<ReturnType<ReturnType<typeof guestSpeechAdmission>['reserve']>>): GuestSpeechReservation {
  assert.equal(decision.kind, 'reserved', decision.kind === 'refused' ? decision.reason : '');
  return (decision as { reservation: GuestSpeechReservation }).reservation;
}

// The real /onboarding/attempt and /onboarding/audio branch of server.ts, run with
// in-memory admission and controlled edges, so the admission is proved where it is used.
const serverSource = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
const routeStart = serverSource.indexOf("      if (url.pathname === '/onboarding/attempt' || url.pathname === '/onboarding/audio') {");
const routeEnd = serverSource.indexOf("\n      return json(res, 404, { error: 'unknown starter route' });", routeStart);
assert.ok(routeStart >= 0 && routeEnd > routeStart, 'the guest attempt route moved');
const routeBody = stripTypeScriptTypes(`async function route() { ${serverSource.slice(routeStart, routeEnd)} }`);
const routeNames = ['url', 'guest', 'res', 'json', 'guestSpeechAvailable', 'process', 'readJson', 'req', 'starterTasks', 'guestSpeech',
  'guestSpeechSignals', 'token', 'installHash', 'guestAttempt', 'guestStore', 'readAudio', 'withRequestSignal', 'transcribeGuestTake',
  'checkStarter', 'releaseUnclaimed'];
const runRoute = new (Object.getPrototypeOf(async () => {}).constructor)(...routeNames, routeBody.slice(routeBody.indexOf('{') + 1, routeBody.lastIndexOf('}')));
/** One spoken take through the server's route. `attempt` runs when the route spends the learner's attempt. */
async function spokenTake(admission: GuestSpeechAdmission, signals: ReturnType<typeof guestOn>, attempt: () => Promise<void>, paid: (number | null)[]) {
  const reply: { status?: number; body?: Record<string, unknown> } = {};
  await runRoute(
    { pathname: '/onboarding/audio' }, { expiresAt: Date.now() + 60_000, goal: 'food', drink: 'coffee', minutes: 5 }, {},
    (_res: unknown, status: number, body: Record<string, unknown>) => { reply.status = status; reply.body = body; },
    () => true, { env: {} }, async () => ({}), { headers: { 'x-luvani-task': 'drink', 'x-luvani-active-seconds': '5' } },
    starterTasks, admission, () => signals, 'synthetic-capability', signals.installation,
    async () => { await attempt(); return { secondsUsed: 5 }; }, {}, async () => Buffer.from('RIFF0000WAVEfmt '),
    async (_req: unknown, _res: unknown, work: (signal: AbortSignal) => Promise<unknown>) => work(new AbortController().signal),
    async (_take: Uint8Array, admitted: GuestSpeechReservation) => { paid.push(claimGuestSpeech(admitted)); await admitted.settle(3); return 'Un café, merci.'; },
    checkStarter, releaseUnclaimed,
  );
  return reply;
}

test('guest speech is admitted only within its per-guest, per-installation, per-address and daily limits', async () => {
  const ledger = new MemoryGuestSpeechLedger(() => NOON);
  const admission = guestSpeechAdmission(ledger, { ...GUEST_SPEECH_LIMITS, globalDailySeconds: 400 });
  assert.deepEqual(
    { attempt: GUEST_SPEECH_LIMITS.attemptSeconds, guest: GUEST_SPEECH_LIMITS.guestSeconds, installation: GUEST_SPEECH_LIMITS.installationDailySeconds, address: GUEST_SPEECH_LIMITS.addressDailySeconds, global: GUEST_SPEECH_LIMITS.globalDailySeconds },
    { attempt: 20, guest: 60, installation: 60, address: 300, global: 3600 },
  );

  // Per guest: three twenty-second takes make the sixty seconds, and the fourth is refused.
  const first = guestOn('phone-a', '198.51.100.7');
  for (let take = 0; take < 3; take++) reservation(await admission.reserve(first, NOON));
  assert.deepEqual(await admission.reserve(first, NOON), { kind: 'refused', reason: 'guest-budget' });

  // Per installation per day: another capability on the same phone the same day is refused.
  const again = guestOn('phone-a', '198.51.100.7', 'phone-a-second');
  assert.deepEqual(await admission.reserve(again, NOON), { kind: 'refused', reason: 'installation-budget' });

  // Per address per day: five phones behind one address use its three hundred seconds.
  for (const phone of ['phone-b', 'phone-c', 'phone-d', 'phone-e']) {
    for (let take = 0; take < 3; take++) reservation(await admission.reserve(guestOn(phone, '198.51.100.7'), NOON));
  }
  const crowded = guestOn('phone-f', '198.51.100.7');
  assert.deepEqual(await admission.reserve(crowded, NOON), { kind: 'refused', reason: 'address-budget' });
  // A refusal books nothing on any budget.
  assert.deepEqual(await ledger.used(guestSpeechKeys(crowded, NOON)), { guest: 0, installation: 0, address: 300, global: 300 });

  // Daily ceiling: five more takes from elsewhere reach four hundred seconds, then every guest is refused.
  for (let take = 0; take < 3; take++) reservation(await admission.reserve(guestOn('phone-g', '203.0.113.9'), NOON));
  for (let take = 0; take < 2; take++) reservation(await admission.reserve(guestOn('phone-h', '203.0.113.10'), NOON));
  const fresh = guestOn('phone-i', '192.0.2.44');
  assert.deepEqual(await admission.reserve(fresh, NOON), { kind: 'refused', reason: 'global-budget' });
  assert.equal(await admission.open(fresh, NOON), false);

  // The next UTC day opens the daily budgets again, but a capability's total never resets.
  assert.equal(await admission.open(fresh, NEXT_DAY), true);
  assert.deepEqual(await admission.reserve(first, NEXT_DAY), { kind: 'refused', reason: 'guest-budget' });
  reservation(await admission.reserve(guestOn('phone-a', '198.51.100.7', 'phone-a-tomorrow'), NEXT_DAY));

  // The server's route books a take on all four budgets before it spends the learner's attempt,
  // pays the transcription with that reservation, and a full budget never reaches the attempt.
  const routeLedger = new MemoryGuestSpeechLedger();
  const routeAdmission = guestSpeechAdmission(routeLedger);
  const speaker = guestOn('phone-route', '198.51.100.70');
  const booked = () => routeLedger.used(guestSpeechKeys(speaker, Date.now()));
  const seen: Record<string, number>[] = [];
  const paid: (number | null)[] = [];
  const spoken = await spokenTake(routeAdmission, speaker, async () => { seen.push(await booked()); }, paid);
  assert.equal(spoken.status, 200);
  assert.equal(spoken.body?.reply, 'Un café, merci.');
  assert.deepEqual(seen, [{ guest: 20, installation: 20, address: 20, global: 20 }], 'the route spent the attempt before it reserved speech');
  assert.deepEqual(paid, [20], 'the transcription was not paid by the reservation the route booked');
  assert.equal((await booked()).guest, 3);
  for (let take = 0; take < 2; take++) reservation(await routeAdmission.reserve(speaker));
  const full = await spokenTake(routeAdmission, speaker, async () => { seen.push(await booked()); }, paid);
  assert.deepEqual(full, { status: 503, body: { error: 'guest speech unavailable; type instead' } });
  assert.equal(seen.length, 1, 'a refused take spent an attempt');
  assert.equal(paid.length, 1, 'a refused take reached transcription');
});

test('a guest speech reservation settles once, returns what was not sent and never books less than was used', async () => {
  const ledger = new MemoryGuestSpeechLedger(() => NOON);
  const admission = guestSpeechAdmission(ledger);
  const guest = guestOn('phone-a', '198.51.100.7');
  const used = async () => (await ledger.used(guestSpeechKeys(guest, NOON))).guest;

  const short = reservation(await admission.reserve(guest, NOON));
  assert.equal(await used(), 20);
  await short.settle(4.2);
  assert.equal(await used(), 5);
  await short.settle(0);
  assert.equal(await used(), 5, 'a second settlement moved the budget');

  await reservation(await admission.reserve(guest, NOON)).settle(0);
  assert.equal(await used(), 5);
  await reservation(await admission.reserve(guest, NOON)).settle(26);
  assert.equal(await used(), 31);
  await reservation(await admission.reserve(guest, NOON)).settle(Number.NaN);
  assert.equal(await used(), 51, 'an unknown use kept the whole reservation');
  assert.deepEqual(await admission.reserve(guest, NOON), { kind: 'refused', reason: 'guest-budget' });

  // Only a reservation this module issued pays for a take, and only once.
  const other = reservation(await admission.reserve(guestOn('phone-b', '198.51.100.8'), NOON));
  assert.equal(claimGuestSpeech(other), 20);
  assert.equal(claimGuestSpeech(other), null);
  assert.equal(claimGuestSpeech({ seconds: 20, settle: async () => {} }), null);

  // A ledger that cannot settle errs towards less speech and never throws at the learner.
  const failing: GuestSpeechLedger = {
    reserve: async () => null,
    adjust: async () => { throw new Error('store unavailable'); },
    used: async () => ({ guest: 0, installation: 0, address: 0, global: 0 }),
  };
  await reservation(await guestSpeechAdmission(failing).reserve(guest, NOON)).settle(1);
});

test('an unclaimed guest speech reservation is returned whole and can no longer pay for a take', async () => {
  const ledger = new MemoryGuestSpeechLedger(() => NOON);
  const admission = guestSpeechAdmission(ledger);
  const guest = guestOn('phone-a', '198.51.100.7');
  const used = async () => ledger.used(guestSpeechKeys(guest, NOON));

  // The request ended before its work began: nothing claimed the take, so all four budgets get it back.
  const unstarted = reservation(await admission.reserve(guest, NOON));
  assert.deepEqual(await used(), { guest: 20, installation: 20, address: 20, global: 20 });
  assert.equal(await releaseUnclaimed(unstarted), true);
  assert.deepEqual(await used(), { guest: 0, installation: 0, address: 0, global: 0 });
  assert.equal(claimGuestSpeech(unstarted), null, 'a returned reservation could still pay for a take');
  assert.equal(await releaseUnclaimed(unstarted), false);

  // A claimed take may be with the vendor: releasing it changes nothing, and its own settlement counts.
  const inFlight = reservation(await admission.reserve(guest, NOON));
  assert.equal(claimGuestSpeech(inFlight), 20);
  assert.equal(await releaseUnclaimed(inFlight), false);
  assert.equal((await used()).guest, 20, 'a take in flight was undercounted');
  await inFlight.settle(7);
  assert.equal((await used()).guest, 7);

  // A reservation this module did not issue is never settled by a release.
  let forgedSettles = 0;
  assert.equal(await releaseUnclaimed({ seconds: 20, settle: async () => { forgedSettles++; } }), false);
  assert.equal(forgedSettles, 0);
});

test('a guest speech refusal by the service-wide budget is logged once a day without any guest signal', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  let now = NOON;
  const ledger = new MemoryGuestSpeechLedger(() => now);
  const admission = guestSpeechAdmission(ledger, { ...GUEST_SPEECH_LIMITS, globalDailySeconds: 100 });
  const one = guestOn('phone-a', '198.51.100.7');
  const two = guestOn('phone-b', '203.0.113.9');
  const three = guestOn('phone-c', '192.0.2.44');

  // A budget that is only one guest's is not the operator's news.
  for (let take = 0; take < 3; take++) reservation(await admission.reserve(one, now));
  assert.deepEqual(await admission.reserve(one, now), { kind: 'refused', reason: 'guest-budget' });
  assert.equal(await admission.open(one, now), false);
  // Filling the ceiling exactly is an admission, not a refusal.
  for (let take = 0; take < 2; take++) reservation(await admission.reserve(two, now));
  assert.equal(warn.mock.callCount(), 0);

  // The next start is told speech is closed by the ceiling: that is logged, with no guest signal in it.
  assert.equal(await admission.open(three, now), false);
  assert.equal(warn.mock.callCount(), 1);
  const message = String(warn.mock.calls[0]?.arguments[0]);
  assert.match(message, /service-wide/);
  assert.match(message, /100/);
  for (const signal of [...Object.values(one), ...Object.values(three), '198.51.100.7', '192.0.2.44', 'phone-c']) {
    assert.ok(!message.includes(signal), 'a guest signal reached the log');
  }

  // Further refusals the same day, on a take or a start, are not repeated.
  assert.deepEqual(await admission.reserve(two, now), { kind: 'refused', reason: 'global-budget' });
  assert.equal(await admission.open(two, now), false);
  assert.equal(warn.mock.callCount(), 1);

  // A refusal by the ceiling on another day is logged again.
  now = NEXT_DAY;
  for (let take = 0; take < 3; take++) reservation(await admission.reserve(guestOn('phone-d', '192.0.2.45'), now));
  for (let take = 0; take < 2; take++) reservation(await admission.reserve(guestOn('phone-e', '192.0.2.46'), now));
  assert.equal(warn.mock.callCount(), 1);
  assert.deepEqual(await admission.reserve(guestOn('phone-f', '192.0.2.47'), now), { kind: 'refused', reason: 'global-budget' });
  assert.equal(warn.mock.callCount(), 2);
});

test('the durable guest speech ledger books every budget in one script under hashed keys only', async () => {
  const commands: unknown[][] = [];
  let next: unknown = 0;
  let status = 200;
  const request = (async (_url: unknown, init?: RequestInit) => {
    commands.push(JSON.parse(String(init?.body)) as unknown[]);
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer synthetic-token');
    return new Response(JSON.stringify(typeof next === 'object' && next !== null && 'error' in next ? next : { result: next }), { status });
  }) as typeof fetch;
  const ledger = new RedisGuestSpeechLedger('https://redis.invalid/', 'synthetic-token', request);
  const admission = guestSpeechAdmission(ledger);
  const guest = guestOn('phone-a', '198.51.100.7');
  const keys = guestSpeechKeys(guest, NOON);
  const ordered = [keys.guest, keys.installation, keys.address, keys.global];

  const admitted = reservation(await admission.reserve(guest, NOON));
  assert.deepEqual(commands.at(-1), ['EVAL', RESERVE_SCRIPT, '4', ...ordered, '20', '60', '60', '300', '3600', '172800']);
  await admitted.settle(3.5);
  assert.deepEqual(commands.at(-1), ['EVAL', ADJUST_SCRIPT, '4', ...ordered, '-16']);

  next = 3;
  assert.deepEqual(await admission.reserve(guest, NOON), { kind: 'refused', reason: 'address-budget' });
  next = 4;
  assert.deepEqual(await admission.reserve(guest, NOON), { kind: 'refused', reason: 'global-budget' });
  next = 9;
  await assert.rejects(admission.reserve(guest, NOON));
  next = ['5', null, '5', '305'];
  assert.deepEqual(await ledger.used(keys), { guest: 5, installation: 0, address: 5, global: 305 });
  next = ['5', 'x', '5', '5'];
  await assert.rejects(ledger.used(keys));
  next = { error: 'NOSCRIPT' };
  await assert.rejects(admission.reserve(guest, NOON));
  next = 0; status = 503;
  await assert.rejects(admission.reserve(guest, NOON));
  // A store that cannot answer opens nothing; the server offers typing instead.
  await assert.rejects(admission.open(guest, NOON));

  // Every key is a fixed literal, a UTC day or a hash: no address, installation or capability in the clear.
  for (const key of ordered) assert.equal(keyShapeProblem(key), null, key.split(':').slice(0, 3).join(':'));
  for (const raw of ['198.51.100.7', 'phone-a', 'capability-phone-a']) {
    assert.ok(commands.every((command) => !JSON.stringify(command).includes(raw)), 'a raw signal reached the store');
  }
  assert.ok(keyShapeProblem('luvani:guest-speech:address:2026-10-05:198.51.100.7'));
  assert.ok(keyShapeProblem('luvani:guest-speech:guest:capability-phone-a'));
  assert.throws(() => guestSpeechKeys({ ...guest, address: '198.51.100.7' }, NOON));
});
