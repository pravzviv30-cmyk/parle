/**
 * The bundled clip for each voice, so a learner can hear one before choosing.
 *
 * Eight short recordings, one per catalogue voice, made by `voice-samples` in
 * services/tutor-agent through the same `buildTTS` seam the live tutor speaks
 * through. Through the seam on purpose: a clip synthesised some other way would
 * be an approximation, and a learner who picks a voice from an approximation
 * has been shown something the product does not then deliver.
 *
 * ## Why this table is written out longhand
 *
 * Metro resolves `require` at build time by reading the literal string. A loop
 * over the catalogue building `require(\`../../assets/voices/${key}.m4a\`)`
 * bundles nothing at all and fails on the device, so the eight paths have to be
 * spelled. `Record<TutorVoiceKey, AudioSource>` is what stops that being a
 * maintenance trap: a ninth voice added to the catalogue is a compile error
 * here until its clip is bundled, rather than a silent gap that only shows up
 * as a listen button doing nothing.
 *
 * ## Why this file has no test of its own
 *
 * It cannot be imported by one. `require` of an `.m4a` is a Metro thing and
 * node has no idea what to do with it, and apps/mobile deliberately has no
 * renderer (docs/TESTING.md). So the guarantee that matters — one entry per
 * catalogue voice, and every path pointing at a file that actually exists — is
 * held by a source walk in `tutorVoice.test.ts`, which reads this file as text
 * and checks the assets directory alongside it.
 */

import type { TutorVoiceKey } from '@luvani/core';

/**
 * What `require` hands back for a bundled asset. A number on native (the asset
 * registry id) and an object on web, which is why this is not typed as either:
 * expo-audio's `AudioSource` accepts whatever the bundler produced, and naming
 * a platform's representation here would be a claim about a build.
 */
export type VoiceSample = ReturnType<typeof require>;

export const VOICE_SAMPLES: Record<TutorVoiceKey, VoiceSample> = {
  alexandre: require('../../assets/voices/alexandre.m4a'),
  emilie: require('../../assets/voices/emilie.m4a'),
  guillaume: require('../../assets/voices/guillaume.m4a'),
  marie: require('../../assets/voices/marie.m4a'),
  anatole: require('../../assets/voices/anatole.m4a'),
  sarah: require('../../assets/voices/sarah.m4a'),
};

/** The clip for one voice. Total, because the parameter is the closed union. */
export function voiceSample(key: TutorVoiceKey): VoiceSample {
  return VOICE_SAMPLES[key];
}
