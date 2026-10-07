/**
 * Which page the review sitting is on, told apart by what happened rather than
 * by what is left (F761; README Part 5.E, "review: finished split from
 * 'Nothing waiting.'").
 *
 * Before this, a deck with nothing due and a sitting the learner had just
 * worked through both reached "no card on screen" and drew the same calm
 * "Nothing waiting." card, so finishing a review looked exactly like having
 * nothing to do. Now:
 *
 * - `loading`: the deck is still being read.
 * - `card`: a card is on screen.
 * - `nothing-waiting`: nothing was dealt. Still the calm card, and nothing
 *   plays: no sound, no end card, no settle.
 * - `finished`: cards were dealt and every one was graded. "Review complete.",
 *   and its end card once the settle has read the sitting back.
 *
 * Pure, so `sittingEnd.test.ts` holds it.
 */

export type ReviewPage = 'loading' | 'card' | 'nothing-waiting' | 'finished';

export const REVIEW_END = {
  /** The heading of a finished sitting. */
  finished: 'Review complete.',
  /** Under it, when the settle has nothing to show: the finish stands without numbers. */
  finishedBody: 'Your cards come back when they are due.',
} as const;

/** `dealt` is the sitting's queue length (cards rejoin it after "Again"), or null while it is read. */
export function reviewPage(dealt: number | null, index: number): ReviewPage {
  if (dealt === null) return 'loading';
  if (dealt === 0) return 'nothing-waiting';
  return index >= dealt ? 'finished' : 'card';
}
