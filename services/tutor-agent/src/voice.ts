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
 * the moment to rerun `npm run warm-cache -w @parle/tutor-agent`.
 */

import { fileURLToPath } from 'node:url';
import * as elevenlabs from '@livekit/agents-plugin-elevenlabs';
import { CachedTTS, type CachedTTSOptions } from './ttsCache.ts';

/** Lives inside the service so a repo clone starts cold, not with stale audio. */
export const DEFAULT_CACHE_DIR = fileURLToPath(new URL('../.tts-cache', import.meta.url));

/**
 * The plugin defaults to this model today, but a plugin upgrade must never be
 * able to move the voice, and orphan every cached WAV, on its own.
 */
const MODEL = 'eleven_turbo_v2_5';

/**
 * 0 to 4. 3 is the strongest first-byte optimization that keeps the vendor's
 * text normalizer on; 4 turns the normalizer off, which mispronounces numbers
 * and dates. Only the per-sentence HTTP endpoint reads this knob.
 */
const STREAMING_LATENCY = 3;

/**
 * The vendor's neutral tuning, written down instead of inherited from whatever
 * is stored on the voice. Lower stability varies between takes, and a cache
 * would freeze one arbitrary take forever; higher flattens the tutor's warmth.
 * Property names are the plugin's own (snake_case, per its VoiceSettings type).
 */
const VOICE_SETTINGS: elevenlabs.VoiceSettings = { stability: 0.5, similarity_boost: 0.75 };

/**
 * The delivery settings, folded into the cache key. Derived from the constants
 * above so the fingerprint cannot drift from what is actually sent.
 */
const SETTINGS_FINGERPRINT = `sl${STREAMING_LATENCY}:st${Math.round(VOICE_SETTINGS.stability * 100)}-sb${Math.round(
  VOICE_SETTINGS.similarity_boost * 100,
)}`;

/**
 * `hooks` exists for the agent's latency telemetry; the warm-cache script calls
 * this bare. Nothing here may change what the tutor sounds like.
 */
export function buildTTS(hooks: Pick<CachedTTSOptions, 'onFirstAudio'> = {}): CachedTTS {
  const voiceId = process.env.ELEVEN_VOICE_ID;
  const inner = new elevenlabs.TTS({
    languageCode: 'fr',
    model: MODEL,
    streamingLatency: STREAMING_LATENCY,
    voiceSettings: VOICE_SETTINGS,
    ...(voiceId ? { voiceId } : {}),
  });

  const opts: CachedTTSOptions = {
    dir: process.env.TTS_CACHE_DIR ?? DEFAULT_CACHE_DIR,
    voiceKey: `elevenlabs:${voiceId ?? 'default'}:${inner.model}:${SETTINGS_FINGERPRINT}`,
    ...hooks,
  };
  return new CachedTTS(inner, opts);
}
