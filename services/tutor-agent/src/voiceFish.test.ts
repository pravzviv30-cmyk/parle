/**
 * The adapter that gives fish a final marker, driven through the real cache.
 *
 * These tests exist because the bug they cover is invisible: fish's websocket
 * stream emits `final: false` on every frame, ttsCache refuses to write a WAV
 * without a final marker, and the founder runs LUVANI_TTS_MISS_TRANSPORT=ws. So
 * the tutor would speak perfectly, the cache would fill with nothing, the bill
 * would climb, and every existing test would stay green.
 *
 * They therefore drive CachedTTS itself rather than the adapter in isolation.
 * A unit test of the adapter would assert that a flag got flipped; what has to
 * be true is that audio reaches disk when the line finished and never when it
 * did not, which only the cache can answer.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AudioFrame } from '@livekit/rtc-node';
import { APIConnectionError, initializeLogger, tts } from '@livekit/agents';

// The worker CLI does this in production; tests must do it themselves before
// any stream is constructed.
initializeLogger({ pretty: false, level: 'silent' });

import { CachedTTS } from './ttsCache.ts';
import { holdLastPacketFinal } from './voiceFish.ts';

/** fish's own PCM rate, which is what voiceFish pins. */
const SAMPLE_RATE = 24_000;

/** No retries in tests: one deliberate failure should fail once. */
const NO_RETRY = { maxRetry: 0, retryIntervalMs: 0, timeoutMs: 5000 };

/** Deterministic "synthesis": same text in, same PCM out, different text differs. */
function rampFrames(text: string, count: number): AudioFrame[] {
  const seed = [...text].reduce((n, c) => n + c.charCodeAt(0), 0) % 1000;
  const frames: AudioFrame[] = [];
  for (let part = 0; part < count; part++) {
    const samples = new Int16Array(240);
    for (let i = 0; i < samples.length; i++) samples[i] = ((seed + part * 331 + i * 7) % 2000) - 1000;
    frames.push(new AudioFrame(samples, SAMPLE_RATE, 1, samples.length));
  }
  return frames;
}

/**
 * How the vendor ends a line. Every one of these is a real fish behaviour read
 * out of the plugin's source, not an invented shape:
 *
 * - `never-final`: audio lands on an exact 4800-byte boundary, so the
 *   `bstream.flush()` remainder is empty, so NOTHING is ever marked final. Then
 *   the `finish` event puts END_OF_STREAM and the run returns cleanly.
 * - `own-final`: the remainder is non-empty, so fish marks its last flushed
 *   frame `final: true` itself, then puts END_OF_STREAM.
 * - `error`: the `finish` event carries reason=error, so the run throws and the
 *   framework swallows it — the queue closes with NO sentinel, which from
 *   outside looks exactly like a clean end except for the missing sentinel.
 * - `stall`: audio is flowing when the learner barges in.
 */
type Ending = 'never-final' | 'own-final' | 'error' | 'stall';

class FakeFishTTS extends tts.TTS {
  label = 'fake.fish.TTS';
  streamCalls = 0;
  ending: Ending = 'never-final';
  streams: FakeFishStream[] = [];

  constructor() {
    super(SAMPLE_RATE, 1, { streaming: true });
    // The framework emits 'error' on the TTS when a run fails, and an
    // EventEmitter with no listener for 'error' throws. A real worker has one.
    this.on('error', () => {});
  }

  synthesize(): tts.ChunkedStream {
    throw new Error('these tests exercise the ws transport; synthesize() is passed through untouched');
  }

  stream(options?: Parameters<tts.TTS['stream']>[0]): tts.SynthesizeStream {
    this.streamCalls += 1;
    const stream = new FakeFishStream(this, options?.connOptions);
    this.streams.push(stream);
    return stream;
  }
}

class FakeFishStream extends tts.SynthesizeStream {
  label = 'fake.fish.SynthesizeStream';
  /** The stand-in for "fish's websocket context was closed on the wire". */
  closedByCaller = false;
  /** Everything this stream put on the wire, in order, for the adapter to be held to. */
  readonly emitted: tts.SynthesizedAudio[] = [];
  readonly #fake: FakeFishTTS;

  constructor(fake: FakeFishTTS, connOptions?: Parameters<tts.TTS['synthesize']>[1]) {
    super(fake, connOptions);
    this.#fake = fake;
  }

  override close(): void {
    this.closedByCaller = true;
    super.close();
  }

  #put(frame: AudioFrame, final: boolean): void {
    const packet = { requestId: 'fish', segmentId: 'fish', frame, final };
    this.emitted.push(packet);
    this.queue.put(packet);
  }

  protected async run(): Promise<void> {
    let text = '';
    for await (const item of this.input) if (typeof item === 'string') text += item;

    const frames = rampFrames(text, 3);

    if (this.#fake.ending === 'stall') {
      // Two frames, because one packet is always held back: audio is flowing to
      // the learner but the line is nowhere near finished, which is exactly the
      // moment a barge-in happens.
      this.#put(frames[0]!, false);
      this.#put(frames[1]!, false);
      await new Promise<void>((resolve) => {
        if (this.abortController.signal.aborted) return resolve();
        this.abortController.signal.addEventListener('abort', () => resolve(), { once: true });
      });
      return;
    }

    // final:false on every single frame. This is the misbehaviour.
    for (const frame of frames) this.#put(frame, false);

    if (this.#fake.ending === 'error') {
      throw new APIConnectionError({ message: 'Fish Audio TTS reported an error' });
    }
    if (this.#fake.ending === 'own-final') {
      this.#put(rampFrames(`${text}-remainder`, 1)[0]!, true);
    }
    this.queue.put(tts.SynthesizeStream.END_OF_STREAM);
  }
}

async function pcmOf(stream: tts.ChunkedStream): Promise<number[]> {
  const out: number[] = [];
  for await (const packet of stream) out.push(...packet.frame.data);
  return out;
}

const freshDir = () => mkdtempSync(join(tmpdir(), 'luvani-fish-'));

let dir: string;
let fake: FakeFishTTS;
let cached: CachedTTS;

beforeEach(() => {
  dir = freshDir();
  fake = new FakeFishTTS();
  cached = new CachedTTS(holdLastPacketFinal(fake), { dir, voiceKey: 'fish-test', missTransport: 'ws' });
});

describe('fish’s missing final marker, repaired at the seam', () => {
  test('a fish-shaped stream that never marks final is cached by CachedTTS over ws and replayed as a hit', async () => {
    // First, the bug itself, so this test fails if the adapter is ever removed
    // for looking unnecessary. The same vendor, unwrapped, caches nothing at
    // all — and nothing about that is visible to a learner or to a log.
    const bareDir = freshDir();
    const bare = new CachedTTS(fake, { dir: bareDir, voiceKey: 'fish-test', missTransport: 'ws' });
    const bareAudio = await pcmOf(bare.synthesize('Bonjour !', NO_RETRY));
    assert.ok(bareAudio.length > 0, 'the audio plays either way, which is what makes this invisible');
    assert.equal(readdirSync(bareDir).length, 0, 'unwrapped, fish never gets a line onto disk');

    // Wrapped, the same vendor caches and replays.
    const first = await pcmOf(cached.synthesize('Bonjour !', NO_RETRY));
    assert.equal(cached.misses, 1);
    assert.deepEqual(first, bareAudio, 'the adapter must not drop, duplicate or reorder a frame');
    assert.equal(readdirSync(dir).length, 1, 'a line fish finished cleanly belongs on disk');

    const second = await pcmOf(cached.synthesize('Bonjour !', NO_RETRY));
    assert.equal(cached.hits, 1);
    assert.deepEqual(second, first, 'the replay must match what was streamed');
    assert.equal(fake.streamCalls, 2, 'a cached line must not reopen the vendor stream');
  });

  test('a stream that errors mid-line never reaches disk, even through the adapter', async () => {
    // The guarantee the adapter must not weaken. An errored fish stream looks
    // identical to a finished one from outside — the framework swallows the
    // throw and closes the queue — except that no END_OF_STREAM arrives. That
    // sentinel, not "the iteration ended", is what may mark a line final.
    fake.ending = 'error';
    const pcm = await pcmOf(cached.synthesize('Au revoir', NO_RETRY));
    assert.ok(pcm.length > 0, 'the audio that did arrive still reaches the learner');
    assert.equal(readdirSync(dir).length, 0, 'half a sentence must never be replayed forever');

    // And the repair still works, so this is not caching turned off.
    fake.ending = 'never-final';
    await pcmOf(cached.synthesize('Au revoir', NO_RETRY));
    await pcmOf(cached.synthesize('Au revoir', NO_RETRY));
    assert.equal(cached.hits, 1, 'the successful retry caches and the next request replays it');
  });

  test('an aborted line never reaches disk, even through the adapter', async () => {
    fake.ending = 'stall';
    const abort = new AbortController();
    const stream = cached.synthesize('Interrompu en plein vol', NO_RETRY, abort.signal);

    const before = await stream.next();
    assert.ok(!before.done, 'audio was already flowing when the learner barged in');
    abort.abort();
    for await (const packet of stream) void packet; // drain to completion

    assert.equal(readdirSync(dir).length, 0, 'a barged-in line must never reach the disk cache');

    // The abort has to reach fish, not stop at the adapter: closing the vendor
    // stream is what tears its websocket context down, so a cut-off line cannot
    // keep synthesizing into the next turn.
    const vendorStream = fake.streams[0]!;
    assert.equal(vendorStream.closedByCaller, true, 'the adapter must close the fish stream on abort');
    assert.ok(vendorStream.abortSignal.aborted, 'closing tears the context down, not just this iterator');
  });

  test('when the inner stream marks final itself the adapter forwards it once, unchanged and in order', async () => {
    // fish does mark its own final whenever the flush remainder is non-empty,
    // which is most lines. Inventing a second one would tell the cache a line
    // ended twice, and re-wrapping the vendor's packet would make "unchanged"
    // a matter of luck.
    fake.ending = 'own-final';
    const wrapped = holdLastPacketFinal(fake);
    const stream = wrapped.stream({ connOptions: NO_RETRY });
    stream.pushText('Voilà.');
    stream.endInput();

    const seen: tts.SynthesizedAudio[] = [];
    let sentinels = 0;
    for await (const packet of stream) {
      if (packet === tts.SynthesizeStream.END_OF_STREAM) sentinels += 1;
      else seen.push(packet);
    }

    const emitted = fake.streams[0]!.emitted;
    assert.equal(seen.length, emitted.length, 'every packet the vendor sent, and no more');
    for (const [i, packet] of seen.entries()) {
      assert.equal(packet, emitted[i], `packet ${i} must be the vendor's own object, in the vendor's order`);
    }
    assert.equal(seen.filter((p) => p.final).length, 1, 'exactly one final marker, and it is the one fish sent');
    assert.equal(seen.at(-1)!.final, true);
    assert.equal(sentinels, 1, 'one end-of-stream sentinel, forwarded not doubled');
  });
});
