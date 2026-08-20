/**
 * Today, and only today.
 *
 * PRODUCT.md's whole shape is a nervous adult speaking out loud twice a day,
 * and nothing on any screen has ever said so. This says it, and it is built so
 * that it cannot become the thing PRODUCT.md rules out.
 *
 * ## Why this is not a streak
 *
 * A streak was asked for during the five-tab redesign and dropped, twice over:
 * PRODUCT.md calls it "a guilt mechanic implicated in intermediate-plateau
 * churn", and `packages/core/src/levels/levels.ts` carries the line
 * "Deliberately absent: a streak." So:
 *
 *   - there is no chain. Yesterday is not read, not counted, not shown.
 *   - there is no loss state. A quiet day costs nothing and is never mentioned.
 *   - **it does not render at zero.** This is the important one. A filled mark
 *     beside an empty one is a quota, and a quota you have not met at eleven at
 *     night is guilt wearing a different hat. If the row cannot exist empty,
 *     there is no state in which it can read as a debt. `buildProgressReport`
 *     already works this way, saying nothing at all rather than showing a rail
 *     of noughts, and this is the same restraint.
 *
 * ## Why the word is "practised" and not "spoke"
 *
 * Two of the four activity kinds are silent. A learner who typed their way
 * through a drill produced French and earned the mark, and telling them they
 * spoke would be false. It would also breach the commitment that every spoken
 * path has a quiet twin, by implying the quiet one does not count.
 *
 * The counting itself is honest for free: `recordActivity` returns early on
 * `xp <= 0`, so an entry can only exist where French was actually produced.
 * Opening the app cannot fill a mark.
 */

import { localDayKey } from '@parle/core';
import type { ActivityEntry } from './activity.ts';

/** What Parle is built around. Two sittings is the shape, not a target to hit. */
export const SITTINGS_IN_A_DAY = 2;

export interface Today {
  /** How many sittings today. Never a fraction, never a percentage. */
  done: number;
  /** How many marks to draw. Always `SITTINGS_IN_A_DAY`. */
  marks: number;
  /** The line above. Empty string when nothing should render. */
  headline: string;
  /** The line under it. */
  sub: string;
}

/**
 * Absent. Not "zero of two": absent. Home renders nothing for this.
 */
const NOTHING: Today = { done: 0, marks: SITTINGS_IN_A_DAY, headline: '', sub: '' };

/** True when Home should draw the row at all. */
export function hasToday(today: Today): boolean {
  return today.done > 0;
}

/**
 * Everything the learner produced French for today.
 *
 * `now` is passed in rather than read, because a function that reads the clock
 * cannot be tested across a midnight.
 */
export function todayFrom(entries: readonly ActivityEntry[], now: number): Today {
  const key = localDayKey(now);
  let done = 0;
  for (const entry of entries) {
    if (localDayKey(entry.at) === key) done += 1;
  }

  if (done <= 0) return NOTHING;

  if (done === 1) {
    return {
      done,
      marks: SITTINGS_IN_A_DAY,
      headline: 'You practised today.',
      sub: 'Room for one more if you want it.',
    };
  }

  if (done === SITTINGS_IN_A_DAY) {
    return {
      done,
      marks: SITTINGS_IN_A_DAY,
      headline: 'Twice today.',
      sub: 'That is the shape that sticks.',
    };
  }

  return {
    done,
    marks: SITTINGS_IN_A_DAY,
    headline: 'More than twice today.',
    sub: 'Nicely done. Come back tomorrow and it keeps.',
  };
}
