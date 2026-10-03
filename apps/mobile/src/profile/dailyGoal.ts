/**
 * A flexible speaking target, as a rule rather than a screen.
 *
 * The goal used to be a whole sheet: a drawing, a headline, three cards and a
 * trip away from Profile and back. Three words on a segmented control say the
 * same thing without leaving the row, so the sheet went and this is what is
 * left of it. Everything the row draws is decided here, for the reason
 * `tutor/choosingView.ts` states: apps/mobile has no renderer, so a decision
 * inside a `.tsx` is a decision nothing can ask a question about.
 *
 * The three glosses say how a sitting feels, not how committed a learner is.
 * A target can help somebody choose a size without turning their return into a
 * promise they can break.
 *
 * No digits anywhere. The store holds 5, 10 and 15 because minutes are a
 * number; the learner reads Five, Ten and Fifteen, because a settings label
 * that counts is a settings label that shouts.
 */

import type { StoredProfile } from './store.ts';

/** The minute counts the store holds, which is the union `StoredProfile` names. */
export type GoalMinutes = 5 | 10 | 15;

/** What a segment is keyed by. A word, so nothing on this row is a numeral. */
export type GoalKey = 'five' | 'ten' | 'fifteen' | 'none';

export interface GoalOption {
  key: GoalKey;
  minutes: GoalMinutes | null;
  /** The word on the segment. Short: three of these share one track. */
  label: string;
  /** What a sitting of that size feels like. */
  gloss: string;
}

/** The three, gentlest first, which is the order the sheet offered them in. */
export const GOALS: readonly GoalOption[] = [
  { key: 'five', minutes: 5, label: 'Five', gloss: 'A quick speaking moment' },
  { key: 'ten', minutes: 10, label: 'Ten', gloss: 'Room for a full scene' },
  { key: 'fifteen', minutes: 15, label: 'Fifteen', gloss: 'A longer conversation' },
  { key: 'none', minutes: null, label: 'No target', gloss: 'Practise when it suits you' },
];

/**
 * The row's own name.
 *
 * Exported so the screen imports it rather than spelling it, and so a test can
 * pin the two together: `onboarding/answers.test.ts` looks for these exact
 * words in ProfileTab as the proof that the question is asked somewhere at all.
 */
export const DAILY_GOAL_ROW = 'Flexible practice routine';

/**
 * Said when nobody has chosen yet.
 *
 * It asks rather than reports, because there is nothing to report. No count, no
 * scolding, and no suggestion that not having chosen is a lapse: this is the
 * first time most learners will have seen the question.
 */
export const DAILY_GOAL_UNSET = 'No fixed daily target. Local practice is free; connected tutor time uses live minutes.';

/**
 * What this learner has asked for, or null.
 *
 * Sceptical about the one field, incurious about the rest, exactly as
 * `strictnessOf` is: the blob has been round a sync and another device's disk,
 * and a mangled byte must read as "nothing chosen" rather than as five minutes.
 */
export function dailyGoalOf(profile: StoredProfile | null | undefined): GoalMinutes | null {
  const stored: unknown = profile?.dailyGoalMin;
  return GOALS.some((g) => g.minutes === stored) ? (stored as GoalMinutes) : null;
}

/** The chosen segment, or null when the control stands with nothing chosen. */
export function goalKeyOf(profile: StoredProfile | null | undefined): GoalKey | null {
  const minutes = dailyGoalOf(profile);
  return minutes === null ? 'none' : (GOALS.find((g) => g.minutes === minutes)?.key ?? 'none');
}

/** The option behind a segment key. */
export function goalFor(key: GoalKey): GoalOption {
  return GOALS.find((g) => g.key === key) ?? GOALS[0]!;
}

/**
 * The one line under the control: what is set, and what that means.
 *
 * Two sentences rather than one, because they are two different facts and a
 * learner scanning the card reads the first. Written in words so the row keeps
 * the no-digits rule the rest of the settings card keeps.
 */
export function goalLine(profile: StoredProfile | null | undefined): string {
  const key = goalKeyOf(profile);
  if (key === null || key === 'none') return DAILY_GOAL_UNSET;
  const option = goalFor(key);
  return `${option.label} minutes as a flexible routine. Local practice is free; connected tutor time uses live minutes.`;
}
