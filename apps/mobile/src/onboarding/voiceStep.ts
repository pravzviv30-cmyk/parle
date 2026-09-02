/**
 * The first-run voice step, as rules rather than as a screen.
 *
 * The founder's ask, in their words: "ensuring that also in the onboarding
 * screens the user can pick and be showcased the Tutor Voices and how they
 * work." The Profile row alone was not enough, because a learner who never
 * opens Profile never learns the eight exist.
 *
 * Everything about the step that can be got wrong lives here rather than in
 * `OnboardingFlow.tsx`, for the reason `answers.ts` and `tutor/gate.ts` both
 * give: apps/mobile has no renderer, so a rule inside a `.tsx` is a rule
 * nothing can ask a question about. What is left in the screen is layout, the
 * audio player, and the two calls this module names.
 *
 * ## One door, not two
 *
 * The choice is written with `withTutorVoice` — the same named door in
 * `profile/store.ts` the Profile sheet writes with. This matters more than it
 * looks. The alternative was for onboarding to spread the profile by hand or
 * for `createStoredProfile` to grow a second opinion about the field, and
 * either one is a second write path for a value the token server and the agent
 * both read. `withChosenVoice` is a thin wrapper over that door and nothing
 * else: it exists because onboarding has one extra case the sheet does not, a
 * learner who chose nobody.
 *
 * ## Skipping is an answer, not a deferral
 *
 * A skip writes NOTHING. `tutorVoice` stays null, `tutorVoiceOf` reads null as
 * `DEFAULT_TUTOR_VOICE`, and the agent resolves the same key at the other end
 * of the wire, so the learner talks to Luc and both ends agree about it. The
 * temptation is to write the default key on a skip "so the field is set", and
 * that is exactly wrong: it records a choice nobody made, and the Profile row
 * can then no longer tell whether they picked Luc or never looked.
 *
 * ## What is deliberately NOT here
 *
 * The eight names and the eight descriptions. They come off the catalogue in
 * `@luvani/core` through `tutor/tutorVoice.ts`, re-exported here rather than
 * rebuilt, so onboarding and the Profile sheet cannot end up offering different
 * lists or describing the same voice in two ways.
 *
 * The audio. `tutor/voiceSamples.ts` is a table of `require()` calls that only
 * a bundler can resolve, so importing it here would take this module — and
 * every test that reads it — down with it under node. The screen owns the
 * player; this module owns which key it should be playing, and `nextSample`
 * from `tutor/tutorVoice.ts` already answers that for the Profile sheet.
 */

import { DEFAULT_TUTOR_VOICE, type TutorVoiceKey } from '@luvani/core';
import { withTutorVoice, type StoredProfile } from '../profile/store.ts';
import { DEFAULT_TUTOR_PERSONA } from '../tutor/tutorName.ts';
import { TUTOR_VOICE_OPTIONS, tutorVoiceOf } from '../tutor/tutorVoice.ts';
import { VOICE_AI, VOICE_BODY, VOICE_SKIP, VOICE_SKIP_HINT, VOICE_TITLE } from './disclosure.ts';

export type { TutorVoiceKey };

/**
 * What the step showcases, in the catalogue's order, taken from the Profile
 * sheet's list rather than built again.
 *
 * A re-export and not a copy. If the two lists were built separately, a ninth
 * voice would appear in Profile and be missing from the first run, and nobody
 * would notice until a learner asked why the voice they were offered on day one
 * had vanished.
 */
export const VOICE_STEP_OPTIONS = TUTOR_VOICE_OPTIONS;

/**
 * Every sentence this step writes for itself, flattened.
 *
 * The step's own words only. The eight names and `sound` lines are the
 * catalogue's, are rendered untouched, and are already scanned by
 * `tutor/tutorVoice.test.ts` — a second copy of them here would be a second
 * place the "nothing comparative" rule has to be enforced.
 *
 * The skip hint is the step's one sentence that names a person, so it is read
 * here as the DEFAULT persona reads it, the way `FIRST_RUN_COPY` is. The screen
 * hands it whoever the learner already has; this list is what the copy scan
 * needs, which is one flat set of sentences rather than one per voice.
 */
export const VOICE_STEP_COPY: readonly string[] = [
  VOICE_TITLE,
  VOICE_BODY,
  VOICE_AI,
  VOICE_SKIP,
  VOICE_SKIP_HINT(DEFAULT_TUTOR_PERSONA),
];

/**
 * Apply what the learner said on the voice step, through the door that owns
 * the field.
 *
 * `chosen` is null when they skipped, and null means the profile is handed back
 * untouched — not `withTutorVoice(profile, DEFAULT_TUTOR_VOICE)`. See the
 * module comment: writing the default on a skip records a choice nobody made.
 *
 * It takes a whole profile rather than reaching for one because onboarding runs
 * OUTSIDE `ProfileProvider` — `ProfileGate` renders the flow precisely when
 * there is no usable profile yet, so `useProfile()` throws there and the screen
 * has no `update` to call. The profile is built after the flow hands its
 * answers back, and this is applied to it at that moment, which is why the
 * chosen key rides out in `OnboardingAnswers` instead of being written from
 * inside a page.
 */
export function withChosenVoice(profile: StoredProfile, chosen: TutorVoiceKey | null): StoredProfile {
  return chosen === null ? profile : withTutorVoice(profile, chosen);
}

/**
 * Who a learner ends up talking to after the step, whatever they did on it.
 *
 * The point of the function is that there is no fourth outcome. They picked
 * somebody, or they skipped and got the default, and both of those are a real
 * person with a name. Nothing can leave this step without a voice.
 */
export function voiceAfterStep(profile: StoredProfile | null, chosen: TutorVoiceKey | null): TutorVoiceKey {
  return chosen ?? tutorVoiceOf(profile);
}

/** The voice a learner gets for skipping, named so the copy and the code agree. */
export const VOICE_STEP_DEFAULT: TutorVoiceKey = DEFAULT_TUTOR_VOICE;
