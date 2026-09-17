/**
 * Which paper sits under each real moment a learner can bring (F584).
 *
 * The same bargain `missions/missionTint.ts` and `tutor/doorTint.ts` strike: one
 * file decides the colour, a screen names the moment, and nothing in a `.tsx`
 * ever writes a tint. It is a `Record` over the closed key union, so an eighth
 * kind added to `realMoments.ts` is a compile error here rather than a row that
 * quietly renders on nothing.
 *
 * The order the six tints appear in is the mockup's, read left to right and top
 * to bottom across the two columns, so no two neighbours in the grid share a
 * paper. That is the whole rule: a tint here is a way of telling eight cards
 * apart at a glance, never a claim about the moment. A job interview is not
 * warmer or harder than a family dinner, and nothing in the grid is a state.
 *
 * This file reaches only the NAME of a tint, never a value, so it loads under
 * plain node and `palette.test.ts`'s rule that a hex is reachable from four
 * files only still holds.
 */

import type { TintName } from '../palette.ts';
import type { RealMomentKey } from './realMoments.ts';

export const MOMENT_TINT: Record<RealMomentKey, TintName> = {
  interview: 'sand',
  date: 'rose',
  'hotel-call': 'sky',
  'family-dinner': 'lilac',
  doctor: 'sage',
  meeting: 'lagoon',
  neighbour: 'sand',
  other: 'lilac',
};

/** The paper under one moment. Total, because the parameter is the closed union. */
export function momentTint(key: RealMomentKey): TintName {
  return MOMENT_TINT[key];
}
