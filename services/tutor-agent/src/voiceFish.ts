/**
 * Everything fish.audio, in one file, so that ElevenLabs cannot move by
 * accident.
 *
 * This exists for one reason: the tutor is a man from Lyon and he has been
 * speaking in an American woman's voice, because every native French voice
 * ElevenLabs offers is a library or cloned voice and a free account cannot use
 * either over the API. fish.audio sells French voices its free tier will
 * actually synthesize, so it is here as a SECOND vendor behind LUVANI_TTS_VENDOR
 * — not as a replacement. ElevenLabs stays the default, byte for byte, because
 * the warmed cache on disk is keyed to it.
 *
 * Three things in here are load-bearing and none of them is obvious.
 *
 * THE MODEL IS THE BILL. fish sends the model as an HTTP header, not as a body
 * field, and an omitted or unrecognised header falls back to the PAID s2.1-pro.
 * The plugin's own default is that paid model. So leaving the model alone does
 * not mean "whatever fish gives me for free", it means "$15 per million UTF-8
 * bytes, quietly". Verified live: omitting the header on a zero-credit account
 * returns 402. `s2.1-pro-free` is pinned here and overridable by FISH_MODEL for
 * the day the free window closes.
 *
 * THE VOICE IS THE WHOLE POINT. The plugin ships its own default reference_id,
 * and fish's default voice is "Sarah", a young American woman — which is the
 * exact bug this migration exists to escape, reproduced under a new vendor.
 * FISH_VOICE_ID unset is therefore a warning in preflight, not a shrug.
 *
 * THE FINAL MARKER IS MISSING. See the adapter at the bottom of this file.
 */

import { tts } from '@livekit/agents';
import type { APIConnectOptions } from '@livekit/agents';
import * as fishaudio from '@livekit/agents-plugin-fishaudio';

type Env = Record<string, string | undefined>;

/**
 * The only model fish's free tier serves, and the reason this file pins a model
 * at all. fish reads `model:` as a request HEADER; omit it and the plugin sends
 * its own default, `s2.1-pro`, which is the paid one. A silent, billable
 * fallback is not a default anyone chose, so it is written down here.
 *
 * The free window was published to end 2026-08-31. When it closes this model
 * starts answering 402, which is why the preflight synthesis probe runs on
 * every boot under fish rather than only when a voice is configured. `s2-pro`
 * is the paid escape, set through FISH_MODEL.
 */
const DEFAULT_FISH_MODEL = 's2.1-pro-free';

/**
 * Raw PCM at fish's own rate, stated rather than inherited. The plugin defaults
 * to the same number today; pinning it means a plugin bump cannot re-key every
 * cached WAV on its own, exactly as MODEL does for ElevenLabs. The cache path
 * already folds the sample rate in (ttsCache.cachePath), so it does not need to
 * be in the fingerprint below as well.
 */
export const FISH_SAMPLE_RATE = 24_000;

/**
 * How the tutor delivers a line on fish, written down instead of inherited.
 *
 * Property names are the plugin's own, and the type is derived from the
 * plugin's own options interface so a rename upstream fails typecheck here
 * rather than silently dropping a knob on the floor.
 *
 * These are the plugin's current defaults, pinned rather than changed. That is
 * deliberate: the point of this pass is a French voice, not a new delivery, and
 * a settings change and a vendor change landing together would make a bad take
 * impossible to attribute. `latencyMode: 'low'` is the obvious next experiment
 * and it is a measured change, not a free one — read the `[luvani:latency]`
 * say->audio segment before and after.
 */
export const FISH_SETTINGS: Required<
  Pick<fishaudio.TTSOptions, 'latencyMode' | 'chunkLength' | 'temperature' | 'topP' | 'normalize'>
> = {
  latencyMode: 'balanced',
  chunkLength: 100,
  temperature: 0.7,
  topP: 0.7,
  normalize: true,
};

/**
 * Every knob that shapes the sound, folded into the cache key.
 *
 * Derived from FISH_SETTINGS rather than hand-listed, for the reason
 * voice.ts:settingsFingerprint gives: a hand-listed fingerprint falls behind
 * the settings it is meant to describe, and the cache then replays audio made
 * under an answer nobody is asking for any more. Keys are sorted so declaration
 * order alone can never re-key the cache.
 */
function settingsFingerprint(): string {
  return Object.entries(FISH_SETTINGS)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${typeof value === 'number' ? Math.round(value * 100) : String(value)}`)
    .join(',');
}

const SETTINGS_FINGERPRINT = settingsFingerprint();

/** The model the worker will actually ask for. FISH_MODEL overrides the pin. */
export function fishModel(env: Env = process.env): string {
  const raw = (env.FISH_MODEL ?? '').trim();
  return raw === '' ? DEFAULT_FISH_MODEL : raw;
}

/** The configured voice, or undefined for fish's own default — see the header. */
export function fishVoiceId(env: Env = process.env): string | undefined {
  const raw = (env.FISH_VOICE_ID ?? '').trim();
  return raw === '' ? undefined : raw;
}

/** Vendor, voice, model and every delivery knob, so none of them can drift. */
export function fishVoiceKey(env: Env = process.env): string {
  return `fish:${fishVoiceId(env) ?? 'default'}:${fishModel(env)}:${SETTINGS_FINGERPRINT}`;
}

/**
 * The shortest possible real synthesis request, in exactly the configuration
 * the tutor will use, so preflight can prove the account is allowed to make it.
 *
 * JSON rather than msgpack on purpose: verified against the live endpoint, and
 * msgpack is only needed for inline voice cloning, which the tutor never does.
 * Keeping it a JSON string means preflight's FetchLike (`body?: string`) needs
 * no widening for a probe.
 *
 * The `model` header is the billed one and the one that 402s when the free
 * window closes, so it rides on the probe exactly as it rides on every real
 * request. A probe that omitted it would vouch for the paid model.
 */
export function fishSynthesisProbeRequest(
  apiKey: string,
  probeLine: string,
  env: Env = process.env,
): { url: string; headers: Record<string, string>; body: string } {
  return {
    url: 'https://api.fish.audio/v1/tts',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      model: fishModel(env),
    },
    // The plugin's own wire shape, so the probe asks for what the tutor asks for.
    body: JSON.stringify({
      text: probeLine,
      chunk_length: FISH_SETTINGS.chunkLength,
      format: 'pcm',
      sample_rate: FISH_SAMPLE_RATE,
      references: [],
      reference_id: fishVoiceId(env) ?? null,
      normalize: FISH_SETTINGS.normalize,
      latency: FISH_SETTINGS.latencyMode,
      prosody: null,
      top_p: FISH_SETTINGS.topP,
      temperature: FISH_SETTINGS.temperature,
    }),
  };
}

/**
 * The fish TTS the cache should wrap, and the key its audio is filed under.
 *
 * voice.ts owns the cache directory and the telemetry hooks, so this returns
 * the two things only fish can answer and nothing else.
 */
export function fishVoice(env: Env = process.env): { inner: tts.TTS; voiceKey: string } {
  const voiceId = fishVoiceId(env);
  const inner = new fishaudio.TTS({
    model: fishModel(env),
    sampleRate: FISH_SAMPLE_RATE,
    ...FISH_SETTINGS,
    ...(voiceId ? { voiceId } : {}),
  });
  return { inner: holdLastPacketFinal(inner), voiceKey: fishVoiceKey(env) };
}

// ─────────────────────────────────────────── the missing final marker (F276)

/**
 * fish never says a line is finished, so this says it for fish — carefully.
 *
 * The failure being repaired. `ttsCache.ts` will not write a WAV unless the
 * last packet it saw carried `final: true`, which is the rule that stops a
 * barged-in or truncated line being replayed forever. fish's websocket stream
 * emits `final: false` on EVERY audio frame and only marks the last frame of
 * the `bstream.flush()` remainder — and that remainder is EMPTY whenever the
 * audio happens to land on an exact 4800-byte boundary. Its HTTP stream is
 * worse: both emit sites hardcode `final: false`.
 *
 * With LUVANI_TTS_MISS_TRANSPORT=ws, which is what the founder runs, that means
 * the cache silently stops caching. Audio plays, spend rises, and no test
 * fails. That is the worst shape a bug can have.
 *
 * The repair belongs here and not in ttsCache.ts. ttsCache's rule is right:
 * only the vendor's own word that a line finished may put it on disk. What is
 * wrong is that fish's word arrives as "the stream ended cleanly" rather than
 * as a flag on the last packet, so this adapter translates one into the other
 * at the vendor seam and leaves the cache's guarantee exactly as strict.
 *
 * How it stays strict: the last packet is held back until the outcome is known.
 *
 *   - Clean end (fish's END_OF_STREAM sentinel arrived) -> the held packet is
 *     emitted with `final` coerced true, then the sentinel.
 *   - Error (the queue closed with no sentinel — which is precisely what fish
 *     does when its `finish` event carries reason=error, or the socket drops)
 *     -> the held packet is emitted UNCHANGED, so nothing is ever marked final
 *     and nothing reaches disk.
 *   - Abort (barge-in) -> nothing more is emitted and the inner stream is
 *     closed, which closes fish's context on the wire.
 *
 * The sentinel, not "the iteration ended", is what counts as clean. The
 * framework swallows a failing `run()` and closes the queue, so an errored
 * stream and a finished one look identical from the outside except for that
 * sentinel. Treating a bare end as success would put half a sentence on disk
 * and replay it to a learner forever, which is the exact thing ttsCache refuses
 * to do.
 *
 * What holding a packet costs, stated rather than hidden. The first audio frame
 * is not forwarded until a second one proves it was not the last, so first-byte
 * time on a websocket miss grows by whatever gap fish leaves between two frames
 * — or, on a one-frame line, by the gap between the last audio message and the
 * `finish` event. A frame here is 100ms of audio (AudioByteStream defaults to
 * sampleRate/10 samples, which is the 4800 bytes above), and fish generates
 * well faster than realtime, so the gap is a fraction of that. It is not free
 * and it is not measured yet: read the `[luvani:latency]` say->audio segment on
 * fish before deciding it does not matter.
 *
 * Only `stream()` is wrapped. `synthesize()` passes straight through, because
 * ttsCache's HTTP path (`#passthrough`) never reads `final` at all.
 */
export function holdLastPacketFinal(inner: tts.TTS): tts.TTS {
  return new FinalMarkingTTS(inner);
}

class FinalMarkingTTS extends tts.TTS {
  label = 'luvani.FinalMarkingTTS';
  readonly inner: tts.TTS;

  constructor(inner: tts.TTS) {
    super(inner.sampleRate, inner.numChannels, inner.capabilities);
    this.inner = inner;
  }

  override get model(): string {
    return this.inner.model;
  }

  override get provider(): string {
    return this.inner.provider;
  }

  /** Untouched: the per-sentence HTTP path never reads `final`. */
  synthesize(text: string, connOptions?: APIConnectOptions, abortSignal?: AbortSignal): tts.ChunkedStream {
    return this.inner.synthesize(text, connOptions, abortSignal);
  }

  stream(options?: { connOptions?: APIConnectOptions }): tts.SynthesizeStream {
    return new FinalMarkingStream(this, this.inner.stream(options), options?.connOptions);
  }

  override async close(): Promise<void> {
    await this.inner.close();
  }
}

class FinalMarkingStream extends tts.SynthesizeStream {
  label = 'luvani.FinalMarkingStream';
  readonly #inner: tts.SynthesizeStream;

  constructor(owner: tts.TTS, inner: tts.SynthesizeStream, connOptions?: APIConnectOptions) {
    super(owner, connOptions);
    this.#inner = inner;
  }

  /**
   * A barge-in has to reach the vendor, not just this wrapper. Closing the
   * inner stream is what tears fish's websocket context down, so a cut-off line
   * cannot keep synthesizing into the next turn.
   */
  override close(): void {
    this.#inner.close();
    super.close();
  }

  protected async run(): Promise<void> {
    // Text in, unchanged. Not awaited: the loop below cannot finish until the
    // vendor is done, which cannot happen until this has forwarded endInput.
    const forwarding = (async () => {
      for await (const item of this.input) {
        if (typeof item === 'string') this.#inner.pushText(item);
        else this.#inner.flush();
      }
      this.#inner.endInput();
    })().catch(() => {
      // The inner stream refusing more text is not a reason to lose the audio
      // already in flight; the outcome rules below still decide the line.
    });
    void forwarding;

    const emit = (packet: tts.SynthesizedAudio | typeof tts.SynthesizeStream.END_OF_STREAM): void => {
      if (!this.queue.closed) this.queue.put(packet);
    };

    let held: tts.SynthesizedAudio | undefined;
    let clean = false;
    try {
      for await (const packet of this.#inner) {
        if (packet === tts.SynthesizeStream.END_OF_STREAM) {
          clean = true;
          break;
        }
        // One packet behind, always in order: whatever was held is released the
        // moment a successor proves it was not the last.
        if (held !== undefined) emit(held);
        held = undefined;
        // A vendor that marks its own final is believed and forwarded as it is,
        // exactly once. Nothing here may invent a second one.
        if (packet.final) emit(packet);
        else held = packet;
      }
    } catch {
      // Reaching here means the failure escaped the framework's own swallowing.
      // Same rule either way: no sentinel, so no final marker, so no disk.
      clean = false;
    }

    if (this.abortController.signal.aborted || this.closed) return;
    if (held !== undefined) emit(clean ? { ...held, final: true } : held);
    if (clean) emit(tts.SynthesizeStream.END_OF_STREAM);
  }
}
