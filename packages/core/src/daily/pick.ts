/**
 * Which entry today gets.
 *
 * The whole daily surface is one function of two inputs: the pool, and the day
 * the learner is standing in. Nothing is stored, which is the point. A stored
 * pick would be a derived value with its own lifetime, and it would then need
 * an answer for the phone that was off at midnight, the tablet in another time
 * zone, and the sync fold that finds two of them.
 *
 * The consequences of a pure pick are worth stating plainly, because two of
 * them are properties and one is a cost:
 *
 * - A fresh install and a two-year-old install show the same word on the same
 *   day, since neither the install date nor any history is an input.
 * - The card cannot change under a learner mid-day, and cannot fail to change
 *   overnight. `localDayKey` is the same day rule the rest of core uses, so
 *   "today" means one thing across the app.
 * - Growing a pool re-phases the sequence from that day on. Accepted. The
 *   alternative is the stored value above, and a re-phased sequence costs a
 *   learner nothing they can see.
 *
 * `now` is always a parameter. There is no `Date.now()` in this file, because
 * a day rule that cannot be tested across a boundary is a rule nobody trusts.
 */

import { localDayKey } from '../levels/levels.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A day key is exactly four digits, a month and a day. Anything else is not one of ours. */
const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Whole days since the first of January nineteen seventy, for a local day key.
 *
 * `Date.UTC` is deliberate and is not a time zone bug. The key has already had
 * the learner's time zone applied to it by `localDayKey`; reading it back as
 * UTC treats it as the plain calendar date it is, so the arithmetic is exact
 * and every key is exactly one day apart from the next. Reading it as local
 * time instead would make the gap between two keys shrink or grow by an hour
 * across a daylight saving change, and a pick could then repeat or skip.
 */
export function dayIndex(dayKey: string): number {
  const parts = DAY_KEY.exec(dayKey);
  if (parts === null) {
    throw new Error(`dayIndex needs a YYYY-MM-DD day key, and got "${dayKey}"`);
  }
  const utc = Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  return Math.floor(utc / DAY_MS);
}

/**
 * The pool entry for the local day containing `now`.
 *
 * The modulo is written the long way because a day key before nineteen seventy
 * has a negative index, and JavaScript's `%` keeps the sign. A negative index
 * would read off the front of the array and hand back `undefined`, which is a
 * blank card rather than an error anyone would notice.
 *
 * An empty pool throws rather than returning nothing. There is no honest card
 * to draw for a day with no content in it, and a caller that silently drew
 * nothing would hide a content bug behind an empty space on Home.
 */
export function dailyPick<T>(pool: readonly T[], now: number): T {
  if (pool.length === 0) {
    throw new Error('dailyPick was given an empty pool, so there is nothing to show today');
  }
  const index = dayIndex(localDayKey(now));
  const wrapped = ((index % pool.length) + pool.length) % pool.length;
  // In range by construction: `wrapped` is a remainder of a positive length.
  return pool[wrapped]!;
}
