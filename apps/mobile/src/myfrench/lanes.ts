/**
 * Two readings of one body of evidence.
 *
 * The founder's mockup put a segmented switch at the top of this page and the
 * two words on it were right, so they are kept verbatim. What they separate is
 * not two features bolted together: it is the same evidence keyed two ways.
 * **Spoken Map** is keyed by place and answers "where does my French work".
 * **Memory Deck** is keyed by phrase and answers "which lines are mine". A
 * returning learner wants one of those two things and should not scroll past
 * the other to reach it.
 *
 * The one line card and the chooser sit outside both lanes, above and below, so
 * the page keeps one spine whichever lane is showing and the primary action
 * never disappears under a toggle.
 *
 * The chosen lane is component state and dies with the mount. Nothing may claim
 * this page remembers where the learner left off, because it does not, and a
 * store for it would be a derived value with a device's opinion attached.
 */

import { hasDeckLane, hasMapLane, type MyFrench } from './model.ts';

export type Lane = 'map' | 'deck';

/**
 * The tab's purpose line.
 *
 * A SCREAMING_CASE constant because `surfaceContract.test.ts` accepts a
 * literal, a template or exactly this shape and fails the tab otherwise.
 */
export const MY_FRENCH_PURPOSE = 'The French that has become yours, and the one line to say next.';

/** The founder's own two words, in the founder's own order. */
export const LANES: readonly { key: Lane; label: string }[] = [
  { key: 'map', label: 'Spoken Map' },
  { key: 'deck', label: 'Memory Deck' },
];

/** What the group is a choice of, so a screen reader says more than "tab one of two". */
export const LANES_LABEL = 'What to look at';

/**
 * Which lane the learner lands on.
 *
 * The Map, unless it has nothing in it and the Deck has something. A learner
 * whose whole history is conversation should not open on a blank page of
 * places.
 */
export function openingLane(model: MyFrench): Lane {
  if (!hasMapLane(model) && hasDeckLane(model)) return 'deck';
  return 'map';
}

/**
 * Whether the switch is drawn at all.
 *
 * A control with an empty half is an invitation to find nothing, which is the
 * quota `progress/today.ts` refuses in a different shape. One lane with
 * something in it renders bare, and the learner is not told about the other.
 */
export function showLanes(model: MyFrench): boolean {
  return hasMapLane(model) && hasDeckLane(model);
}
