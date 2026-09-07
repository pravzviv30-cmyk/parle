/**
 * The words on a situation's chip, and the words above the list.
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
 */

import type { MissionState } from '@luvani/core';

import type { StampState } from '../progress/passport.ts';

export const SITUATIONS = {
  label: 'Situational autonomy',
  title: 'Real-world independence',
  blurb: 'Judged from unscripted conversations with your tutor, never from a quiz.',
} as const;

/**
 * The pill's words, per state, and they are short on purpose.
 *
 * The first draft used `missionStatus`'s sentences and it broke the row: at
 * 375pt "Ready when you are" beside a title left the title a column narrower
 * than its own longest word, so "À la réception" hyphenated itself in the
 * middle. A pill sits beside a name and has to be read at a glance; the sentence
 * version of the same state still exists on `SituationRow.status` for anywhere
 * with room for it, and the fuller phrase rides in the row's accessible name.
 */
export const CHIP = {
  own: 'On your own',
  helped: 'With help',
  again: 'Come back',
  started: 'Started',
  ready: 'Ready',
} as const;

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

/**
 * The fact beside the heading, or null.
 *
 * The mockup said "8 Scenarios Ready", and readiness is the one thing this list
 * cannot count: everything is ready, always, so the number would be the size of
 * the catalogue. This counts the situations handled with nothing handed over,
 * which is the passport's own claim and the only one worth putting a tick next
 * to. A count and never a fraction, and absent until the first is earned.
 */
export function ownLine(earned: number): string | null {
  if (earned <= 0) return null;
  return earned === 1 ? '1 handled on your own' : `${earned} handled on your own`;
}
