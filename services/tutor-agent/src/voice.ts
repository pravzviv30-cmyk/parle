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

import { fileURLToPath } from 'node:url';
import * as elevenlabs from '@livekit/agents-plugin-elevenlabs';
import { DEFAULT_TUTOR_VOICE, isTutorVoiceKey, type TutorVoiceKey } from '@luvani/core';
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
 * `LUVANI_TTS_VENDOR=` line in a .env selects the default while reading to a
 * human as "unset". Trim, lowercase, treat empty as absent, and fall back
 * rather than throw on a value nobody recognises — a typo here must not be able
 * to stop a worker booting on the vendor it has always used.
 *
 * ElevenLabs is the default and stays the default. There are hundreds of warmed
 * WAVs on disk keyed to it, and this seam exists to add a vendor, not to move
 * one.
 */
export function selectedVoiceVendor(env: Env = process.env): VoiceVendor {
  const raw = (env.LUVANI_TTS_VENDOR ?? '').trim().toLowerCase();
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
 * The learner's catalogue key to the vendor's id for that voice.
 *
 * THIS IS THE ONLY PLACE VENDOR IDS EXIST. The catalogue in `@luvani/core` is
 * imported by the app, which means it ships to a phone, and an id in it would
 * be an id anyone could read and bill against with a stolen key. This file runs
 * in the one process that holds the ElevenLabs key, so this is where the
 * translation belongs and the only place it can be done safely.
 *
 * `Record<TutorVoiceKey, string>` and not a loose object, deliberately. A voice
 * added to the catalogue and forgotten here is then a COMPILE error, which is
 * the whole point: the alternative failure is a learner picking a real voice,
 * the worker asking the vendor for `undefined`, and a 404 landing as a room
 * that opens and a tutor that never speaks. That is not a bug anyone finds from
 * the outside.
 *
 * Every one of these six is verified by the vendor for French AND for English
 * WITH A FRENCH ACCENT (`en-french`) on the model pinned below. That pairing is
 * not a formality and it is not a claim anyone should take on trust here: the
 * previous eight were described in this very comment as verified for both, and
 * when the vendor was finally asked, not one of them was. Their English came
 * back labelled american, british, singaporean or unlabelled, and the default
 * had no English row at all, which is exactly what a founder heard (F508).
 *
 * So the claim is no longer made in a comment. `npm run voice-samples` reads
 * verified_languages for each id and writes it into the sample manifest beside
 * the clip it made, and the suite fails if what is recorded there stops matching
 * this table or the catalogue's copy. A comment cannot be checked; that can.
 *
 * Preflight still proves on every boot that the account lists all six. It does
 * not check languages, which is why the manifest exists.
 */
export const ELEVEN_VOICES: Record<TutorVoiceKey, string> = {
  alexandre: 'c365oriviHmAhyLhpuN6',
  emilie: 'GYzIdoKkRyANjBvkKYfO',
  guillaume: 'Qrl71rx6Yg8RvyPYRGCQ',
  marie: 'sANWqF1bCMzR6eyZbCGw',
  anatole: 'Jrq4GqCKqYpigdQsZRkP',
  sarah: 'b6nVfb3l2zshrLZTvqbs',
};

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
 * Pinned for two reasons. A plugin upgrade must never be able to move the model
 * and orphan every cached WAV on its own; and this specific model is the one
 * where every voice in ELEVEN_VOICES has verified French AND English. On the
 * plugin's own default, eleven_turbo_v2_5, the voice this file originally
 * shipped with was verified for English only, and the French it produced there
 * was out of distribution. One model across all eight is also what keeps the
 * cache a single fingerprint rather than eight.
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
 * Re-measure with the [luvani:latency] say->audio segment before touching this.
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
 * The wire format the vendor returns, pinned for the same reason everything
 * else in this file is: so a plugin upgrade cannot move the sound on its own.
 * This was the one knob the file forgot, and it inherited the plugin's own
 * `pcm_22050` default for months.
 *
 * 22050 is not a preference, it is the ceiling. `pcm_44100` is refused on this
 * account with `403 Output format 'pcm_44100' is only available on the Pro tier
 * and above`, measured 2026-09-10. Raising it is a subscription decision, not a
 * code one, and it would re-key every cached WAV and widen live bandwidth, so it
 * gets its own change when the plan moves (F506).
 *
 * Pinning the value the plugin was already producing re-keys nothing: the rate
 * has always been part of the cache hash, through `inner.sampleRate`.
 */
export const OUTPUT_ENCODING = 'pcm_22050' as const;

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
 * `[luvani:latency]` lines before and after moving it.
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
export function buildTTS({ voice = DEFAULT_TUTOR_VOICE, ...hooks }: BuildTTSOptions = {}): CachedTTS {
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
  const inner = new elevenlabs.TTS({
    model: MODEL,
    streamingLatency: STREAMING_LATENCY,
    voiceSettings: VOICE_SETTINGS,
    ...(LANGUAGE_CODE ? { languageCode: LANGUAGE_CODE } : {}),
    encoding: OUTPUT_ENCODING,
    voiceId,
  });

  const opts: CachedTTSOptions = {
    // `inner.model` rather than MODEL: it is the value the plugin resolved and
    // will actually send, so a plugin that ever normalised the name re-keys the
    // cache instead of replaying audio made under a different one.
    dir,
    voiceKey: `elevenlabs:${voiceId}:${inner.model}:${SETTINGS_FINGERPRINT}`,
    ...hooks,
  };
  return new CachedTTS(inner, opts);
}
