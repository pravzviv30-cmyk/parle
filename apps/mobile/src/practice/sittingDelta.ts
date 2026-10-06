/**
 * The one way a finished sitting's page gets the numbers for its end card:
 * the GameDelta the settle pipeline read back from disk, never a number the
 * page worked out (README Part 6, "numbers only from the GameDelta").
 *
 * Two of the five pages hold their settle call in a shape `game/sites.test.ts`
 * pins, and the practice plan settles inside `practice/completion.ts`, which
 * answers with a status rather than a delta. So the pages hear the pipeline's
 * own `onSettled` instead, and pick out their sitting by its key, which the
 * contract builds from the two facts that name it: its source and the instant
 * it finished (`game/delta.ts`, `sitting:${source}:${at}`). The watch keeps
 * the few most recent deltas, so one that lands before the page says what it
 * is waiting for is still found.
 *
 * A page waits at most `SETTLE_WAIT_MS`. A settle that answers nothing (the
 * account changed, the snapshot could not be read, the write was refused)
 * publishes nothing, and the page then shows its finish without numbers rather
 * than a number it cannot vouch for.
 *
 * Pure, so `sittingDelta.test.ts` holds it.
 */

import type { GameDelta, SittingSource } from '../game/delta.ts';

/** The sitting a page waits for: where it came from and the instant it finished. */
export interface SittingMatch {
  readonly source: SittingSource;
  readonly at: number;
}

/** How long a page waits for its sitting's delta before it shows the finish without numbers, in ms. */
export const SETTLE_WAIT_MS = 4000;

/** How many recent deltas a watch keeps. */
export const WATCH_KEEPS = 8;

/** The key the settle gives this sitting's delta (`game/delta.ts`). */
export function sittingKey(match: SittingMatch): string {
  return `sitting:${match.source}:${Math.floor(match.at)}`;
}

export function matchesSitting(delta: GameDelta, match: SittingMatch): boolean {
  return delta.key === sittingKey(match);
}

export interface DeltaWatch {
  /** A delta the pipeline published. */
  push(delta: GameDelta): void;
  /** The delta for this sitting, if it has landed. */
  find(match: SittingMatch): GameDelta | null;
}

export function createDeltaWatch(keeps: number = WATCH_KEEPS): DeltaWatch {
  let held: GameDelta[] = [];
  return {
    push(delta) {
      held = [...held, delta].slice(-Math.max(1, keeps));
    },
    find(match) {
      for (let i = held.length - 1; i >= 0; i -= 1) if (matchesSitting(held[i]!, match)) return held[i]!;
      return null;
    },
  };
}

/**
 * Where a page's end is. `none`: nothing finished yet. `waiting`: finished,
 * its delta not here yet. `settled`: the delta is here, and only now may
 * numbers show. `unsettled`: the wait ran out with no delta, so the finish
 * shows without numbers.
 */
export type SittingEnd =
  | { readonly state: 'none' }
  | { readonly state: 'waiting' }
  | { readonly state: 'settled'; readonly delta: GameDelta }
  | { readonly state: 'unsettled' };

export function sittingEnd(match: SittingMatch | null, delta: GameDelta | null, waitedOut: boolean): SittingEnd {
  if (match === null) return { state: 'none' };
  if (delta !== null && matchesSitting(delta, match)) return { state: 'settled', delta };
  return waitedOut ? { state: 'unsettled' } : { state: 'waiting' };
}
