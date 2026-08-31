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
 * The honest fix is a native French voice. It is not available here: every
 * native French voice the vendor offers is a library or cloned voice, and a
 * free account cannot use either over the API ("Free users cannot use library
 * voices via the API"), while the free tier's own premade voices are all
 * English. A native French tutor is therefore a paid line item, and until that
 * is bought this file does the next best thing: keep the premade voice, and put
 * it on the model where its French is actually verified.
 *
 * Before changing either constant, read verified_languages from /v2/voices and
 * check the pair. A voice's name tells you nothing.
 */

import { fileURLToPath } from 'node:url';
import * as elevenlabs from '@livekit/agents-plugin-elevenlabs';
import { CachedTTS, type CachedTTSOptions } from './ttsCache.ts';
import { fishVoice } from './voiceFish.ts';

/** Lives inside the service so a repo clone starts cold, not with stale audio. */
export const DEFAULT_CACHE_DIR = fileURLToPath(new URL('../.tts-cache', import.meta.url));

/** The voice vendors this worker can speak through. */
export type VoiceVendor = 'elevenlabs' | 'fish';

type Env = Record<string, string | undefined>;

/**
 * Which voice vendor the .env asks for.
 *
 * Parsed exactly like selectedBrain() in preflight.ts, and for exactly the
 * reason documented there: `??` only falls back on null or undefined, so a
 * `PARLE_TTS_VENDOR=` line in a .env selects the default while reading to a
 * human as "unset". Trim, lowercase, treat empty as absent, and fall back
 * rather than throw on a value nobody recognises — a typo here must not be able
 * to stop a worker booting on the vendor it has always used.
 *
 * ElevenLabs is the default and stays the default. There are hundreds of warmed
 * WAVs on disk keyed to it, and this seam exists to add a vendor, not to move
 * one.
 */
export function selectedVoiceVendor(env: Env = process.env): VoiceVendor {
  const raw = (env.PARLE_TTS_VENDOR ?? '').trim().toLowerCase();
  if (raw === 'fish') return 'fish';
  return 'elevenlabs';
}

/**
 * Which credential each vendor cannot speak without.
 *
 * One table, read by three places that would otherwise each carry their own
 * literal: the agent's preflight, the dev supervisor's env check, and the warm
 * cache script. Demanding the wrong vendor's key is a worker that refuses to
 * boot over a credential it was never going to send.
 *
 * FISH_API_KEY is the name the plugin itself reads, not a name chosen here.
 */
export const VOICE_KEY: Record<VoiceVendor, string> = {
  elevenlabs: 'ELEVEN_API_KEY',
  fish: 'FISH_API_KEY',
};

/**
 * Pinned for two reasons. A plugin upgrade must never be able to move the voice
 * and orphan every cached WAV on its own; and this specific model is the one
 * where the configured premade voice has verified French. On the plugin's own
 * default, eleven_turbo_v2_5, that same voice is verified for English only, and
 * the French it produced there was out of distribution.
 *
 * It costs first-byte time against turbo, and the number is measured rather
 * than feared: three streaming synthesis runs of the same French line, from
 * this machine, gave a median first audio byte of 181ms on turbo and 354ms on
 * multilingual. Call it +170ms. Turbo's spread was also much wider (135 to 369)
 * against multilingual's 340 to 374, so turbo's bad case is not far off
 * multilingual's ordinary one.
 *
 * That is real but it is not the binding term in the turn: the endpointing
 * delay and the brain round-trip are both larger, and the warm cache makes it
 * exactly zero for every scripted line and every fixed conversation line, since
 * a hit replays from disk. Free conversation pays it.
 *
 * It buys a voice whose French the vendor has actually verified, which for a
 * product whose promise is trustworthy pronunciation is not a trade of quality
 * against speed. A beginner imitates what they hear.
 *
 * Re-measure with the [parle:latency] say->audio segment before touching this.
 */
export const MODEL = 'eleven_multilingual_v2';

/**
 * 0 to 4. 3 is the strongest first-byte optimization that keeps the vendor's
 * text normalizer on; 4 turns the normalizer off, which mispronounces numbers
 * and dates. Only the per-sentence HTTP endpoint reads this knob.
 */
const STREAMING_LATENCY = 3;

/**
 * The language the vendor is told to expect, or undefined to let it decide per
 * request.
 *
 * This is not the harmless label it looks like. The plugin resolves it and
 * appends `language_code` to every single request, and the vendor uses it to
 * enforce the language for the model AND for text normalization. The tutor
 * speaks both languages through one voice: French in the scene, English for the
 * opener, the scene-setting narration and every coaching line. Pinning `fr`
 * therefore tells the vendor that the English lines are French.
 *
 * Both models validate this parameter, so it is genuinely read rather than
 * quietly dropped. Probed rather than assumed: an unsupported value comes back
 * as `Model '<name>' does not support language_code '<value>'`, from turbo and
 * multilingual alike.
 *
 * It stays pinned until the two takes have been compared by ear, because the
 * failure mode of guessing wrong in the other direction is a short French line
 * ("Voilà.") being detected as English, which is worse than an accent.
 */
export const LANGUAGE_CODE: string | undefined = 'fr';

/**
 * How the tutor delivers a line, written down instead of inherited from
 * whatever is stored on the voice. Property names are the plugin's own
 * (snake_case, per its VoiceSettings type), and they reach the vendor
 * untouched.
 *
 * These are not the vendor's neutral defaults any more, and that is the point:
 * neutral is what "robotic" sounds like. Lower stability lets delivery vary
 * with the sentence instead of flattening every line to the same contour; style
 * adds expressive range; speaker boost keeps a professional clone sounding like
 * itself while the other two loosen it.
 *
 * The old note here warned that lower stability "varies between takes, and a
 * cache would freeze one arbitrary take forever". True, and only half the
 * picture. It applies to the few dozen warm-cached scripted lines, where the
 * warm run is deliberate and a bad take can be spotted and re-warmed. It does
 * not apply to free conversation, where nearly every line is a fresh miss and
 * the variation is exactly what is wanted.
 *
 * `style` is the one knob here that is not free: raising it costs first-byte
 * time on a turbo model. It went in as a measured change. Read the
 * `[parle:latency]` lines before and after moving it.
 */
export const VOICE_SETTINGS: elevenlabs.VoiceSettings = {
  stability: 0.4,
  similarity_boost: 0.8,
  style: 0.3,
  use_speaker_boost: true,
};

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
function settingsFingerprint(): string {
  const settings = Object.entries(VOICE_SETTINGS)
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

/**
 * `hooks` exists for the agent's latency telemetry; the warm-cache script calls
 * this bare. Nothing here may change what the tutor sounds like.
 *
 * The vendor branch is the only thing PARLE_TTS_VENDOR moves. Everything below
 * it — the model, the voice, the settings, the fingerprint, the voiceKey — is
 * the ElevenLabs configuration exactly as it was before fish existed, because
 * the warmed cache on disk is keyed to that string and a byte of drift throws
 * all of it away.
 */
export function buildTTS(
  hooks: Pick<CachedTTSOptions, 'onFirstAudio'> & Pick<CachedTTSOptions, 'missTransport'> = {},
): CachedTTS {
  const dir = process.env.TTS_CACHE_DIR ?? DEFAULT_CACHE_DIR;

  if (selectedVoiceVendor() === 'fish') {
    const { inner, voiceKey } = fishVoice();
    return new CachedTTS(inner, { dir, voiceKey, ...hooks });
  }

  const voiceId = process.env.ELEVEN_VOICE_ID;
  const inner = new elevenlabs.TTS({
    model: MODEL,
    streamingLatency: STREAMING_LATENCY,
    voiceSettings: VOICE_SETTINGS,
    ...(LANGUAGE_CODE ? { languageCode: LANGUAGE_CODE } : {}),
    ...(voiceId ? { voiceId } : {}),
  });

  const opts: CachedTTSOptions = {
    dir,
    voiceKey: `elevenlabs:${voiceId ?? 'default'}:${inner.model}:${SETTINGS_FINGERPRINT}`,
    ...hooks,
  };
  return new CachedTTS(inner, opts);
}
