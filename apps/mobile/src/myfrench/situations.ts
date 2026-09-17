/**
 * The words on a situation's chip, and the two headings above the rows.
 *
 * The founder's mockup put a short status pill on the right of every row, and
 * short is the whole difficulty. `missionStatus` writes a sentence, which is
 * right on a card with room for one and wrong in a pill beside a title, so this
 * is the same state said in two or three words.
 *
 * ## It reads the passport, and never the ladder
 *
 * The chip's state comes off `Stamp.state`, which is `stampsFrom`'s fold of
 * best-ever independence, and off `MissionState` for the three cases a stamp
 * does not distinguish. Nothing here looks at `independence` or at `lastRung`.
 * That is the same rule `progress/passport.ts` states about itself: project,
 * never replace, or the app grows a second opinion about how well somebody did.
 *
 * It is not a second copy of `stampLabel` either. That is the sentence a screen
 * reader hears for the mark, and it names the situation because it is read out
 * of context. This is two words in a pill next to the title, read by an eye
 * that has already seen which situation it belongs to.
 *
 * ## What the mockup's chips said, and why these say something else
 *
 * They said "100%", "85% Spoken", "70% Active" and "Locked - Next". None of the
 * four can be told the truth here. There is no denominator for a percentage and
 * `passport.ts` deliberately withholds the fields that would make one, and
 * nothing in this product is ever locked: `suggestedMission` says outright that
 * every situation is open in any order. So the pill keeps its shape and says
 * what is actually known, which is how much help was still in play the best
 * time the learner walked in.
 *
 * ## The count above the list went with revamp A
 *
 * `ownLine` used to write "4 handled on your own" beside the first heading. The
 * tab draws no digit at all now: the rows themselves are the record, and a
 * tally of them beside the heading is the one thing on a page of places that
 * could be read as a score. The heading says the claim in words instead.
 */

import type { MissionState } from '@luvani/core';

import type { StampState } from '../progress/passport.ts';

/**
 * The pill's words, per state, and they are short on purpose.
 *
 * The first draft used `missionStatus`'s sentences and it broke the row: at
 * 375pt "Ready when you are" beside a title left the title a column narrower
 * than its own longest word, so "À la réception" hyphenated itself in the
 * middle. A pill sits beside a name and has to be read at a glance; the fuller
 * phrase rides in the row's accessible name.
 */
export const CHIP = {
  own: 'On your own',
  helped: 'With help',
  again: 'Come back',
  started: 'Started',
  ready: 'Ready',
} as const;

/**
 * The two groups the rows draw (F559, kept through F575): what the learner can
 * now do, which is every situation handled with nothing handed over, and the
 * next places, which are the rest, suggested in any order and never locked.
 * Decided here rather than on the card, so the card draws a split it did not
 * make.
 *
 * The three dots on the first are the founder's and they are load-bearing: the
 * heading runs straight into the row under it, so "You can now" and "Au café du
 * coin" read as one sentence about the learner rather than as a claim followed
 * by a list.
 */
export const YOU_CAN_NOW = {
  label: 'You can now...',
} as const;

export const NEXT_PLACES = {
  label: 'Next places',
} as const;

export interface SituationSplit<T> {
  /** Stamped rows, the learner's own, in the order they arrived. */
  own: readonly T[];
  /** Everything else, the one core suggests first. */
  next: readonly T[];
}

/**
 * The rows in two groups, and the suggested place at the head of the second.
 *
 * `suggestedId` is `suggestedMission`'s pick, which is the same call Home makes
 * and the same one the retired next-situation card drew. Folding it in here is
 * what let that card go: the suggestion is not a second surface any more, it is
 * which row a learner meets first under "Next places". Passing `null` leaves
 * the catalogue order alone, so nothing is invented when core suggests nothing.
 *
 * A learner with nothing stamped meets one group under "Next places" and never
 * an empty "You can now": a heading over no rows says the learner has done none
 * of this, which is the one thing a page of places must not say on a first
 * morning.
 */
export function splitByStamp<T extends { id: string; earned: boolean }>(
  rows: readonly T[],
  suggestedId: string | null = null,
): SituationSplit<T> {
  const own = rows.filter((row) => row.earned);
  const rest = rows.filter((row) => !row.earned);
  const suggested = rest.filter((row) => row.id === suggestedId);
  return { own, next: [...suggested, ...rest.filter((row) => row.id !== suggestedId)] };
}

export interface SituationChip {
  text: string;
  /** Earned: filled in the green the learner speaks in. Everything else is quiet. */
  earned: boolean;
}

/**
 * The chip for one situation.
 *
 * `not-yet` is three different things and the mission's own state is what tells
 * them apart: never walked into, walked into and unfinished, or finished long
 * enough ago that the phrases are going quiet. None of the three is a failure
 * and none of them is worded as one.
 */
export function chipFor(stamp: StampState, state: MissionState): SituationChip {
  if (stamp === 'on-your-own') return { text: CHIP.own, earned: true };
  if (stamp === 'with-help') return { text: CHIP.helped, earned: false };
  if (state === 'needs-review') return { text: CHIP.again, earned: false };
  if (state === 'in-progress') return { text: CHIP.started, earned: false };
  return { text: CHIP.ready, earned: false };
}
