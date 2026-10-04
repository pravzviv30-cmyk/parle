/**
 * The TTS cache.
 *
 * A lesson's tutor lines are fixed text. Paying a voice vendor to synthesize
 * "Bonjour !" fresh in every session is paying a voice actor to re-record the same
 * line every day. This wrapper synthesizes a line the first time it is spoken,
 * saves the audio as a WAV in a bounded, expiring cache, and replays that entry
 * without another synthesis call.
 *
 * Only explicitly authored, nonpersonal sentences can be persisted. Free-form
 * replies go to the vendor live, including short replies containing learner
 * details. Length alone never makes a line eligible for storage.
 *
 * Mechanics: `capabilities.streaming` is false, so the framework wraps this in
 * its sentence adapter and calls `synthesize()` once per sentence. The cache is
 * therefore sentence-grained, and a recurring sentence hits even when the LLM
 * wraps it in different surroundings.
 *
 * Misses reach the vendor over one of two transports, chosen once at
 * construction. The default is the per-sentence HTTP endpoint: self-contained,
 * and safe for the standalone warm-cache script, whose process must be free to
 * exit the moment the last line lands rather than dangle on an idle vendor
 * socket. Setting LUVANI_TTS_MISS_TRANSPORT=ws in the agent's .env routes misses
 * through the vendor's persistent multi-context websocket instead, sparing each
 * free-conversation sentence a fresh TLS handshake before its first audio
 * byte. Either way the caller sees frames as they arrive. Eligible completed
 * lines are saved; aborted lines and websocket streams without a final marker
 * are never cached. Closing the cache closes the vendor socket.
 */

import { createHash, randomUUID } from 'node:crypto';
import { constants, closeSync, fstatSync, lstatSync, mkdirSync, openSync, opendirSync, readFileSync, renameSync, rmSync, writeFileSync, type Dir } from 'node:fs';
import { join } from 'node:path';
import { AudioFrame } from '@livekit/rtc-node';
import { tts, type APIConnectOptions } from '@livekit/agents';
import { decodeWav, encodeWav } from './wav.ts';
import { AUTHORED_SPEECH_LINES } from './authoredSpeech.ts';

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
  /** Explicit authored nonpersonal sentences. Length alone never authorizes persistence. */
  authoredLines?: readonly string[];
  /** Fixed slots make eviction atomic across SDK jobs; colliding fingerprints are misses. */
  cacheSlots?: number;
  maxEntryBytes?: number;
  ttlMs?: number;
  /**
   * How a cache miss reaches the vendor. Defaults to the environment seam
   * (LUVANI_TTS_MISS_TRANSPORT), which defaults to 'http'; see the file header
   * for why 'ws' is an opt-in.
   */
  missTransport?: 'ws' | 'http';
  /**
   * Called once per synthesis, on its first audio frame, with whether that
   * audio came from disk. Latency telemetry only: it must never affect the
   * audio, so anything it throws is swallowed.
   */
  onFirstAudio?: (info: { hit: boolean }) => void;
}

/** The options with defaults applied; the telemetry hook stays optional. */
type ResolvedCachedTTSOptions = Required<Omit<CachedTTSOptions, 'onFirstAudio'>> &
  Pick<CachedTTSOptions, 'onFirstAudio'>;

const DEFAULT_MAX_TEXT = 220;
export const AUTHORED_CACHE_VERSION = 'authored-v1';
const DEFAULT_CACHE_SLOTS = 1_024;
const DEFAULT_MAX_ENTRY_BYTES = 512 * 1_024;
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const SWEEP_BATCH = 32;
const LEGACY_WAV = /^[a-f0-9]{40}\.wav$/;
const SLOT_FILE = /^\d{4}\.(?:wav|pending)$/;
/** Cache-hit audio is emitted in chunks of this many milliseconds. */
const REPLAY_CHUNK_MS = 100;

/** Anything other than an explicit 'ws' means the safe-everywhere default. */
function defaultMissTransport(): 'ws' | 'http' {
  return process.env.LUVANI_TTS_MISS_TRANSPORT === 'ws' ? 'ws' : 'http';
}

/** Cache keys survive harmless whitespace differences but respect punctuation. */
export function normaliseLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export class CachedTTS extends tts.TTS {
  label = 'luvani.CachedTTS';
  readonly inner: tts.TTS;
  readonly opts: ResolvedCachedTTSOptions;
  readonly cacheDirectory: string;
  readonly #allowed: ReadonlySet<string>;
  #legacyScan: Dir | null = null;
  #slotScan: Dir | null = null;
  /** Running counters, logged by the agent so cost per session stays visible. */
  hits = 0;
  misses = 0;

  constructor(inner: tts.TTS, opts: CachedTTSOptions) {
    // Declaring streaming:false makes the framework sentence-split for us.
    super(inner.sampleRate, inner.numChannels, { streaming: false });
    this.inner = inner;
    this.opts = { maxTextLength: DEFAULT_MAX_TEXT, missTransport: defaultMissTransport(), authoredLines: AUTHORED_SPEECH_LINES,
      cacheSlots: DEFAULT_CACHE_SLOTS, maxEntryBytes: DEFAULT_MAX_ENTRY_BYTES, ttlMs: DEFAULT_TTL_MS, ...opts };
    if (!Number.isInteger(this.opts.cacheSlots) || this.opts.cacheSlots < 1 || this.opts.cacheSlots > DEFAULT_CACHE_SLOTS
      || !Number.isInteger(this.opts.maxEntryBytes) || this.opts.maxEntryBytes < 128 || this.opts.maxEntryBytes > DEFAULT_MAX_ENTRY_BYTES
      || !Number.isFinite(this.opts.ttlMs) || this.opts.ttlMs <= 0 || this.opts.ttlMs > DEFAULT_TTL_MS) throw new RangeError('Invalid authored cache bound');
    this.#allowed = new Set(this.opts.authoredLines.map(normaliseLine).filter(line => line.length > 0));
    this.cacheDirectory = join(this.opts.dir, AUTHORED_CACHE_VERSION);
    // Failure or a symlink disables persistence; speech continues live.
    try { mkdirSync(this.opts.dir, { recursive: true }); } catch { /* cache optional */ }
    this.maintain();
  }

  override get model(): string {
    return this.inner.model;
  }

  override get provider(): string {
    return `cached(${this.inner.provider})`;
  }

  cachePath(text: string): string {
    const slot = Number.parseInt(this.fingerprint(text).slice(0, 8), 16) % this.opts.cacheSlots;
    return join(this.cacheDirectory, `${String(slot).padStart(4, '0')}.wav`);
  }

  fingerprint(text: string): string {
    return createHash('sha256').update(`${AUTHORED_CACHE_VERSION}\n${this.opts.voiceKey}\n${this.inner.sampleRate}\n${normaliseLine(text)}`).digest('hex');
  }

  cacheable(text: string): boolean { return text.length <= this.opts.maxTextLength && this.#allowed.has(normaliseLine(text)); }

  private safeDirectory(path: string): boolean {
    try { const info = lstatSync(path); return info.isDirectory() && !info.isSymbolicLink(); } catch { return false; }
  }

  /** Legacy files are never read. Incremental cleanup touches recognizable owned files only. */
  maintain(): void {
    if (!this.safeDirectory(this.opts.dir)) return;
    const sweep = (path: string, prior: Dir | null, legacy: boolean): Dir | null => {
      if (!this.safeDirectory(path)) { try { prior?.closeSync(); } catch { /* closed */ } return null; }
      let scan = prior;
      try {
        scan ??= opendirSync(path);
        for (let i = 0; i < SWEEP_BATCH; i++) {
          const entry = scan.readSync();
          if (!entry) { scan.closeSync(); return null; }
          if (!entry.isFile() || !(legacy ? LEGACY_WAV : SLOT_FILE).test(entry.name)) continue;
          const file = join(path, entry.name);
          try {
            const info = lstatSync(file);
            if (!info.isFile() || info.isSymbolicLink()) continue;
            const age = Date.now() - info.mtimeMs;
            if (legacy || age >= (entry.name.endsWith('.pending') ? 60_000 : this.opts.ttlMs)) rmSync(file, { force: true });
          } catch { /* A concurrent job may already have replaced/evicted it. */ }
        }
        return scan;
      } catch { try { scan?.closeSync(); } catch { /* already closed */ } return null; }
    };
    this.#legacyScan = sweep(this.opts.dir, this.#legacyScan, true);
    this.#slotScan = sweep(this.cacheDirectory, this.#slotScan, false);
  }

  readLine(text: string): Buffer | null {
    if (!this.safeDirectory(this.opts.dir) || !this.safeDirectory(this.cacheDirectory)) return null;
    let fd: number | undefined;
    try {
      fd = openSync(this.cachePath(text), constants.O_RDONLY | constants.O_NOFOLLOW);
      const info = fstatSync(fd);
      if (!info.isFile() || info.size > this.opts.maxEntryBytes || Date.now() - info.mtimeMs >= this.opts.ttlMs) return null;
      const wav = readFileSync(fd);
      // The standard WAV extras chunk keeps the file playable and binds a slot
      // to its complete voice/text identity. A collision never replays another line.
      if (wav.toString('ascii', 36, 40) !== 'LVC1' || wav.readUInt32LE(40) !== 64 || wav.toString('ascii', 44, 108) !== this.fingerprint(text)) return null;
      decodeWav(wav);
      return wav;
    } catch { return null; } finally { if (fd !== undefined) try { closeSync(fd); } catch { /* cache optional */ } }
  }

  writeLine(text: string, pcmWav: Buffer): void {
    if (!this.cacheable(text) || !this.safeDirectory(this.opts.dir)) return;
    this.maintain();
    try { mkdirSync(this.cacheDirectory); } catch { /* already exists, or refuse below */ }
    if (!this.safeDirectory(this.cacheDirectory)) return;
    const metadata = Buffer.alloc(72);
    metadata.write('LVC1', 0, 'ascii'); metadata.writeUInt32LE(64, 4); metadata.write(this.fingerprint(text), 8, 'ascii');
    const wav = Buffer.concat([pcmWav.subarray(0, 36), metadata, pcmWav.subarray(36)]);
    if (wav.length > this.opts.maxEntryBytes) return;
    wav.writeUInt32LE(wav.length - 8, 4);
    const path = this.cachePath(text);
    // One exclusive temporary file per slot bounds crash leftovers too. A
    // concurrent writer simply skips persistence; its audio was already served.
    const tmp = path.replace(/\.wav$/, '.pending');
    let fd: number | undefined;
    let owned: { dev: number; ino: number } | undefined;
    try {
      fd = openSync(tmp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      const info = fstatSync(fd); owned = { dev: info.dev, ino: info.ino };
      writeFileSync(fd, wav); closeSync(fd); fd = undefined;
      renameSync(tmp, path);
      owned = undefined;
    } catch { /* Disk/contention costs a cache entry, never the spoken reply. */ }
    finally {
      if (fd !== undefined) try { closeSync(fd); } catch { /* cache optional */ }
      // A stale-lock sweep in another job may have replaced this path. Never
      // remove its pending write when cleaning up our own failed write.
      if (owned) try { const info = lstatSync(tmp); if (info.dev === owned.dev && info.ino === owned.ino) rmSync(tmp, { force: true }); } catch { /* already gone */ }
    }
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

  override async close(): Promise<void> {
    // The ws transport keeps a persistent vendor connection alive inside the
    // inner TTS; closing the cache must close it, or a finished agent process
    // would idle on an open socket.
    for (const scan of [this.#legacyScan, this.#slotScan]) try { scan?.closeSync(); } catch { /* closed */ }
    this.#legacyScan = null; this.#slotScan = null;
    await this.inner.close();
  }
}

class CachedChunkedStream extends tts.ChunkedStream {
  label = 'luvani.CachedChunkedStream';
  readonly #cache: CachedTTS;
  /** Forwarded to the vendor so the session's retry policy applies end to end. */
  readonly #connOptions?: APIConnectOptions;
  #firstAudioReported = false;

  constructor(text: string, cache: CachedTTS, connOptions?: APIConnectOptions, abortSignal?: AbortSignal) {
    super(text, cache, connOptions, abortSignal);
    this.#cache = cache;
    this.#connOptions = connOptions;
  }

  protected async run(): Promise<void> {
    const text = this.inputText;
    const cacheable = this.#cache.cacheable(text);
    const path = this.#cache.cachePath(text);

    this.#cache.maintain();
    const saved = cacheable ? this.#cache.readLine(text) : null;
    if (saved) {
      try {
        this.#replay(saved);
        this.#cache.hits += 1;
        return;
      } catch {
        // A corrupt file must never break the tutor's voice mid-sentence.
        // Remove it and fall through to live synthesis, which rewrites it.
        // A corrupt entry is overwritten atomically after a successful miss.
      }
    }

    if (this.#cache.opts.missTransport === 'ws') {
      await this.#missViaStream(path, cacheable);
    } else {
      await this.#passthrough(path, cacheable);
    }
    this.#cache.misses += 1;
  }

  /** Tell the telemetry hook, if any, that this synthesis just made a sound. */
  #reportFirstAudio(hit: boolean): void {
    if (this.#firstAudioReported) return;
    this.#firstAudioReported = true;
    try {
      this.#cache.opts.onFirstAudio?.({ hit });
    } catch {
      // Telemetry must never cost the learner audio.
    }
  }

  /** Emit a cached WAV as audio frames, in modest chunks so playout starts fast. */
  #replay(file: Buffer): void {
    const wav = decodeWav(file);
    this.#reportFirstAudio(true);
    const requestId = randomUUID();
    const perChunk = Math.max(1, Math.round((wav.sampleRate * REPLAY_CHUNK_MS) / 1000)) * wav.channels;

    for (let offset = 0; offset < wav.samples.length; offset += perChunk) {
      const slice = wav.samples.subarray(offset, Math.min(offset + perChunk, wav.samples.length));
      const frame = new AudioFrame(new Int16Array(slice), wav.sampleRate, wav.channels, slice.length / wav.channels);
      const final = offset + perChunk >= wav.samples.length;
      this.queue.put({ requestId, segmentId: requestId, frame, final });
    }
  }

  /** Live synthesis over per-sentence HTTP, teeing to disk when the line succeeds. */
  async #passthrough(path: string, cacheable: boolean): Promise<void> {
    const innerStream = this.#cache.inner.synthesize(this.inputText, this.#connOptions, this.abortSignal);
    const collected: AudioFrame[] = [];
    let collectedBytes = 116;

    for await (const packet of innerStream) {
      this.#reportFirstAudio(false);
      if (cacheable) {
        collectedBytes += packet.frame.data.byteLength;
        if (collectedBytes <= this.#cache.opts.maxEntryBytes) collected.push(packet.frame);
        else { collected.length = 0; cacheable = false; }
      }
      this.queue.put(packet);
    }

    // Only a complete, non-empty line is worth keeping. A failed request yields
    // nothing above and nothing is written.
    if (this.abortSignal.aborted || !cacheable || collected.length === 0) return;
    this.#writeWav(path, collected);
  }

  /**
   * Live synthesis over the vendor's persistent websocket. The framework has
   * already sentence-split, so the whole input is one push followed by end of
   * input; frames are forwarded the moment they arrive and teed for the disk
   * write. Two rules keep barge-ins clean: an abort closes the vendor stream,
   * which closes its context on the wire so a cut-off line cannot keep
   * synthesizing into the next turn, and nothing reaches disk unless the
   * vendor's own final marker arrived, so a truncated line is never replayed.
   */
  async #missViaStream(path: string, cacheable: boolean): Promise<void> {
    const innerStream = this.#cache.inner.stream(this.#connOptions ? { connOptions: this.#connOptions } : undefined);
    innerStream.pushText(this.inputText);
    innerStream.endInput();

    const closeInner = () => innerStream.close();
    if (this.abortSignal.aborted) closeInner();
    else this.abortSignal.addEventListener('abort', closeInner, { once: true });

    const collected: AudioFrame[] = [];
    let collectedBytes = 116;
    let sawFinal = false;
    try {
      for await (const packet of innerStream) {
        if (packet === tts.SynthesizeStream.END_OF_STREAM) continue;
        if (this.closed || this.abortSignal.aborted) break;
        this.#reportFirstAudio(false);
        if (cacheable) {
          collectedBytes += packet.frame.data.byteLength;
          if (collectedBytes <= this.#cache.opts.maxEntryBytes) collected.push(packet.frame);
          else { collected.length = 0; cacheable = false; }
        }
        this.queue.put(packet);
        sawFinal = packet.final;
      }
    } finally {
      this.abortSignal.removeEventListener('abort', closeInner);
    }

    if (this.abortSignal.aborted || !sawFinal) return;
    if (!cacheable || collected.length === 0) return;
    this.#writeWav(path, collected);
  }

  /** One WAV per completed line, written atomically so readers never see halves. */
  #writeWav(path: string, collected: AudioFrame[]): void {
    const first = collected[0]!;
    const total = collected.reduce((n, f) => n + f.data.length, 0);
    const samples = new Int16Array(total);
    let offset = 0;
    for (const f of collected) {
      samples.set(f.data, offset);
      offset += f.data.length;
    }

    try {
      this.#cache.writeLine(this.inputText, encodeWav({ sampleRate: first.sampleRate, channels: first.channels, samples }));
    } catch {
      // Disk trouble costs us the cache entry, never the spoken reply.
    }
  }
}
