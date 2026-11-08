/**
 * One place that decides what the tutor sounds like.
 *
 * The agent and the warm-cache script both build their TTS here, so the cache
 * key (vendor, voice, model, delivery settings) can never drift between them.
 * Drift would mean the warm script fills a cache the agent never reads.
 *
 * Everything that shapes the sound is pinned, not defaulted. The vendor is free
 * to move its default model or its per-voice tuning under us, and either would
 * silently change what learners hear while the cache kept replaying the old
 * sound for scripted lines. Pinning plus a settings fingerprint in the cache
 * key means audio synthesized under one configuration is never replayed under
 * another: change a setting here and the whole cache re-keys, which is exactly
 * the moment to rerun `npm run warm-cache -w @luvani/tutor-agent`.
 *
 * WHICH VOICE, AND ON WHICH MODEL. These are one decision, not two.
 *
 * The vendor publishes, per voice, which languages it is VERIFIED for and on
 * which models. The tutor shipped for months on a combination that was verified
 * for none of what it was doing: an American English stock voice, on a model
 * where that voice has no verified French at all, forced into French by the
 * language code. That is most of what made it sound synthetic, and no amount of
 * better writing would have fixed it.
 *
 * The honest fix was a native French voice, and it is a paid line item: every
 * native French voice the vendor offers is a library or cloned voice, and a
 * free account cannot use either over the API ("Free users cannot use library
 * voices via the API"), while the free tier's own premade voices are all
 * English. That plan is now bought, and there are eight of them.
 *
 * WHICH OF THE EIGHT is no longer a config decision at all — the learner makes
 * it. `ELEVEN_VOICES` below maps their choice to a vendor id, and the model
 * stays pinned across all eight, because every one of them is verified for
 * French AND English on it. Before adding a ninth, read verified_languages from
 * /v2/voices and check the pair. A voice's name tells you nothing.
 */

import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { AudioByteStream, getBaseLanguage, tts } from '@livekit/agents';
import * as elevenlabs from '@livekit/agents-plugin-elevenlabs';
import { DEFAULT_TUTOR_VOICE, isTutorVoiceKey, type TutorVoiceKey } from '@luvani/core';
import { CachedTTS, type CachedTTSOptions } from './ttsCache.ts';
import { fishVoice } from './voiceFish.ts';
// The most previous-sentence context the paid proxy and admission accept, in UTF-8 bytes.
import { ELEVEN_PREVIOUS_TEXT_MAX_BYTES as PREVIOUS_TEXT_MAX_BYTES } from '../../shared/paidExecution.ts';
import { type VoiceVendor, conversationTtsModel, selectedVoiceVendor, VOICE_KEY, ELEVEN_VOICES, MODEL, STREAMING_LATENCY, LANGUAGE_CODE, OUTPUT_ENCODING, VOICE_SETTINGS } from './voiceConfiguration.ts';
export { BEGINNER_SPEED, tutorSpeedFor, conversationTtsModel, CONVERSATION_TTS_MODEL_ENV, selectedVoiceVendor, VOICE_KEY, ELEVEN_VOICES, MODEL, STREAMING_LATENCY, LANGUAGE_CODE, OUTPUT_ENCODING, VOICE_SETTINGS } from './voiceConfiguration.ts';
export type { VoiceVendor } from './voiceConfiguration.ts';

/** Lives inside the service so a repo clone starts cold, not with stale audio. */
export const DEFAULT_CACHE_DIR = fileURLToPath(new URL('../.tts-cache', import.meta.url));

/**
 * Whatever the app sent, turned into a voice this worker can actually speak.
 *
 * This is the authoritative resolve, and it lives here rather than in core or
 * at the token server because this is the LAST hop before a billed vendor URL.
 * The token server shape-checks the value and signs it; core cannot decide a
 * fallback because core is imported by the app. By the time a string reaches
 * this function it has crossed a wire and sat in a stored profile, so it is
 * untrusted no matter whose signature is on it.
 *
 * It never throws, and that is a product decision rather than defensive habit.
 * The room is already open and the learner is already in it: a voice key we
 * retired last month, or a profile written by a newer build, has to become a
 * lesson in Luc's voice, not an exception in a room that has just gone quiet.
 */
export function resolveTutorVoice(raw: unknown): TutorVoiceKey {
  return isTutorVoiceKey(raw) ? raw : DEFAULT_TUTOR_VOICE;
}

/**
 * Every knob that shapes the sound, folded into the cache key.
 *
 * Derived from the settings object rather than hand-listed. The hand-listed
 * version covered stability and similarity boost only, so adding `style`,
 * `use_speaker_boost` or a language code would have changed what the vendor was
 * asked for while the cache went on replaying audio made under the old answer.
 * A knob outside the fingerprint is precisely the drift this file exists to
 * prevent, so the fingerprint now cannot fall behind the settings.
 *
 * Keys are sorted so declaration order can never re-key the cache on its own.
 */
function settingsFingerprint(voiceSettings: Readonly<elevenlabs.VoiceSettings> = VOICE_SETTINGS): string {
  const settings = Object.entries(voiceSettings)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${typeof value === 'number' ? Math.round(value * 100) : String(value)}`)
    .join(',');
  return `sl${STREAMING_LATENCY}:lang=${LANGUAGE_CODE ?? 'auto'}:${settings}`;
}

const SETTINGS_FINGERPRINT = settingsFingerprint();

/**
 * The shortest possible real synthesis request, in exactly the configuration
 * the tutor will use, so preflight can prove the account is allowed to make it.
 *
 * Listing the catalogue is not enough, and the gap is not theoretical. A voice
 * can sit in /v1/voices and still be refused at synthesis: a library voice on a
 * free plan comes back 402 "Free users cannot use library voices via the API",
 * and a voice/model pair the vendor has not verified can be refused too. Both
 * pass every startup check that only reads the catalogue, and both reach the
 * learner the same way the wrong-account 404 did, as a room that opens and a
 * tutor that never speaks.
 *
 * It has to be THIS request, not a representative one. The voice id, the model
 * and the language code are refused as a combination, so a probe that guessed
 * any of them would vouch for a configuration nobody is going to run.
 *
 * Four characters and the smallest output format the vendor offers, because
 * this runs on every worker boot and a dev restarts a lot.
 */
export const PROBE_LINE = 'Oui.';

export function synthesisProbeRequest(voiceId: string): { url: string; body: string } {
  return {
    url: `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_22050_32`,
    body: JSON.stringify({
      text: PROBE_LINE,
      model_id: MODEL,
      voice_settings: VOICE_SETTINGS,
      ...(LANGUAGE_CODE ? { language_code: LANGUAGE_CODE } : {}),
    }),
  };
}

/** The plugin's own default when no paid proxy is in front of the vendor. */
const ELEVEN_BASE_URL = 'https://api.elevenlabs.io/v1';

/** The end of the previous sentence, cut from the front at a space so it fits; '' when nothing fits. */
function boundPrevious(text: string): string {
  let kept = text;
  while (Buffer.byteLength(kept) > PREVIOUS_TEXT_MAX_BYTES) {
    const space = kept.search(/\s/);
    if (space < 0) return '';
    kept = kept.slice(space + 1);
  }
  return kept;
}

/**
 * The stitched request for LUVANI_TTS_STITCH: the plugin's own HTTP request (same
 * URL, headers and body, built from the same pinned constants) plus `previous_text`,
 * which the plugin has no hook to add. Decoded exactly as the plugin does. A
 * refused or non-audio answer throws before any audio, and the cache then asks the
 * plain path for the line. `request` is injectable for the unit test only.
 */
export function elevenStitchedRequest(
  { voiceId, baseURL, apiKey, voiceSettings }: { voiceId: string; baseURL: string; apiKey: string; voiceSettings: Readonly<elevenlabs.VoiceSettings> },
  request: typeof fetch = fetch,
): NonNullable<CachedTTSOptions['stitch']> {
  const url = `${baseURL}/text-to-speech/${voiceId}/stream?output_format=${OUTPUT_ENCODING}&enable_logging=false&optimize_streaming_latency=${STREAMING_LATENCY}`;
  const sampleRate = Number(OUTPUT_ENCODING.split('_')[1]);
  return async function* (text, previousText, model, signal) {
    const previous = boundPrevious(previousText);
    const requestId = randomUUID();
    const bstream = new AudioByteStream(sampleRate, 1);
    let last: tts.SynthesizedAudio['frame'] | undefined;
    try {
      const response = await request(url, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text, model_id: model, voice_settings: voiceSettings, apply_text_normalization: 'auto',
          ...(LANGUAGE_CODE ? { language_code: getBaseLanguage(LANGUAGE_CODE) } : {}),
          ...(previous ? { previous_text: previous } : {}),
        }),
        signal,
      });
      if (!response.ok) { await response.body?.cancel(); throw new Error(`stitched TTS request refused (${response.status})`); }
      if (!(response.headers.get('content-type') ?? '').startsWith('audio/')) { await response.body?.cancel(); throw new Error('stitched TTS answer was not audio'); }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('stitched TTS answer had no body');
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const frame of bstream.write(value)) {
          if (last) yield { requestId, segmentId: requestId, frame: last, final: false };
          last = frame;
        }
      }
      for (const frame of bstream.flush()) {
        if (last) yield { requestId, segmentId: requestId, frame: last, final: false };
        last = frame;
      }
      if (last) yield { requestId, segmentId: requestId, frame: last, final: true };
    } catch (error) {
      // The plugin ends quietly on an abort; so does this.
      if (error instanceof Error && error.name === 'AbortError') return;
      throw error;
    }
  };
}

/**
 * What buildTTS needs to know, flattened on purpose.
 *
 * `voice` is the learner's choice and the rest are the agent's latency hooks.
 * They sit at one level rather than in a nested `hooks` object because
 * `ttsCache.test.ts` reads the warm-cache script's call site with a regex whose
 * `[^}]*` cannot cross a brace, and that tripwire is worth more than the tidier
 * shape. Keep every field here a scalar.
 */
export interface BuildTTSOptions extends Pick<CachedTTSOptions, 'onFirstAudio' | 'missTransport'> {
  /**
   * Which of the eight the learner chose. Defaults to the catalogue default, so
   * a caller that predates the chooser — the warm-cache script, a test — gets
   * Luc rather than the vendor's own default voice, which is the failure this
   * whole file was written to end.
   */
  voice?: TutorVoiceKey;
  /** Per-job paid transport. A real vendor key is held only by its proxy. */
  baseURL?: string;
  /**
   * Build the free-conversation voice when LUVANI_CONVERSATION_TTS_MODEL is
   * set. Only the live agent asks for it. The warm-cache and voice-sample
   * scripts leave it off, so what they synthesize and record is always MODEL.
   */
  conversationTier?: boolean;
  /**
   * The session's live voice speed from tutorSpeedFor, or absent for normal.
   * Present, it reaches both models and the voiceKey (`speed=85` at 0.85), so each
   * speed is its own cache; absent, the key is byte-identical to before.
   */
  speed?: number;
}

/**
 * The hooks exist for the agent's latency telemetry; the warm-cache script
 * calls this with a voice and a transport and nothing else. Nothing here may
 * change what the tutor sounds like beyond the voice it was handed.
 *
 * The vendor branch is the only thing LUVANI_TTS_VENDOR moves. Everything below
 * it — the model, the settings, the fingerprint, the shape of the voiceKey — is
 * the ElevenLabs configuration exactly as it was before fish existed, because
 * the warmed cache on disk is keyed to that string and a byte of drift throws
 * all of it away.
 */
export function buildTTS({ voice = DEFAULT_TUTOR_VOICE, baseURL, conversationTier = false, speed, ...hooks }: BuildTTSOptions = {}): CachedTTS {
  // The range the paid proxy admits. Refused here too, before any vendor work.
  if (speed !== undefined && (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 0.7 || speed > 1.2)) {
    throw new Error('voice speed must be a number from 0.7 to 1.2');
  }
  const dir = process.env.TTS_CACHE_DIR ?? DEFAULT_CACHE_DIR;

  if (selectedVoiceVendor() === 'fish') {
    // fish has one configured voice and no catalogue, so a chosen key has
    // nowhere to go here. That is a real limitation and it is stated rather
    // than hidden: this vendor exists as a free-tier escape hatch, and a
    // learner who picks Céline under it hears whatever FISH_VOICE_ID names.
    // The persona still follows the choice, which is the mismatch to watch for
    // if fish is ever more than a fallback.
    const { inner, voiceKey } = fishVoice();
    return new CachedTTS(inner, { dir, voiceKey, ...hooks });
  }

  // Never the app-level key. A voice re-cloned or re-recorded keeps its
  // catalogue key — that is the point of app-level keys, so a learner's stored
  // preference outlives the recording — and if the cache were keyed by that
  // key, every warmed WAV of the OLD clone would replay under the new one. The
  // vendor id changes when the recording does, so the cache changes with it.
  const voiceId = ELEVEN_VOICES[voice];
  // The settings actually sent, and the fingerprint computed from them, so a
  // slowed line can never replay as a normal-speed one or the other way round.
  const voiceSettings = speed === undefined ? VOICE_SETTINGS : { ...VOICE_SETTINGS, speed };
  const fingerprint = speed === undefined ? SETTINGS_FINGERPRINT : settingsFingerprint(voiceSettings);
  // One constructor for both models, so the conversation voice can differ
  // from the main one in nothing but the model.
  const elevenTTS = (model: string) => new elevenlabs.TTS({
    model,
    streamingLatency: STREAMING_LATENCY,
    voiceSettings,
    ...(LANGUAGE_CODE ? { languageCode: LANGUAGE_CODE } : {}),
    encoding: OUTPUT_ENCODING,
    voiceId,
    enableLogging: false,
    ...(baseURL ? { baseURL, apiKey: 'proxy-only' } : {}),
  });
  const inner = elevenTTS(MODEL);
  // Off (the default) builds nothing extra. Read before the main voice key so
  // an invalid value throws here rather than mid-session.
  const conversationModel = conversationTier ? conversationTtsModel() : null;
  const conversationInner = conversationModel ? elevenTTS(conversationModel) : null;

  const opts: CachedTTSOptions = {
    // `inner.model` rather than MODEL: it is the value the plugin resolved and
    // will actually send, so a plugin that ever normalised the name re-keys the
    // cache instead of replaying audio made under a different one.
    dir,
    voiceKey: `elevenlabs:${voiceId}:${inner.model}:${fingerprint}`,
    ...(conversationInner ? { conversation: { inner: conversationInner, voiceKey: `elevenlabs:${voiceId}:${conversationInner.model}:${fingerprint}` } } : {}),
    // Sentence stitching: off unless exactly 1, ElevenLabs only. It carries no
    // quote identity and changes no cache key; authored lines never use it.
    ...(process.env.LUVANI_TTS_STITCH === '1'
      ? { stitch: elevenStitchedRequest({ voiceId, baseURL: baseURL ?? ELEVEN_BASE_URL, apiKey: baseURL ? 'proxy-only' : process.env.ELEVEN_API_KEY ?? '', voiceSettings }) }
      : {}),
    ...hooks,
  };
  return new CachedTTS(inner, opts);
}
