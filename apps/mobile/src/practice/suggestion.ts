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
 * Where the walk starts is the day's own pick, so the first thing a learner
 * sees on this card is the situation the app already chose for them today.
 * Tapping walks forward from there, one at a time, all the way round.
 *
 * Pure and clock-injected. The offset lives in `suggestionStore.ts`.
 */

import { dailyPick, type DailyScenario } from '@luvani/core';

/** Everything the card says, spelled once. */
export const SUGGESTION = {
  label: 'Scenario inspiration',
  title: "Can't think of a scenario?",
  blurb: 'Luvani can suggest a real conversation to have next, somewhere you are likely to find yourself.',
  suggested: 'Suggested for you',
  another: 'Suggest another',
  drill: 'Practice drill',
  tutor: 'With tutor',
} as const;

/**
 * Which situation the card is showing.
 *
 * `dailyPick` decides where the walk starts, so this does not grow a second
 * opinion about what today's situation is. From there the offset steps through
 * the pool in authored order and wraps, which means a learner who taps their
 * way round meets every situation once before meeting any of them twice.
 *
 * A negative or fractional offset is folded back to a whole step rather than
 * throwing: it can only arrive from a corrupt stored value, and a card that
 * refuses to draw is worse than a card showing the first situation.
 */
export function suggestionFor(
  pool: readonly DailyScenario[],
  now: number,
  offset: number,
): DailyScenario | null {
  if (pool.length === 0) return null;

  const today = dailyPick(pool, now);
  const start = pool.findIndex((scenario) => scenario.id === today.id);
  const step = Number.isFinite(offset) ? Math.abs(Math.trunc(offset)) : 0;
  return pool[(Math.max(0, start) + step) % pool.length] ?? null;
}

/** The next offset, kept inside the pool so the stored number cannot run away. */
export function nextOffset(offset: number, poolSize: number): number {
  if (poolSize <= 0) return 0;
  const step = Number.isFinite(offset) ? Math.abs(Math.trunc(offset)) : 0;
  return (step + 1) % poolSize;
}
