import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeLogger, tts } from '@livekit/agents';

initializeLogger({ pretty: false, level: 'silent' });
process.env.TTS_CACHE_DIR ??= mkdtempSync(join(tmpdir(), 'luvani-tts-error-'));

import { CachedTTS } from './ttsCache.ts';
import { buildTTS } from './voice.ts';

// The session only listens on the object it was handed (CachedTTS). The vendor
// plugin underneath emits 'error' on itself; with no listener Node throws
// ERR_UNHANDLED_ERROR and the whole worker, every session on it, goes down.
class SilentTTS extends tts.TTS {
  label = 'silent.TTS';
  constructor() { super(16_000, 1, { streaming: false }); }
  synthesize(): tts.ChunkedStream { throw new Error('not used'); }
  stream(): tts.SynthesizeStream { throw new Error('not used'); }
}

const refusal = () => ({ type: 'tts_error' as const, timestamp: Date.now(), label: 'x', error: new Error('quote-mismatch'), recoverable: false });

test('a vendor voice error reaches the session through the cached voice instead of crashing the worker', () => {
  const inner = new SilentTTS();
  const cached = new CachedTTS(inner, { dir: process.env.TTS_CACHE_DIR!, voiceKey: 'k' });
  const seen: unknown[] = [];
  cached.on('error', (ev) => seen.push(ev));
  const ev = refusal();
  assert.doesNotThrow(() => inner.emit('error', ev));
  assert.deepEqual(seen, [ev]);
});

test('a conversation-tier voice error is routed the same way as the main voice', () => {
  const inner = new SilentTTS();
  const convo = new SilentTTS();
  const cached = new CachedTTS(inner, { dir: process.env.TTS_CACHE_DIR!, voiceKey: 'k', conversation: { inner: convo, voiceKey: 'k2' } });
  const seen: unknown[] = [];
  cached.on('error', (ev) => seen.push(ev));
  assert.doesNotThrow(() => convo.emit('error', refusal()));
  assert.equal(seen.length, 1);
});

test('a vendor voice error with no session listening yet is logged rather than thrown', () => {
  const inner = new SilentTTS();
  new CachedTTS(inner, { dir: process.env.TTS_CACHE_DIR!, voiceKey: 'k' });
  assert.doesNotThrow(() => inner.emit('error', refusal()));
});

test('the ElevenLabs voice built for a session does not crash the worker when the paid proxy refuses it', () => {
  const voice = buildTTS({ baseURL: 'http://127.0.0.1:1/v1' });
  const seen: unknown[] = [];
  voice.on('error', (ev) => seen.push(ev));
  assert.doesNotThrow(() => voice.inner.emit('error', refusal()));
  assert.equal(seen.length, 1);
});
