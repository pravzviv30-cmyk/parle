/**
 * The Practice tab's one question: what should the learner do now?
 *
 * The tab used to answer it inline — a Review block here, the path's rows there,
 * and the eye left to work out which came first. This says it once. A phrase the
 * scheduler wants back beats new ground, because a phrase slipping away matters
 * more than the next thing to learn (`buildPath` orders the path's own rows by
 * exactly the same rule). Below the due deck the step is the single row the path
 * already marked `next` — this does not re-decide which one, it reads the flag
 * `buildPath` sets on exactly one node. And when the deck is quiet and the path
 * is finished there is no step, so the tab can draw nothing rather than invent a
 * cheerful message for a learner who is simply done.
 *
 * `dueCards` from `@luvani/core`, like practice/mix.ts uses it, so the count
 * here and the sitting the Review screen opens are the same capped set. Pure and
 * clock-injected for the same reason as its sibling: PracticeTab can be a layout
 * and this can be a test.
 */

import { dueCards, type PathNode, type PathUnit, type ReviewCard } from '@luvani/core';

/** The headline over the step, and the word on a review step's button. */
export const NEXT_STEP = { label: 'Your next step', review: 'Review' } as const;

/** What to do now: review a due deck, open a marked row, or nothing at all. */
export type NextStep =
  | { kind: 'review'; due: number }
  | { kind: 'node'; node: PathNode };

/**
 * The review step's one line, moved verbatim from the tab's Review button.
 *
 * Counts a card, not a percentage or a streak: "1 card is ready", "3 cards are
 * ready". Singular at one, plural everywhere else, and nothing that scolds.
 */
export function reviewLine(due: number): string {
  return due === 1 ? '1 card is ready' : `${due} cards are ready`;
}

/**
 * The step, decided in exactly two branches then nothing.
 *
 * Due cards win. Failing that, the row the path marked next. Failing that, null,
 * which is the tab's cue to draw no headline at all.
 */
export function nextStep(units: readonly PathUnit[], deck: readonly ReviewCard[], now: number): NextStep | null {
  // Computed once and read twice: the count that decides the branch is the same
  // count the branch carries, so they can never disagree.
  const due = dueCards(deck, now).length;
  if (due > 0) return { kind: 'review', due };

  const node = units.flatMap((u) => u.nodes).find((n) => n.isNext);
  if (node !== undefined) return { kind: 'node', node };

  return null;
}
