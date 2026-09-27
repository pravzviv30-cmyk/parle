/**
 * How fast the tutor talks, as a thing the learner can ask for.
 *
 * Built exactly like `strictness.ts`, because it is the same kind of setting: a
 * field the brain already carries, read by the agent when a scene opens, with
 * no way for anybody to set it. `LearnerProfile.preferences.pace` is the
 * engine's own word for it, so this file borrows the type rather than declaring
 * a second one that goes stale the first time the brain adds a level.
 *
 * ## What the copy is allowed to promise
 *
 * The prompt, not the waveform. Asking for a slower tutor changes what the
 * model is told to produce: shorter sentences, simpler words, one idea at a
 * time. The audio still plays at the speed the cache holds, because the clip is
 * cached per line and a per-learner playback rate would be a second cache. So
 * the sub-line talks about sentences and words, and says nothing about speed of
 * speech, which would be a promise the pipeline does not keep.
 *
 * And it takes effect from the first line rather than from the next correction,
 * because the pace rides in the scene's own config: `createConversation` takes
 * it, and the agent reads it at every door into a scene.
 */

import type { LearnerProfile } from '@luvani/brain/profile';
import type { StoredProfile } from '../profile/store.ts';

/**
 * Taken from the learner model rather than restated, the way `Strictness` is.
 *
 * Optional in the profile because it arrived after the shape shipped, so the
 * type here is the non-optional union and "absent" is answered by `paceOf`.
 */
export type Pace = NonNullable<LearnerProfile['preferences']['pace']>;

/** What a profile carrying nothing usable is taken to want, and what the engine defaults to. */
export const DEFAULT_PACE: Pace = 'normal';

/** Both values, so a reader can be checked against the set rather than against a literal. */
export const PACE_ORDER: readonly Pace[] = ['normal', 'slow'];

/**
 * The row's own name. It says what the tutor does, not what the field is called.
 *
 * "Tutor speaks slower" until the notebook redesign (2026-09-27, report change
 * 25): the voice is never slowed, the sentences are simplified, so the row and
 * the scene's "Simpler" control now say the same true thing.
 */
export const PACE_ROW = 'Tutor speaks more simply';

/**
 * What saying yes does, in one plain sentence.
 *
 * Three concrete promises and no adverbs: shorter sentences, simpler words, one
 * idea at a time. A learner can check every one of them in the first minute,
 * which is the bar a setting has to clear to be worth offering.
 */
export const PACE_SUB = 'Shorter sentences and simpler words, one idea at a time, from the first line.';

/**
 * What this learner has asked for.
 *
 * Sceptical about the one field and incurious about the rest, exactly as
 * `strictnessOf` is. Only the literal 'slow' is slow: an absent field, a
 * mangled byte, a string from another device's disk are all somebody who never
 * asked, and the tutor must not change how it talks over any of them.
 */
export function paceOf(profile: StoredProfile | null | undefined): Pace {
  return profile?.brain?.preferences?.pace === 'slow' ? 'slow' : DEFAULT_PACE;
}

/**
 * Set the pace, and change nothing else.
 *
 * A named door beside `withStrictness`: this writes one field inside the
 * learner model the tutor owns, and everything else in there is evidence about
 * somebody that a settings screen has no business rewriting. The preferences
 * block is spread rather than replaced, or asking for a slower tutor would take
 * the strictness dial and the recent scenarios with it.
 */
export function withPace(profile: StoredProfile, pace: Pace): StoredProfile {
  return {
    ...profile,
    brain: {
      ...profile.brain,
      preferences: { ...profile.brain.preferences, pace },
    },
  };
}
