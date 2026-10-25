/** Immutable shared server configuration; never import this into a phone bundle.
 * Live tutor pins are shared here; approved changes are documented beside each value.
 */
import type * as elevenlabs from '@livekit/agents-plugin-elevenlabs';
import { isTutorVoiceKey, type TutorVoiceKey } from '@luvani/core';
import { createHash } from 'node:crypto';
type Env = Record<string, string | undefined>;
/** The voice vendors this worker can speak through. */
export type VoiceVendor = 'elevenlabs' | 'fish';

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
export const VOICE_KEY: Readonly<Record<VoiceVendor, string>> = Object.freeze({
  elevenlabs: 'ELEVEN_API_KEY',
  fish: 'FISH_API_KEY',
});

/**
 * The learner's catalogue key to the vendor's id for that voice.
 *
 * The server-only voiceConfiguration.ts is the only vendor-id table. The catalogue in `@luvani/core` is
 * imported by the app, which means it ships to a phone, and an id in it would
 * be an id anyone could read and bill against with a stolen key. This shared table is server-only; live and saved-phrase synthesis read the
 * same mapping without importing it into the app.
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
export const ELEVEN_VOICES: Readonly<Record<TutorVoiceKey, string>> = Object.freeze({
  alexandre: 'c365oriviHmAhyLhpuN6',
  emilie: 'GYzIdoKkRyANjBvkKYfO',
  guillaume: 'Qrl71rx6Yg8RvyPYRGCQ',
  marie: 'sANWqF1bCMzR6eyZbCGw',
  anatole: 'Jrq4GqCKqYpigdQsZRkP',
  sarah: 'b6nVfb3l2zshrLZTvqbs',
});

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
 *
 * Every authored (scripted) line always uses this model, and so does the disk
 * cache. The opt-in LUVANI_CONVERSATION_TTS_MODEL switch (see
 * conversationTtsModel below) moves only free-conversation lines to
 * eleven_flash_v2_5, at half the price per character. It is off by default.
 */
export const MODEL = 'eleven_multilingual_v2';

/** The env variable for the free-conversation voice model, and the only value it accepts. */
export const CONVERSATION_TTS_MODEL_ENV = 'LUVANI_CONVERSATION_TTS_MODEL';
export const CONVERSATION_TTS_MODELS: readonly string[] = Object.freeze(['eleven_flash_v2_5']);

/**
 * The model free-conversation (non-authored) lines use, or null when they use
 * MODEL like everything else. Unset or empty is off. Any value other than
 * eleven_flash_v2_5 throws, naming the variable, because a typo here would
 * otherwise bill a model nobody listened to. Under the fish vendor the switch
 * means nothing and is ignored (preflight warns).
 */
export function conversationTtsModel(env: Env = process.env): string | null {
  const raw = (env[CONVERSATION_TTS_MODEL_ENV] ?? '').trim();
  if (raw === '') return null;
  if (!CONVERSATION_TTS_MODELS.includes(raw)) {
    throw new Error(`${CONVERSATION_TTS_MODEL_ENV} must be unset or one of: ${CONVERSATION_TTS_MODELS.join(', ')}`);
  }
  return selectedVoiceVendor(env) === 'elevenlabs' ? raw : null;
}

/**
 * 0 to 4. 3 is the strongest first-byte optimization that keeps the vendor's
 * text normalizer on; 4 turns the normalizer off, which mispronounces numbers
 * and dates. Only the per-sentence HTTP endpoint reads this knob.
 */
export const STREAMING_LATENCY = 3;

/**
 * Omit the language pin for the bilingual live tutor. On 3 October 2026 the
 * founder compared six Alexandre recordings (English time, English money and
 * a French control, each with/without the pin) and preferred the unpinned
 * English while confirming the French remained natural. This is listening
 * evidence for Alexandre; it does not establish every voice or ASR behavior.
 *
 * The model, settings, format and latency remain unchanged. Both live and
 * saved-phrase cache fingerprints include this choice. Frozen French-only
 * recording batches use their own explicit RECORDING_LANGUAGE in the plan.
 */
export const LANGUAGE_CODE: string | undefined = undefined;

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
export const VOICE_SETTINGS: Readonly<elevenlabs.VoiceSettings> = Object.freeze({
  stability: 0.4,
  similarity_boost: 0.8,
  style: 0.3,
  use_speaker_boost: true,
});

/**
 * The slower live voice for beginners (VOICE-013). Measured 2026-10-25
 * (docs/cogs-evidence/voice-speed-2026-10-25.json): 0.9 was only about 5%
 * slower than 1.0; 0.85 is about 17% slower with Deepgram word accuracy 1.00,
 * and billed credits were identical at every speed.
 *
 * Deliberately NOT in VOICE_SETTINGS: the bundled clips, saved-phrase Hear and
 * the build scripts fingerprint those settings, and must stay byte-identical.
 * Speed is a per-session choice that buildTTS folds into the live voiceKey, so
 * each speed is its own cache. ElevenLabs bills characters, not pace.
 */
export const BEGINNER_SPEED = 0.85;

/**
 * The live voice speed for a session, decided once at session start, or
 * undefined for the vendor's normal speed (which keeps today's cache keys).
 * The learner's switch wins either way. Without it, scripted lessons and
 * scenes are A0 content and run slower; a conversation runs slower until the
 * profile estimate reaches A2. No estimate means a new profile, which is A0.
 */
export function tutorSpeedFor({ kind, cefr, choice }: { kind: 'lesson' | 'scene' | 'convo'; cefr?: string; choice?: 'slower' | 'normal' }): number | undefined {
  if (choice === 'slower') return BEGINNER_SPEED;
  if (choice === 'normal') return undefined;
  if (kind !== 'convo') return BEGINNER_SPEED;
  return /^(A2|B1|B2|C1|C2)$/.test(cefr ?? '') ? undefined : BEGINNER_SPEED;
}

/** No catalogue fallback: a dynamic Hear must honor exactly the selected voice. */
export function selectedTutorSynthesisConfiguration(rawVoice: unknown, env: Env = process.env) {
  if (!isTutorVoiceKey(rawVoice) || selectedVoiceVendor(env) !== 'elevenlabs') return null;
  const parameters = {
    vendor: 'elevenlabs' as const, voiceId: ELEVEN_VOICES[rawVoice], model: MODEL,
    languageCode: LANGUAGE_CODE, encoding: OUTPUT_ENCODING, streamingLatency: STREAMING_LATENCY,
    settings: Object.freeze({ ...VOICE_SETTINGS }),
  };
  return Object.freeze({ ...parameters, fingerprint: createHash('sha256').update(JSON.stringify(parameters)).digest('hex') });
}
