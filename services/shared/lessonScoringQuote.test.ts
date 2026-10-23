/** F863: live lesson and convo scoring through the paid transport, offline with a fake admission RPC and a stub vendor. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { CONVO_SCORING_COMPONENT, LESSON_SCORING_COMPONENT, LESSON_SCORING_MAX_CALL_MILLIS } from './lessonScoringQuote.ts';
import { paidAdmission, type PaidComponent, type PaidKind, type PaidRpc } from './paidAdmission.ts';
import { describePaidHttp, paidProviderFetch, reservationGate, SCORING_MAX_WAV_BYTES } from './paidExecution.ts';
import { SCORING_MAX_SAMPLES, toSpeechaceWav } from './liveScoringAudio.ts';
import { scoreWithSpeechace } from './speechace.ts';
import type { ScoreFetch } from './pronunciation.ts';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
/** A 48 kHz stereo 16-bit PCM capture the way the utterance tap writes one (silence is enough here). */
function capture(seconds: number): Uint8Array {
  const bytes = Math.round(48000 * seconds) * 4, b = Buffer.alloc(44 + bytes);
  b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(36 + bytes, 4); b.write('WAVE', 8, 'ascii'); b.write('fmt ', 12, 'ascii');
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(48000, 24); b.writeUInt32LE(192000, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36, 'ascii'); b.writeUInt32LE(bytes, 40);
  return b;
}
const full = toSpeechaceWav(capture(30));
const LLM: PaidComponent = { key: 'brain', kind: 'llm', provider: 'openai', model: 'synthetic-model', voice: '', configurationSha256: hash('llm'), maxEffects: 64, maxProviderAttempts: 1, maxInputBytes: 2097152, maxOutputTokens: 100000, maxAudioMillis: 0, maxTextBytes: 0, microUsd: 1 };
const STT: PaidComponent = { key: 'stt', kind: 'stt', provider: 'deepgram', model: 'nova-3', voice: '', configurationSha256: hash('stt'), maxEffects: 64, maxProviderAttempts: 1, maxInputBytes: 2097152, maxOutputTokens: 0, maxAudioMillis: 900000, maxTextBytes: 0, microUsd: 1 };
const TTS: PaidComponent = { key: 'tts', kind: 'tts', provider: 'elevenlabs', model: 'eleven_flash_v2_5', voice: 'voice', configurationSha256: hash('tts'), maxEffects: 64, maxProviderAttempts: 1, maxInputBytes: 0, maxOutputTokens: 0, maxAudioMillis: 0, maxTextBytes: 262144, microUsd: 1 };
const quoteId = '40000000-0000-4000-8000-000000000863', configurationSha256 = hash('lesson-quote');

function harness(components: PaidComponent[], kinds?: PaidKind[], activity: 'lesson' | 'convo' = 'lesson') {
  const userId = randomUUID(), sessionId = randomUUID(), claimNonce = randomUUID(), operationId = randomUUID(), claims: Record<string, unknown>[] = [];
  const rpc: PaidRpc = async (name, args) => {
    if (name === 'resume_paid_tutor_v1') return { kind: 'reserved', version: 1, operationId, activity, requestDigest: hash('digest'), quoteId, configurationSha256, components, expiresAt: new Date(Date.now() + 3600000).toISOString(), microUsd: components.reduce((n, c) => n + c.microUsd, 0), providerCalls: components.reduce((n, c) => n + c.maxEffects * c.maxProviderAttempts, 0), replayed: true, day: new Date().toISOString().slice(0, 10) };
    if (name !== 'claim_paid_effect_v1') throw new Error(`unexpected ${name}`);
    claims.push(args);
    // Robust near midnight: the execution day is the day the permit ends in, so dispatchUntil never passes it.
    const until = Date.now() + 60000, component = components.find(c => c.key === args.p_component_key)!;
    return { kind: 'claimed', version: 1, operationId, effectId: args.p_effect_id, componentKey: args.p_component_key, dispatch: true, dispatchUntil: new Date(until).toISOString(), executionDay: new Date(until).toISOString().slice(0, 10), executionMicroUsdCharged: claims.length === 1 ? component.microUsd : 0, executionProviderCalls: 1 };
  };
  const vendor: string[] = [];
  const stub = (async (url: string | URL) => { vendor.push(String(url)); return new Response(JSON.stringify({ text_score: { word_score_list: [{ word: 'bonjour', phone_score_list: [{ phone: 'b', quality_score: 90 }] }] } }), { status: 200 }); }) as typeof fetch;
  const binding = { quoteId, configurationSha256, ...(kinds ? { kinds } : {}) };
  return {
    claims, vendor,
    async transport(): Promise<ScoreFetch> {
      const reservation = await paidAdmission({ rpc, bindings: { [activity]: binding } }).resume({ userId, sessionId, claimNonce });
      return paidProviderFetch(reservationGate(reservation, { kind: 'tutor', sessionId, claimNonce }, new AbortController().signal), stub) as unknown as ScoreFetch;
    },
  };
}
const score = (fetchFn: ScoreFetch, audio = full) => scoreWithSpeechace({ reference: 'Bonjour', audio } as Parameters<typeof scoreWithSpeechace>[0], { env: { SPEECHACE_API_KEY: 'synthetic' }, fetchFn });

test('the reviewed scoring configuration is what describePaidHttp produces for a live Speechace call', async () => {
  const form = new FormData(); form.append('text', 'Bonjour'); form.append('user_audio_file', new Blob([full as BlobPart]), 'utterance.wav'); form.append('dialect', 'fr-fr');
  const d = await describePaidHttp(new URL('https://api.speechace.co/api/scoring/text/v9/json?key=synthetic&dialect=fr-fr'), { method: 'POST', body: form });
  const { configurationSha256: _, ...identity } = LESSON_SCORING_COMPONENT;
  assert.deepEqual({ kind: d.kind, provider: d.provider, model: d.model, voice: d.voice }, { kind: identity.kind, provider: identity.provider, model: identity.model, voice: identity.voice });
  const { paidConfigurationSha256 } = await import('./paidExecution.ts');
  assert.equal(paidConfigurationSha256(d), LESSON_SCORING_COMPONENT.configurationSha256);
  assert.deepEqual(d.quantities, { inputBytes: Buffer.byteLength('Bonjour') + 4096, outputTokens: 0, audioMillis: 30000, textBytes: 7 });
  assert.equal(LESSON_SCORING_COMPONENT.microUsd, 96000);
});

test('the reviewed envelope rests on a 30 s per-call ceiling shared by the gate and the live converter', () => {
  // Changing the per-call WAV cap changes how many scores fit in 900 s, so the reviewed envelope must be re-reviewed.
  assert.equal(LESSON_SCORING_MAX_CALL_MILLIS, 30000);
  assert.equal(44 + SCORING_MAX_SAMPLES * 2, SCORING_MAX_WAV_BYTES);
  assert.equal(full.length, SCORING_MAX_WAV_BYTES);
});

test('a lesson quote with the scoring component admits a live 30 s score through the paid transport', async () => {
  const h = harness([LLM, STT, TTS, LESSON_SCORING_COMPONENT], ['llm', 'scoring', 'stt', 'tts']);
  const result = await score(await h.transport());
  assert.equal(h.vendor.length, 1);
  assert.equal(h.claims.length, 1);
  assert.equal(h.claims[0]!.p_component_key, 'scoring');
  assert.equal((h.claims[0]!.p_quantities as { audioMillis: number }).audioMillis, 30000);
  assert.ok(result.length > 0);
});

test('the reviewed envelope admits 48 scores per lesson and refuses the 49th without reaching the vendor', async () => {
  // 48 x 18.75 s fills the 900 s audio envelope exactly, so the effect count is what stops the 49th.
  const clip = toSpeechaceWav(capture(18.75)), h = harness([LLM, STT, TTS, LESSON_SCORING_COMPONENT], ['llm', 'scoring', 'stt', 'tts']), fetchFn = await h.transport();
  for (let i = 0; i < 48; i += 1) assert.ok((await score(fetchFn, clip)).length > 0, `score ${i + 1}`);
  assert.equal(h.vendor.length, 48);
  assert.deepEqual(await score(fetchFn, clip), []);
  assert.equal(h.vendor.length, 48);
  assert.equal(h.claims.length, 48);
});

test('full-length 30 s scores are admitted until the 900 s audio envelope runs out', async () => {
  const h = harness([LLM, STT, TTS, LESSON_SCORING_COMPONENT]), fetchFn = await h.transport();
  for (let i = 0; i < 30; i += 1) assert.ok((await score(fetchFn)).length > 0, `score ${i + 1}`);
  assert.deepEqual(await score(fetchFn), []);
  assert.equal(h.vendor.length, 30);
});

test('without the scoring component the vendor is never called (F863)', async () => {
  const h = harness([LLM, STT, TTS]);
  assert.deepEqual(await score(await h.transport()), []);
  assert.equal(h.vendor.length, 0);
  assert.equal(h.claims.length, 0);
});

test('a binding whose kinds differ from the reservation is refused as quote-mismatch', async () => {
  const warned: unknown[][] = [], warn = console.warn;
  console.warn = (...args: unknown[]) => { warned.push(args); };
  try { await assert.rejects(harness([LLM, STT, TTS, LESSON_SCORING_COMPONENT], ['llm', 'stt', 'tts']).transport(), { reason: 'quote-mismatch' }); } finally { console.warn = warn; }
  assert.deepEqual(warned, [['[paid] binding kinds differ from the reserved quote', { activity: 'lesson', declared: 'llm,stt,tts', reserved: 'llm,scoring,stt,tts' }]]);
  await assert.rejects(harness([LLM, STT, TTS, LESSON_SCORING_COMPONENT], ['llm', 'stt', 'tts']).transport(), { reason: 'quote-mismatch' });
  await assert.rejects(harness([LLM, STT, TTS], ['llm', 'scoring', 'stt', 'tts']).transport(), { reason: 'quote-mismatch' });
  await assert.rejects(harness([LLM, STT, TTS], ['tts', 'llm', 'stt'] as PaidKind[]).transport(), { reason: 'quote-mismatch' });
});

test('the convo component shares the lesson identity and scales its envelope per score', () => {
  const { maxEffects, maxAudioMillis, maxInputBytes, maxTextBytes, microUsd, ...identity } = CONVO_SCORING_COMPONENT;
  const { maxEffects: le, maxAudioMillis: la, maxInputBytes: li, maxTextBytes: lt, microUsd: lm, ...lessonIdentity } = LESSON_SCORING_COMPONENT;
  assert.deepEqual(identity, lessonIdentity);
  assert.deepEqual({ maxEffects, maxAudioMillis, microUsd }, { maxEffects: 24, maxAudioMillis: 450000, microUsd: 48000 });
  assert.equal(maxAudioMillis / maxEffects, la / le);
  assert.equal(maxInputBytes / maxEffects, li / le);
  assert.equal(maxTextBytes / maxEffects, lt / le);
  assert.equal(microUsd / maxEffects, lm / le);
});

test('a convo quote with the scoring component admits a live 30 s score through the paid transport', async () => {
  const h = harness([LLM, STT, TTS, CONVO_SCORING_COMPONENT], ['llm', 'scoring', 'stt', 'tts'], 'convo');
  assert.ok((await score(await h.transport())).length > 0);
  assert.equal(h.vendor.length, 1);
  assert.equal(h.claims[0]!.p_component_key, 'scoring');
  assert.equal((h.claims[0]!.p_quantities as { audioMillis: number }).audioMillis, 30000);
});

test('the convo envelope admits 24 scores per mission and refuses the 25th without reaching the vendor', async () => {
  // 24 x 18.75 s fills the 450 s audio envelope exactly, so the effect count is what stops the 25th.
  const clip = toSpeechaceWav(capture(18.75)), h = harness([LLM, STT, TTS, CONVO_SCORING_COMPONENT], ['llm', 'scoring', 'stt', 'tts'], 'convo'), fetchFn = await h.transport();
  for (let i = 0; i < 24; i += 1) assert.ok((await score(fetchFn, clip)).length > 0, `score ${i + 1}`);
  assert.deepEqual(await score(fetchFn, clip), []);
  assert.equal(h.vendor.length, 24);
  assert.equal(h.claims.length, 24);
});

test('a convo binding whose kinds differ from the reservation is refused as quote-mismatch', async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    await assert.rejects(harness([LLM, STT, TTS, CONVO_SCORING_COMPONENT], ['llm', 'stt', 'tts'], 'convo').transport(), { reason: 'quote-mismatch' });
    await assert.rejects(harness([LLM, STT, TTS], ['llm', 'scoring', 'stt', 'tts'], 'convo').transport(), { reason: 'quote-mismatch' });
  } finally { console.warn = warn; }
  const h = harness([LLM, STT, TTS], undefined, 'convo');
  assert.deepEqual(await score(await h.transport()), []);
  assert.equal(h.vendor.length, 0);
});
