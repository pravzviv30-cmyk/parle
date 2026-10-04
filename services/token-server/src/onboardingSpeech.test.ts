import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guestSpeechAvailable, transcribeGuestTake } from './onboardingSpeech.ts';

const audio = Buffer.from('RIFF0000WAVEfmt ');
const local = { LUVANI_LOCAL_DEVELOPMENT: '1', DEEPGRAM_API_KEY: 'synthetic-key' };

test('production guest speech cannot bypass authenticated paid admission even with local flags and keys', async () => {
  let calls = 0;
  const request: typeof fetch = async () => { calls++; return Response.json({}); };
  for (const env of [{}, { DEEPGRAM_API_KEY: 'synthetic-key' }, { ...local, NODE_ENV: 'production' }]) {
    assert.equal(guestSpeechAvailable(env), false);
    assert.equal(await transcribeGuestTake(audio, new AbortController().signal, env, request), null);
  }
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
  assert.equal(guestSpeechAvailable(local), true);
  assert.equal(await transcribeGuestTake(audio, new AbortController().signal, local, request), 'Un café, merci.');
  assert.equal(await transcribeGuestTake(audio, AbortSignal.abort(), local, request), null);
  assert.equal(await transcribeGuestTake(Buffer.alloc(2 * 1024 * 1024 + 1), new AbortController().signal, local, request), null);
  assert.equal(calls, 1);
});
