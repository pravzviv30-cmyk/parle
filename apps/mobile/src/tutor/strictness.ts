/**
 * How much the tutor corrects, as a thing the learner can set.
 *
 * The dial itself is old. `packages/brain` has had three coaching policies
 * since the engine was written, the eval measures all three, and every learner
 * profile carries the chosen one at `preferences.strictness`. What did not
 * exist was a way to turn it: the field was written by the session that had
 * just finished, so it was a log of the last conversation rather than a
 * preference, and no screen in the app had ever offered it. F184 stopped the
 * write-back, F183 makes the agent read the stored value, and this is the third
 * piece: somewhere to say what you want.
 *
 * The three names are the product's own, not new ones invented for a screen.
 * `flow`, `balanced` and `strict` are what `Strictness` has always been called
 * in the brain, in the eval and in the docs, and a fourth vocabulary on the one
 * surface a learner reads is how a setting comes to mean two things.
 *
 * Everything here is a rule rather than a drawing, for the reason
 * `tutor/choosingView.ts` states: apps/mobile has no renderer, so a decision
 * inside a `.tsx` is a decision nothing can ask a question about.
 */

import type { LearnerProfile } from '@luvani/brain/profile';
import type { StoredProfile } from '../profile/store.ts';

/**
 * Taken from the learner model rather than restated.
 *
 * A hand-written copy of the union here would be a second opinion that goes
 * stale the first time the brain adds a level, and the compiler would not say
 * a word about it.
 */
export type Strictness = LearnerProfile['preferences']['strictness'];

/**
 * What a profile carrying nothing usable is taken to want.
 *
 * The same value `createProfile()` writes, deliberately: a learner who has
 * never touched this dial and a learner whose stored value cannot be read must
 * land in the same place, or the tutor changes behaviour over a mangled byte.
 */
export const DEFAULT_STRICTNESS: Strictness = 'balanced';

/** The order the three are offered in: least correcting first. */
export const STRICTNESS_ORDER: readonly Strictness[] = ['flow', 'balanced', 'strict'];

export interface StrictnessOption {
  value: Strictness;
  /** The product's own name for this level. */
  label: string;
  /** What it actually does, in one plain sentence a learner can check. */
  gloss: string;
}

/**
 * The copy, one entry per level.
 *
 * `Record<Strictness, …>` on purpose: a fourth level does not compile until
 * somebody has written down what it does. Every gloss describes the SAME thing
 * the grading table does — which findings interrupt the scene and which wait
 * for the end card — because a setting whose description does not match its
 * behaviour is worse than no setting.
 *
 * No scolding and no numbers. "Slip" rather than "mistake", and nothing here
 * tells a learner they get things wrong.
 */
const COPY: Record<Strictness, Omit<StrictnessOption, 'value'>> = {
  flow: {
    label: 'Flow',
    gloss: 'Only what stops the conversation. Everything else waits for your recap.',
  },
  balanced: {
    label: 'Balanced',
    gloss: 'What matters right now, as it happens. Small slips wait for your recap.',
  },
  strict: {
    label: 'Strict',
    gloss: 'Everything your tutor notices, briefly, while you talk.',
  },
};

/** The three options, in the order the sheet lists them. */
export const STRICTNESS_OPTIONS: readonly StrictnessOption[] = STRICTNESS_ORDER.map((value) => ({
  value,
  ...COPY[value],
}));

/** The row label, which says what the setting does rather than naming a field. */
export const STRICTNESS_ROW = 'How your tutor corrects you';

/** The sheet's own two lines. Honest about when a change is felt. */
export const STRICTNESS_TITLE = 'How your tutor corrects you';
export const STRICTNESS_SUB = 'Change this whenever you like. Your next conversation picks it up.';

/**
 * What this learner has asked for.
 *
 * Deliberately incurious about the rest of the profile and deliberately
 * sceptical about this one field. The blob has been round a sync, a version
 * chain and another device's disk, and `repairProfile` carries unknown
 * preference keys through untouched rather than validating them, which is the
 * right call there and the reason the reading has to happen here.
 */
export function strictnessOf(profile: StoredProfile | null | undefined): Strictness {
  const stored: unknown = profile?.brain?.preferences?.strictness;
  return STRICTNESS_ORDER.includes(stored as Strictness) ? (stored as Strictness) : DEFAULT_STRICTNESS;
}

/** The label shown on the settings row for what is currently set. */
export function strictnessLabel(profile: StoredProfile | null | undefined): string {
  return COPY[strictnessOf(profile)].label;
}

/**
 * Set the dial, and change nothing else.
 *
 * A named door, the way `withDailyGoal` and `withAgeStop` are named doors: this
 * writes one field inside the learner model the tutor owns, and everything else
 * in there is evidence about somebody that a screen has no business rewriting.
 */
export function withStrictness(profile: StoredProfile, strictness: Strictness): StoredProfile {
  return {
    ...profile,
    brain: {
      ...profile.brain,
      preferences: { ...profile.brain.preferences, strictness },
    },
  };
}
