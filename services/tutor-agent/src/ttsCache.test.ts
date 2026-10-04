import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdtempSync, writeFileSync, readdirSync, symlinkSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AudioFrame } from '@livekit/rtc-node';
import { initializeLogger, tts } from '@livekit/agents';

// The worker CLI does this in production; tests must do it themselves before any
// ChunkedStream is constructed.
initializeLogger({ pretty: false, level: 'silent' });

import { CachedTTS, normaliseLine } from './ttsCache.ts';
import { AUTHORED_SPEECH_LINES } from './authoredSpeech.ts';
import { encodeWav, decodeWav } from './wav.ts';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const SAMPLE_RATE = 16_000;

/**
 * The deterministic "synthesis" both fake transports share: a ramp derived from
 * the text, so different lines produce different audio, identical lines produce
 * identical audio, and tests can compare PCM byte-for-byte across transports.
 */
function rampFrames(text: string): AudioFrame[] {
  const seed = [...text].reduce((n, c) => n + c.charCodeAt(0), 0) % 1000;
  const frames: AudioFrame[] = [];
  for (let part = 0; part < 2; part++) {
    const samples = new Int16Array(160);
    for (let i = 0; i < samples.length; i++) samples[i] = ((seed + part * 331 + i * 7) % 2000) - 1000;
    frames.push(new AudioFrame(samples, SAMPLE_RATE, 1, samples.length));
  }
  return frames;
}

/**
 * A fake vendor with both transports the cache can route a miss through: the
 * per-sentence HTTP shape (synthesize) and the persistent-stream shape
 * (stream), counting calls to each, which is how the tests see routing.
 */
class FakeTTS extends tts.TTS {
  label = 'fake.TTS';
  calls = 0;
  streamCalls = 0;
  failNext = false;
  /** When true, streams emit one frame then hold until aborted, like a vendor mid-line. */
  stallStreams = false;
  streams: FakeSynthesizeStream[] = [];

  constructor() {
    super(SAMPLE_RATE, 1, { streaming: false });
  }

  synthesize(text: string, connOptions?: Parameters<tts.TTS['synthesize']>[1]): tts.ChunkedStream {
    this.calls += 1;
    return new FakeChunkedStream(text, this, this.failNext, connOptions);
  }

  stream(options?: Parameters<tts.TTS['stream']>[0]): FakeSynthesizeStream {
    this.streamCalls += 1;
    const stream = new FakeSynthesizeStream(this, options?.connOptions);
    this.streams.push(stream);
    return stream;
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
    const frames = rampFrames(this.inputText);
    frames.forEach((frame, i) => {
      this.queue.put({ requestId: 'fake', segmentId: 'fake', frame, final: i === frames.length - 1 });
    });
  }
}

/**
 * The streaming shape mirrors the real plugin where it matters to the cache:
 * text arrives via pushText/endInput, frames flow out as they are produced,
 * the last frame of a successful line carries final:true, a failed line simply
 * ends without one, and close() is what tears down the vendor-side context.
 */
class FakeSynthesizeStream extends tts.SynthesizeStream {
  label = 'fake.SynthesizeStream';
  /** The observable stand-in for "the ws context was closed on the wire". */
  closedByCaller = false;
  readonly #fake: FakeTTS;

  constructor(fake: FakeTTS, connOptions?: Parameters<tts.TTS['synthesize']>[1]) {
    super(fake, connOptions);
    this.#fake = fake;
  }

  override close(): void {
    this.closedByCaller = true;
    super.close();
  }

  protected async run(): Promise<void> {
    let text = '';
    for await (const item of this.input) {
      if (typeof item === 'string') text += item;
    }
    if (this.#fake.failNext) return;
    const frames = rampFrames(text);
    if (this.#fake.stallStreams) {
      this.queue.put({ requestId: 'fake-ws', segmentId: 'fake-ws', frame: frames[0]!, final: false });
      await new Promise<void>((resolve) => {
        if (this.abortController.signal.aborted) return resolve();
        this.abortController.signal.addEventListener('abort', () => resolve(), { once: true });
      });
      return;
    }
    frames.forEach((frame, i) => {
      this.queue.put({ requestId: 'fake-ws', segmentId: 'fake-ws', frame, final: i === frames.length - 1 });
    });
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
let savedTransportEnv: string | undefined;

beforeEach(() => {
  // The transport default is an env seam; tests own it so a developer's shell
  // can never flip which path these assertions exercise.
  savedTransportEnv = process.env.LUVANI_TTS_MISS_TRANSPORT;
  delete process.env.LUVANI_TTS_MISS_TRANSPORT;
  dir = mkdtempSync(join(tmpdir(), 'luvani-tts-'));
  fake = new FakeTTS();
  cached = new CachedTTS(fake, { dir, voiceKey: 'test-voice', authoredLines: [...AUTHORED_SPEECH_LINES, 'Sur place ou à emporter ?', 'Sur place ou à emporter'] });
});

afterEach(() => {
  if (savedTransportEnv === undefined) delete process.env.LUVANI_TTS_MISS_TRANSPORT;
  else process.env.LUVANI_TTS_MISS_TRANSPORT = savedTransportEnv;
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

describe('the miss transport seam', () => {
  test('http is the default and still synthesizes per sentence', async () => {
    assert.equal(cached.opts.missTransport, 'http');
    await pcmOf(synth(cached, 'Bonjour !'));
    assert.equal(fake.calls, 1, 'the default miss must use the per-sentence path');
    assert.equal(fake.streamCalls, 0, 'and never open a vendor stream');
  });

  test('LUVANI_TTS_MISS_TRANSPORT=ws opts in via the environment, junk does not', () => {
    process.env.LUVANI_TTS_MISS_TRANSPORT = 'ws';
    assert.equal(new CachedTTS(fake, { dir, voiceKey: 'test-voice' }).opts.missTransport, 'ws');

    process.env.LUVANI_TTS_MISS_TRANSPORT = 'websocket';
    assert.equal(new CachedTTS(fake, { dir, voiceKey: 'test-voice' }).opts.missTransport, 'http');
  });
});

describe('misses over the vendor stream', () => {
  beforeEach(() => {
    cached = new CachedTTS(fake, { dir, voiceKey: 'test-voice', missTransport: 'ws' });
  });

  test('a miss rides the stream, tees to disk, and replays like any hit', async () => {
    const first = await pcmOf(synth(cached, 'Bonjour !'));
    assert.equal(fake.streamCalls, 1, 'the miss must use the streaming transport');
    assert.equal(fake.calls, 0, 'and never the per-sentence path');
    assert.equal(cached.misses, 1);
    assert.ok(first.length > 0);
    assert.equal(readdirSync(dir).length, 1, 'the streamed line is teed to disk');

    const second = await pcmOf(synth(cached, 'Bonjour !'));
    assert.equal(fake.streamCalls, 1, 'a cached line must not reopen the vendor stream');
    assert.equal(cached.hits, 1);
    assert.deepEqual(second, first, 'the replay must match what was streamed');
  });

  test('a barge-in closes the vendor stream context and caches nothing', async () => {
    fake.stallStreams = true;
    const abort = new AbortController();
    const stream = cached.synthesize('Interrompu en plein vol', NO_RETRY, abort.signal);

    const before = await stream.next();
    assert.ok(!before.done, 'audio was already flowing when the learner barged in');
    abort.abort();
    for await (const packet of stream) void packet; // drain to completion

    const vendorStream = fake.streams[0]!;
    assert.equal(vendorStream.closedByCaller, true, 'the cache must close the vendor stream on abort');
    assert.ok(vendorStream.abortSignal.aborted, 'closing tears the context down, not just this iterator');
    assert.equal(readdirSync(dir).length, 0, 'a barged-in line must never reach the disk cache');
  });

  test('a stream that never sees the final marker caches nothing, and the retry repairs it', async () => {
    fake.failNext = true;
    const pcm = await pcmOf(synth(cached, 'Au revoir'));
    assert.equal(pcm.length, 0, 'a failed stream produces no audio');
    assert.equal(readdirSync(dir).length, 0, 'and caches nothing');

    fake.failNext = false;
    await pcmOf(synth(cached, 'Au revoir'));
    await pcmOf(synth(cached, 'Au revoir'));
    assert.equal(cached.hits, 1, 'the successful retry caches and the next request replays it');
  });
});

describe('the first-audio hook', () => {
  test('reports a miss for live synthesis and a hit for the replay', async () => {
    const seen: { hit: boolean }[] = [];
    cached = new CachedTTS(fake, { dir, voiceKey: 'test-voice', onFirstAudio: (info) => seen.push(info) });
    await pcmOf(synth(cached, 'Bonjour !'));
    await pcmOf(synth(cached, 'Bonjour !'));
    // One entry per synthesis, not per frame: the first frame is the moment.
    assert.deepEqual(seen, [{ hit: false }, { hit: true }]);
  });

  test('fires once on the first streamed frame too', async () => {
    const seen: { hit: boolean }[] = [];
    cached = new CachedTTS(fake, {
      dir,
      voiceKey: 'test-voice',
      missTransport: 'ws',
      onFirstAudio: (info) => seen.push(info),
    });
    await pcmOf(synth(cached, 'Bonjour !'));
    assert.deepEqual(seen, [{ hit: false }]);
  });

  test('a throwing hook never costs the learner audio', async () => {
    cached = new CachedTTS(fake, {
      dir,
      voiceKey: 'test-voice',
      onFirstAudio: () => {
        throw new Error('telemetry bug');
      },
    });
    const pcm = await pcmOf(synth(cached, 'Bonjour !'));
    assert.ok(pcm.length > 0, 'audio flows even when the hook throws');
    assert.deepEqual(await pcmOf(synth(cached, 'Bonjour !')), pcm, 'and the replay path survives it too');
  });
});

describe('normalisation', () => {
  test('collapses whitespace and trims, nothing else', () => {
    assert.equal(normaliseLine('  Un   café,\ns’il vous plaît  '), 'Un café, s’il vous plaît');
  });
});

describe('authored-only bounded persistence', () => {
  test('a short private model reply is synthesized live every time and never persisted', async () => {
    const privateReply = 'Votre rendez-vous privé avec Camille est mardi.';
    await pcmOf(synth(cached, privateReply));
    await pcmOf(synth(cached, privateReply));
    assert.equal(fake.calls, 2);
    assert.equal(existsSync(cached.cachePath(privateReply)), false);
    assert.deepEqual(readdirSync(dir), []);
  });

  test('legacy owned hash WAVs are removed, unrelated assets and symlinks are ignored', async () => {
    const legacy = join(dir, 'a'.repeat(40) + '.wav');
    const asset = join(dir, 'authored-asset.wav');
    const target = join(mkdtempSync(join(tmpdir(), 'luvani-cache-target-')), 'kept.wav');
    writeFileSync(legacy, 'legacy-personal-speech'); writeFileSync(asset, 'bundled'); writeFileSync(target, 'outside');
    const link = join(dir, 'b'.repeat(40) + '.wav'); symlinkSync(target, link);
    const next = new CachedTTS(fake, { dir, voiceKey: 'test-voice' });
    assert.equal(existsSync(legacy), false);
    assert.equal(readFileSync(asset, 'utf8'), 'bundled');
    assert.equal(lstatSync(link).isSymbolicLink(), true);
    assert.equal(readFileSync(target, 'utf8'), 'outside');
    await next.close();
  });

  test('a symlinked authored directory never reads or writes its target', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'luvani-cache-outside-'));
    symlinkSync(outside, join(dir, 'authored-v1'));
    const next = new CachedTTS(fake, { dir, voiceKey: 'test-voice' });
    await pcmOf(synth(next, 'Bonjour !')); await pcmOf(synth(next, 'Bonjour !'));
    assert.equal(fake.calls, 2);
    assert.deepEqual(readdirSync(outside), []);
    await next.close();
  });

  test('slot eviction validates the full fingerprint and preserves WAV playback', async () => {
    const next = new CachedTTS(fake, { dir, voiceKey: 'test-voice', cacheSlots: 1 });
    const first = await pcmOf(synth(next, 'Bonjour !'));
    await pcmOf(synth(next, 'Au revoir'));
    assert.equal(next.cachePath('Bonjour !'), next.cachePath('Au revoir'));
    const third = await pcmOf(synth(next, 'Bonjour !'));
    assert.equal(fake.calls, 3, 'a collision is a miss, never another sentence replay');
    assert.deepEqual(third, first);
    assert.equal(readdirSync(next.cacheDirectory).length, 1);
    assert.deepEqual([...decodeWav(readFileSync(next.cachePath('Bonjour !'))).samples], first);
    await next.close();
  });

  test('expired audio and entries above the byte ceiling are not replayed or retained', async () => {
    await pcmOf(synth(cached, 'Bonjour !'));
    utimesSync(cached.cachePath('Bonjour !'), new Date(0), new Date(0));
    await pcmOf(synth(cached, 'Bonjour !'));
    assert.equal(fake.calls, 2);
    const small = new CachedTTS(fake, { dir: join(dir, 'small'), voiceKey: 'test-voice', maxEntryBytes: 128 });
    await pcmOf(synth(small, 'Bonjour !')); await pcmOf(synth(small, 'Bonjour !'));
    assert.equal(existsSync(small.cachePath('Bonjour !')), false);
    await small.close();
  });

  test('an occupied slot temporary file cannot be clobbered by another job', async () => {
    const next = new CachedTTS(fake, { dir, voiceKey: 'test-voice', cacheSlots: 1 });
    await pcmOf(synth(next, 'Bonjour !'));
    const pending = next.cachePath('Au revoir').replace(/\.wav$/, '.pending');
    writeFileSync(pending, 'other-job');
    const audio = await pcmOf(synth(next, 'Au revoir'));
    assert.ok(audio.length > 0);
    assert.equal(readFileSync(pending, 'utf8'), 'other-job');
    assert.equal(next.readLine('Bonjour !') !== null, true);
    assert.equal(readdirSync(next.cacheDirectory).length, 2, 'one cache and one exclusive pending file per slot');
    rmSync(pending); await next.close();
  });
});

describe('the warm-cache script cannot be hung by an env flag', () => {
  test('warming pins the transport rather than reading the environment', () => {
    // LUVANI_TTS_MISS_TRANSPORT lives in the same .env warmCache.ts loads, so a
    // flag meant for the agent reached the script too and held its pooled
    // socket open past the last line. Reading the source because the script's
    // main() talks to a vendor.
    const source = readFileSync(new URL('./warmCache.ts', import.meta.url).pathname, 'utf8');
    assert.match(source, /buildTTS\(\{[^}]*missTransport:\s*'http'/, 'the warm run no longer pins its transport');
  });
});

describe('the warm-cache script demands the selected vendor key', () => {
  /**
   * Runs the real script exactly as `npm run warm-cache` does, and gets the real
   * refusal — the guard lives inside a main() that talks to a vendor, so the
   * only honest way to see it is to run it.
   *
   * Two details are load-bearing, both about not spending money in a test.
   * dotenv reads .env from the cwd, so the run happens in an empty temp dir
   * rather than services/tutor-agent. And the child env is built from nothing
   * rather than inherited, because a founder with keys exported would sail past
   * the guard and start a real, paid warm run inside the suite.
   */
  function warmRun(vendor?: string): { status: number | null; err: string } {
    const script = new URL('./warmCache.ts', import.meta.url).pathname;
    const run = spawnSync(process.execPath, ['--experimental-strip-types', script], {
      cwd: mkdtempSync(join(tmpdir(), 'luvani-warm-')),
      env: {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? '',
        ...(vendor === undefined ? {} : { LUVANI_TTS_VENDOR: vendor }),
      },
      encoding: 'utf8',
    });
    return { status: run.status, err: run.stderr };
  }

  test("the warm run refuses without the selected vendor's key and names the right variable", () => {
    const fish = warmRun('fish');
    assert.equal(fish.status, 1, 'a keyless fish warm run stops rather than starting');
    assert.match(fish.err, /FISH_API_KEY is empty/, 'and names the key fish actually needs');
    assert.doesNotMatch(fish.err, /ELEVEN_API_KEY/, 'never refusing over a key it was not going to send');

    const eleven = warmRun(undefined);
    assert.equal(eleven.status, 1, 'and the default vendor is still ElevenLabs');
    assert.match(eleven.err, /ELEVEN_API_KEY is empty/, 'refusing over its own key');
    assert.doesNotMatch(eleven.err, /FISH_API_KEY/, 'and only its own');
  });
});
