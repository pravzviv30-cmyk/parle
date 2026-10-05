import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guestSpeechAvailable, guestSpeechDailySeconds, guestSpeechGaps, transcribeGuestTake } from './onboardingSpeech.ts';
import { MemoryGuestSpeechLedger, guestSpeechAdmission, guestSpeechKeys, type GuestSpeechAdmission, type GuestSpeechReservation } from './guestSpeechAdmission.ts';
import { guestKey } from './onboardingGuest.ts';
import { privateSignal } from './rateLimit.ts';
import { pcmWav } from '../../shared/audioDecode.ts';

const audio = Buffer.from('RIFF0000WAVEfmt ');
const local = { LUVANI_LOCAL_DEVELOPMENT: '1', DEEPGRAM_API_KEY: 'synthetic-key' };
const production = {
  NODE_ENV: 'production',
  LUVANI_GUEST_SPEECH: '1',
  DEEPGRAM_API_KEY: 'synthetic-key',
  UPSTASH_REDIS_REST_URL: 'https://redis.invalid',
  UPSTASH_REDIS_REST_TOKEN: 'synthetic-token',
  LUVANI_AUDIO_DECODER_PATH: '/usr/local/bin/luvani-ffmpeg',
  LUVANI_AUDIO_DECODER_SHA256: 'a'.repeat(64),
};
const signals = (n: number) => ({
  guest: guestKey(`synthetic-capability-${n}`),
  installation: privateSignal('synthetic-salt', 'installation', `installation-${n}`),
  address: privateSignal('synthetic-salt', 'ip', `198.51.100.${n}`),
});
async function admitted(admission: GuestSpeechAdmission, n: number): Promise<GuestSpeechReservation> {
  const decision = await admission.reserve(signals(n));
  assert.equal(decision.kind, 'reserved');
  return (decision as { reservation: GuestSpeechReservation }).reservation;
}
const without = (name: keyof typeof production) => Object.fromEntries(Object.entries(production).filter(([key]) => key !== name));

test('production guest speech cannot bypass authenticated paid admission even with local flags and keys', async () => {
  let calls = 0;
  const request: typeof fetch = async () => { calls++; return Response.json({}); };
  const decode = async () => { calls++; return { wav: pcmWav(new Uint8Array(32_000)), audioMillis: 1000 }; };
  const ledger = new MemoryGuestSpeechLedger();
  const admission = guestSpeechAdmission(ledger);
  const refused = [
    {}, { DEEPGRAM_API_KEY: 'synthetic-key' }, { ...local, NODE_ENV: 'production' },
    // Local flags never open production, even beside every production piece.
    { ...production, LUVANI_LOCAL_DEVELOPMENT: '1' },
    // A key alone opens nothing: each missing piece of the guest admission context keeps it shut.
    without('LUVANI_GUEST_SPEECH'), without('DEEPGRAM_API_KEY'), without('UPSTASH_REDIS_REST_TOKEN'),
    without('LUVANI_AUDIO_DECODER_PATH'), { ...production, LUVANI_GUEST_SPEECH: 'true' },
    { ...production, LUVANI_GUEST_SPEECH_DAILY_SECONDS: 'unlimited' },
  ];
  for (const [n, env] of refused.entries()) {
    assert.equal(guestSpeechAvailable(env), false);
    assert.ok(guestSpeechGaps(env).length > 0);
    assert.equal(await transcribeGuestTake(audio, await admitted(admission, n), new AbortController().signal, env, { request, decode }), null);
    // Nothing was sent, so the whole reservation came back.
    assert.equal((await ledger.used(guestSpeechKeys(signals(n), Date.now()))).global, 0);
  }
  assert.equal(calls, 0);
  // Fully configured, the key still sends nothing without a reservation the guest admission issued.
  assert.equal(guestSpeechAvailable(production), true);
  const forged: GuestSpeechReservation = { seconds: 20, settle: async () => {} };
  assert.equal(await transcribeGuestTake(audio, forged, new AbortController().signal, production, { request, decode }), null);
  assert.equal(calls, 0);
});

test('explicit local guest speech shares bounded transcription and stops before sending aborted audio', async () => {
  let calls = 0;
  const request: typeof fetch = async (_url, init) => {
    calls++;
    assert.equal(init?.body, audio);
    assert.ok(init?.signal);
    return Response.json({ results: { channels: [{ alternatives: [{ transcript: 'Un café, merci.' }] }] } });
  };
  const admission = guestSpeechAdmission(new MemoryGuestSpeechLedger());
  assert.equal(guestSpeechAvailable(local), true);
  assert.equal(await transcribeGuestTake(audio, await admitted(admission, 1), new AbortController().signal, local, { request }), 'Un café, merci.');
  assert.equal(await transcribeGuestTake(audio, await admitted(admission, 2), AbortSignal.abort(), local, { request }), null);
  assert.equal(await transcribeGuestTake(Buffer.alloc(2 * 1024 * 1024 + 1), await admitted(admission, 3), new AbortController().signal, local, { request }), null);
  assert.equal(calls, 1);
});

test('production guest speech sends only the reserved seconds of a decoded take and settles to what was sent', async () => {
  const ledger = new MemoryGuestSpeechLedger();
  const admission = guestSpeechAdmission(ledger);
  const sent: number[] = [];
  let answer: Response | Error = Response.json({ metadata: { duration: 99 }, results: { channels: [{ alternatives: [{ transcript: 'Un café, merci.' }] }] } });
  const request: typeof fetch = async (_url, init) => {
    sent.push((init?.body as Uint8Array).byteLength);
    if (answer instanceof Error) throw answer;
    return answer.clone();
  };
  const decodedSeconds = (seconds: number) => async () => ({ wav: pcmWav(new Uint8Array(Math.round(seconds * 32_000))), audioMillis: seconds * 1000 });
  const guestUsed = async (n: number) => (await ledger.used(guestSpeechKeys(signals(n), Date.now()))).guest;

  // A take longer than the capture cap is cut to the twenty reserved seconds before it leaves.
  assert.equal(await transcribeGuestTake(audio, await admitted(admission, 1), new AbortController().signal, production, { request, decode: decodedSeconds(25) }), 'Un café, merci.');
  assert.deepEqual(sent, [44 + 20 * 32_000]);
  assert.equal(await guestUsed(1), 20);

  // A short take settles to its decoded length, rounded up, not to the vendor's claim or the reservation.
  assert.equal(await transcribeGuestTake(audio, await admitted(admission, 2), new AbortController().signal, production, { request, decode: decodedSeconds(3.2) }), 'Un café, merci.');
  assert.equal(await guestUsed(2), 4);

  // A take that cannot be decoded is never sent and returns its reservation.
  const refusedDecode = async () => { throw new Error('audio-decode-refused'); };
  assert.equal(await transcribeGuestTake(audio, await admitted(admission, 3), new AbortController().signal, production, { request, decode: refusedDecode }), null);
  assert.equal(sent.length, 2);
  assert.equal(await guestUsed(3), 0);

  // A take the vendor received but failed still counts what was sent.
  answer = new Error('vendor unavailable');
  assert.equal(await transcribeGuestTake(audio, await admitted(admission, 4), new AbortController().signal, production, { request, decode: decodedSeconds(6) }), null);
  assert.equal(sent.length, 3);
  assert.equal(await guestUsed(4), 6);

  // One reservation pays for one take; reusing it sends nothing more.
  const once = await admitted(admission, 5);
  answer = Response.json({ results: { channels: [{ alternatives: [{ transcript: 'Merci.' }] }] } });
  assert.equal(await transcribeGuestTake(audio, once, new AbortController().signal, production, { request, decode: decodedSeconds(2) }), 'Merci.');
  assert.equal(await transcribeGuestTake(audio, once, new AbortController().signal, production, { request, decode: decodedSeconds(2) }), null);
  assert.equal(sent.length, 4);
  assert.equal(await guestUsed(5), 2);
});

test('local guest speech settles to the duration the transcription reports, and keeps the reservation when none is reported', async () => {
  const ledger = new MemoryGuestSpeechLedger();
  const admission = guestSpeechAdmission(ledger);
  const reply = (metadata: unknown) => (async () => Response.json({ metadata, results: { channels: [{ alternatives: [{ transcript: 'Bonjour.' }] }] } })) as typeof fetch;
  const guestUsed = async (n: number) => (await ledger.used(guestSpeechKeys(signals(n), Date.now()))).guest;
  await transcribeGuestTake(audio, await admitted(admission, 1), new AbortController().signal, local, { request: reply({ duration: 2.4 }) });
  assert.equal(await guestUsed(1), 3);
  // Never below what was used: a longer report books the longer time.
  await transcribeGuestTake(audio, await admitted(admission, 2), new AbortController().signal, local, { request: reply({ duration: 27 }) });
  assert.equal(await guestUsed(2), 27);
  await transcribeGuestTake(audio, await admitted(admission, 3), new AbortController().signal, local, { request: reply({}) });
  assert.equal(await guestUsed(3), 20);
});

test('the guest speech daily ceiling defaults conservatively and refuses a malformed value', () => {
  assert.equal(guestSpeechDailySeconds({}), 3600);
  assert.equal(guestSpeechDailySeconds({ LUVANI_GUEST_SPEECH_DAILY_SECONDS: '1800' }), 1800);
  for (const value of ['0', '-5', '1.5', '86401', '1e4', 'unlimited', '0900']) {
    assert.equal(guestSpeechDailySeconds({ LUVANI_GUEST_SPEECH_DAILY_SECONDS: value }), null, value);
  }
  assert.deepEqual(guestSpeechGaps({ ...production, LUVANI_GUEST_SPEECH_DAILY_SECONDS: '1800' }), []);
  // The gaps name settings, never their values.
  assert.ok(guestSpeechGaps({ NODE_ENV: 'production', DEEPGRAM_API_KEY: 'synthetic-key' }).every((gap) => !gap.includes('synthetic')));
});
