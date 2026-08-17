import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AudioFrame } from '@livekit/rtc-node';
import { initializeLogger, tts } from '@livekit/agents';

// The worker CLI does this in production; tests must do it themselves before any
// ChunkedStream is constructed.
initializeLogger({ pretty: false, level: 'silent' });

import { CachedTTS, normaliseLine } from './ttsCache.ts';
import { encodeWav, decodeWav } from './wav.ts';

const SAMPLE_RATE = 16_000;

/**
 * A fake vendor that "synthesizes" a deterministic ramp so tests can compare
 * PCM byte-for-byte, and counts how often it is called, which is the whole
 * point of the cache.
 */
class FakeTTS extends tts.TTS {
  label = 'fake.TTS';
  calls = 0;
  failNext = false;

  constructor() {
    super(SAMPLE_RATE, 1, { streaming: false });
  }

  synthesize(text: string, connOptions?: Parameters<tts.TTS['synthesize']>[1]): tts.ChunkedStream {
    this.calls += 1;
    return new FakeChunkedStream(text, this, this.failNext, connOptions);
  }

  stream(): never {
    throw new Error('not used');
  }
}

class FakeChunkedStream extends tts.ChunkedStream {
  label = 'fake.ChunkedStream';
  readonly #fail: boolean;

  constructor(text: string, ttsRef: tts.TTS, fail: boolean, connOptions?: Parameters<tts.TTS['synthesize']>[1]) {
    super(text, ttsRef, connOptions);
    this.#fail = fail;
  }

  protected async run(): Promise<void> {
    // A "failed" vendor yields no audio and returns. The hard-throw path belongs
    // to the SDK's own error plumbing (ThrowsPromise into the worker's global
    // handler), which is not ours to re-test; what the cache must guarantee is
    // identical either way: an incomplete line is never written to disk.
    if (this.#fail) return;
    // Two frames whose samples are derived from the text, so different lines
    // produce different audio and identical lines produce identical audio.
    const seed = [...this.inputText].reduce((n, c) => n + c.charCodeAt(0), 0) % 1000;
    for (let part = 0; part < 2; part++) {
      const samples = new Int16Array(160);
      for (let i = 0; i < samples.length; i++) samples[i] = ((seed + part * 331 + i * 7) % 2000) - 1000;
      this.queue.put({
        requestId: 'fake',
        segmentId: 'fake',
        frame: new AudioFrame(samples, SAMPLE_RATE, 1, samples.length),
        final: part === 1,
      });
    }
  }
}

// No retries in tests: a deliberate vendor failure should fail once, not spawn
// background retry attempts that outlive the test.
const NO_RETRY = { maxRetry: 0, retryIntervalMs: 0, timeoutMs: 5000 };

async function pcmOf(stream: tts.ChunkedStream): Promise<number[]> {
  const out: number[] = [];
  for await (const packet of stream) out.push(...packet.frame.data);
  return out;
}

function synth(cache: CachedTTS, text: string): tts.ChunkedStream {
  return cache.synthesize(text, NO_RETRY);
}

let dir: string;
let fake: FakeTTS;
let cached: CachedTTS;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'parle-tts-'));
  fake = new FakeTTS();
  cached = new CachedTTS(fake, { dir, voiceKey: 'test-voice' });
});

describe('wav round trip', () => {
  test('samples survive encode and decode exactly', () => {
    const samples = new Int16Array([0, 1, -1, 32767, -32768, 12345]);
    const wav = decodeWav(encodeWav({ sampleRate: 44100, channels: 2, samples }));
    assert.equal(wav.sampleRate, 44100);
    assert.equal(wav.channels, 2);
    assert.deepEqual([...wav.samples], [...samples]);
  });

  test('garbage is rejected, not misread', () => {
    assert.throws(() => decodeWav(Buffer.from('not audio at all')));
  });
});

describe('the cache', () => {
  test('first synthesis goes to the vendor, second replays from disk', async () => {
    const first = await pcmOf(synth(cached, 'Bonjour !'));
    assert.equal(fake.calls, 1);
    assert.equal(cached.misses, 1);

    const second = await pcmOf(synth(cached, 'Bonjour !'));
    assert.equal(fake.calls, 1, 'the vendor must not be called for a cached line');
    assert.equal(cached.hits, 1);
    assert.deepEqual(second, first, 'replayed audio must be identical to the original');
  });

  test('whitespace differences hit the same entry, punctuation does not', async () => {
    await pcmOf(synth(cached, 'Sur place ou à emporter ?'));
    await pcmOf(synth(cached, '  Sur   place ou à emporter ? '));
    assert.equal(fake.calls, 1, 'normalised whitespace should share one entry');

    await pcmOf(synth(cached, 'Sur place ou à emporter'));
    assert.equal(fake.calls, 2, 'punctuation changes prosody, so it is a different line');
  });

  test('different voices never share audio', async () => {
    await pcmOf(synth(cached, 'Bonjour !'));
    const otherVoice = new CachedTTS(fake, { dir, voiceKey: 'another-voice' });
    await pcmOf(synth(otherVoice, 'Bonjour !'));
    assert.equal(fake.calls, 2, 'a new voice must resynthesize, not replay the old voice');
  });

  test('long free-form text bypasses the cache entirely', async () => {
    const monologue = 'Alors, '.repeat(40); // well past the limit
    await pcmOf(synth(cached, monologue));
    await pcmOf(synth(cached, monologue));
    assert.equal(fake.calls, 2);
    assert.equal(readdirSync(dir).length, 0, 'nothing should be written for uncacheable text');
  });

  test('a corrupt cache file falls back to the vendor and is repaired', async () => {
    await pcmOf(synth(cached, 'Merci beaucoup'));
    writeFileSync(cached.cachePath('Merci beaucoup'), 'scrambled');

    const pcm = await pcmOf(synth(cached, 'Merci beaucoup'));
    assert.equal(fake.calls, 2, 'corruption must trigger live synthesis');
    assert.ok(pcm.length > 0);

    await pcmOf(synth(cached, 'Merci beaucoup'));
    assert.equal(fake.calls, 2, 'and the rewritten entry serves the next request');
  });

  test('a vendor failure writes nothing, so no truncated audio is ever replayed', async () => {
    fake.failNext = true;
    const pcm = await pcmOf(synth(cached, 'Au revoir'));
    assert.equal(pcm.length, 0, 'a failed synthesis produces no audio');
    assert.equal(readdirSync(dir).length, 0, 'and caches nothing');

    fake.failNext = false;
    await pcmOf(synth(cached, 'Au revoir'));
    await pcmOf(synth(cached, 'Au revoir'));
    assert.equal(cached.hits, 1, 'the successful retry caches and the next request replays it');
  });

  test('declares itself non-streaming so the framework sentence-splits for it', () => {
    assert.equal(cached.capabilities.streaming, false);
    assert.equal(cached.sampleRate, SAMPLE_RATE);
    assert.equal(cached.numChannels, 1);
  });
});

describe('normalisation', () => {
  test('collapses whitespace and trims, nothing else', () => {
    assert.equal(normaliseLine('  Un   café,\ns’il vous plaît  '), 'Un café, s’il vous plaît');
  });
});
