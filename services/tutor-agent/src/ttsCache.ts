/**
 * The TTS cache.
 *
 * A lesson's tutor lines are fixed text. Paying a voice vendor to synthesize
 * "Bonjour !" fresh in every session is paying a voice actor to re-record the same
 * line every day. This wrapper synthesizes a line the first time it is spoken,
 * saves the audio as a WAV, and replays it forever after at no cost and with no
 * synthesis delay.
 *
 * Free-form replies still go to the vendor live. The split falls out of the
 * product's own design: scripted-first beginner lessons mean most of what the
 * tutor says repeats, which is exactly what a cache wants. A free-form product
 * like Issen could not do this.
 *
 * Mechanics: `capabilities.streaming` is false, so the framework wraps this in
 * its sentence adapter and calls `synthesize()` once per sentence. The cache is
 * therefore sentence-grained, and a recurring sentence hits even when the LLM
 * wraps it in different surroundings.
 */

import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AudioFrame } from '@livekit/rtc-node';
import { tts, type APIConnectOptions } from '@livekit/agents';
import { decodeWav, encodeWav } from './wav.ts';

export interface CachedTTSOptions {
  /** Directory the WAV files live in. Created if missing. */
  dir: string;
  /**
   * Identity of the voice, mixed into every cache key. Change the vendor, voice
   * or model and the old audio is never replayed by mistake.
   */
  voiceKey: string;
  /**
   * Lines longer than this go straight to the vendor uncached. Long free-form
   * monologues almost never repeat, and caching them only fills the disk.
   */
  maxTextLength?: number;
}

const DEFAULT_MAX_TEXT = 220;
/** Cache-hit audio is emitted in chunks of this many milliseconds. */
const REPLAY_CHUNK_MS = 100;

/** Cache keys survive harmless whitespace differences but respect punctuation. */
export function normaliseLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export class CachedTTS extends tts.TTS {
  label = 'parle.CachedTTS';
  readonly inner: tts.TTS;
  readonly opts: Required<CachedTTSOptions>;
  /** Running counters, logged by the agent so cost per session stays visible. */
  hits = 0;
  misses = 0;

  constructor(inner: tts.TTS, opts: CachedTTSOptions) {
    // Declaring streaming:false makes the framework sentence-split for us.
    super(inner.sampleRate, inner.numChannels, { streaming: false });
    this.inner = inner;
    this.opts = { maxTextLength: DEFAULT_MAX_TEXT, ...opts };
    mkdirSync(this.opts.dir, { recursive: true });
  }

  override get model(): string {
    return this.inner.model;
  }

  override get provider(): string {
    return `cached(${this.inner.provider})`;
  }

  cachePath(text: string): string {
    const key = createHash('sha1')
      .update(`${this.opts.voiceKey}\n${this.inner.sampleRate}\n${normaliseLine(text)}`)
      .digest('hex');
    return join(this.opts.dir, `${key}.wav`);
  }

  synthesize(text: string, connOptions?: APIConnectOptions, abortSignal?: AbortSignal): tts.ChunkedStream {
    return new CachedChunkedStream(text, this, connOptions, abortSignal);
  }

  stream(): never {
    // The framework wraps non-streaming TTS in its StreamAdapter and never calls
    // this. Anything else reaching for it should fail loudly, not silently skip
    // the cache.
    throw new Error('CachedTTS is sentence-based; wrap it in a StreamAdapter to stream');
  }
}

class CachedChunkedStream extends tts.ChunkedStream {
  label = 'parle.CachedChunkedStream';
  readonly #cache: CachedTTS;
  /** Forwarded to the vendor so the session's retry policy applies end to end. */
  readonly #connOptions?: APIConnectOptions;

  constructor(text: string, cache: CachedTTS, connOptions?: APIConnectOptions, abortSignal?: AbortSignal) {
    super(text, cache, connOptions, abortSignal);
    this.#cache = cache;
    this.#connOptions = connOptions;
  }

  protected async run(): Promise<void> {
    const text = this.inputText;
    const cacheable = normaliseLine(text).length > 0 && text.length <= this.#cache.opts.maxTextLength;
    const path = this.#cache.cachePath(text);

    if (cacheable && existsSync(path)) {
      try {
        this.#replay(readFileSync(path));
        this.#cache.hits += 1;
        return;
      } catch {
        // A corrupt file must never break the tutor's voice mid-sentence.
        // Remove it and fall through to live synthesis, which rewrites it.
        rmSync(path, { force: true });
      }
    }

    await this.#passthrough(path, cacheable);
    this.#cache.misses += 1;
  }

  /** Emit a cached WAV as audio frames, in modest chunks so playout starts fast. */
  #replay(file: Buffer): void {
    const wav = decodeWav(file);
    const requestId = randomUUID();
    const perChunk = Math.max(1, Math.round((wav.sampleRate * REPLAY_CHUNK_MS) / 1000)) * wav.channels;

    for (let offset = 0; offset < wav.samples.length; offset += perChunk) {
      const slice = wav.samples.subarray(offset, Math.min(offset + perChunk, wav.samples.length));
      const frame = new AudioFrame(new Int16Array(slice), wav.sampleRate, wav.channels, slice.length / wav.channels);
      const final = offset + perChunk >= wav.samples.length;
      this.queue.put({ requestId, segmentId: requestId, frame, final });
    }
  }

  /** Live synthesis, teeing the audio to disk when the whole line succeeds. */
  async #passthrough(path: string, cacheable: boolean): Promise<void> {
    const innerStream = this.#cache.inner.synthesize(this.inputText, this.#connOptions, this.abortSignal);
    const collected: AudioFrame[] = [];

    for await (const packet of innerStream) {
      collected.push(packet.frame);
      this.queue.put(packet);
    }

    // Only a complete, non-empty line is worth keeping. A failed request throws
    // out of the loop above and nothing is written.
    if (!cacheable || collected.length === 0) return;

    const first = collected[0]!;
    const total = collected.reduce((n, f) => n + f.data.length, 0);
    const samples = new Int16Array(total);
    let offset = 0;
    for (const f of collected) {
      samples.set(f.data, offset);
      offset += f.data.length;
    }

    try {
      const tmp = `${path}.tmp-${process.pid}`;
      writeFileSync(tmp, encodeWav({ sampleRate: first.sampleRate, channels: first.channels, samples }));
      renameSync(tmp, path);
    } catch {
      // Disk trouble costs us the cache entry, never the spoken reply.
    }
  }
}
