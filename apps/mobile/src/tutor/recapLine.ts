/**
 * How the conversation went, in words (F584).
 *
 * The end card used to say it in digits: "6 turns · 70% on your own". Both
 * halves were wrong for this surface. A percentage is a score, and a score the
 * learner did not ask for is the one thing PEDAGOGY.md refuses outright; the
 * turn count is a measure of the room rather than of the person, and a short
 * conversation is not a worse one.
 *
 * What is left is the true sentence underneath the arithmetic: whether the
 * learner carried the conversation themselves or leaned on the tutor a little.
 * Both lines are warm, both are honest, and neither can be read as a mark.
 * A session with no measured learner turn acknowledges time instead of
 * claiming that a conversation was held.
 *
 * It lives here rather than in `RecapScreen.tsx` because it is a decision, and
 * apps/mobile has no renderer: a rule inside a `.tsx` is a rule nothing can ask
 * a question about. Same bargain `live/thinking.ts` struck.
 *
 * The threshold is stated once and named. It is deliberately generous: a
 * learner who was handed the line for a third of their turns still held the
 * conversation, and the alternative sentence is not a rebuke either, which is
 * why the boundary being roughly right is enough.
 */

/** What a recap knows about how the conversation ran. The wire's own shape. */
export interface RecapStats {
  readonly turns: number;
  readonly rescues: number;
  /** Nought to one: the share of turns the learner produced unaided. */
  readonly unassistedRate: number;
}

/** They carried it. */
export const HELD_ON_THEIR_OWN = 'You held the conversation on your own for most of it.';

/** They carried it and the tutor stepped in now and then. Not a fault. */
export const HELD_WITH_HELP = 'You held the conversation with a little help.';

/** Time was set aside, without evidence of a learner reply. */
export const MADE_TIME_FOR_FRENCH = 'You made time for your French.';

/**
 * Where "most of it" begins.
 *
 * A share rather than a count, so a four turn conversation and a forty turn one
 * are read the same way.
 */
export const MOSTLY_UNAIDED = 0.6;

/**
 * The one line under the recap headline.
 *
 * A conversation claim requires a positive, whole measured learner turn count.
 * Empty or invalid counts acknowledge the time rather than inventing evidence
 * of participation. Positive counts retain the same unaided/help distinction.
 */
export function recapLine(stats: RecapStats): string {
  if (!Number.isInteger(stats.turns) || stats.turns <= 0) return MADE_TIME_FOR_FRENCH;
  return stats.unassistedRate >= MOSTLY_UNAIDED ? HELD_ON_THEIR_OWN : HELD_WITH_HELP;
}
