/**
 * The card that answers "I do not know what to talk about."
 *
 * The founder's mockup calls this Generate New Scenario, and the obvious way
 * to build it would be a model call. That was refused deliberately: a button a
 * nervous learner taps three times in a row would be three requests and three
 * waits, for something an authored pool already does better and instantly. So
 * the suggestions come from `DAILY_SCENARIOS`, the same hand-written pool Home
 * draws its daily situation from, and the button says "Suggest another"
 * because that is what it does. Nothing here reaches the network.
 *
 * The order is the learner's own. Walking the authored order was worse than it
 * looked: the pool is grouped by theme, so tapping through met eleven cafés and
 * then twelve hotels. `shuffledPick` deals a permutation instead, seeded per
 * learner, so nothing repeats until every situation has been seen and two
 * devices signed into one account deal the same hand.
 *
 * Pure. The seed and the position live in `suggestionStore.ts`.
 */

import { nextPosition, shuffledPick, type DailyScenario } from '@luvani/core';

/** Everything the card says, spelled once. */
export const SUGGESTION = {
  label: 'Scenario inspiration',
  title: "Can't think of a scenario?",
  blurb: 'Luvani can suggest a real conversation to have next, somewhere you are likely to find yourself.',
  suggested: 'Suggested for you',
  another: 'Suggest another',
  reshuffle: 'Shuffle them again',
  // Not "Practice drill". The door opens a sitting over the learner's whole
  // deck, which has nothing to do with the scenario above it, and a button
  // named after the card it sits on was promising something it never did.
  drill: 'Practise your phrases',
  tutor: 'With tutor',
} as const;

/** Where the learner has got to in their own deal of the pool. */
export interface Walk {
  seed: number;
  position: number;
}

/**
 * Which situation the card is showing.
 *
 * Every guard about a corrupt seed or position lives in `shuffledPick`, so this
 * is the seam and not a second copy of the rules.
 */
export function suggestionFor(pool: readonly DailyScenario[], walk: Walk): DailyScenario | null {
  return shuffledPick(pool, walk.seed, walk.position);
}

/**
 * One step along the same deal.
 *
 * The seed is untouched, which is the whole point: the order a learner is
 * walking survives until they ask for a different one.
 */
export function walkOn(walk: Walk, poolSize: number): Walk {
  return { seed: walk.seed, position: nextPosition(walk.position, poolSize) };
}

/**
 * A fresh deal, from the top.
 *
 * The new seed is passed in rather than drawn here, so this file still reads no
 * clock and no global and a test can hand it the seed it wants. The caller has
 * a clock; this does not need one.
 */
export function reshuffle(seed: number): Walk {
  return { seed: Math.trunc(Number.isFinite(seed) ? seed : 0), position: 0 };
}
