/**
 * What the learner can now do, for Home (F545).
 *
 * The passport already knows which situations were handled unaided, and Home
 * never said so. This is the fold Home draws: up to three stamps earned on
 * your own, in the passport's own words, and nothing at all for a learner
 * with none, on `passport.ts`'s rule that a rail of empty marks is a quota.
 *
 * One softer shape sits between those. A learner who has been through a
 * situation with help has a fact worth saying, and it is said as what it is:
 * so far, with help. Never as "you can now", which it is not yet.
 */

import { isStamped, type Stamp } from '../progress/passport.ts';

export const MAX_ABILITIES = 3;

export const ABILITIES_LABEL = 'You can now';
export const SO_FAR_LABEL = 'So far';

export interface Abilities {
  label: string;
  /** Stamps earned on your own, newest evidence first as the caller ordered them. */
  rows: readonly Stamp[];
  /** The softer sentence, when nothing is stamped yet but something was walked with help. */
  softLine: string | null;
}

export function abilitiesFrom(stamps: readonly Stamp[]): Abilities | null {
  const own = stamps.filter(isStamped).slice(0, MAX_ABILITIES);
  if (own.length > 0) return { label: ABILITIES_LABEL, rows: own, softLine: null };
  const helped = stamps.filter((stamp) => stamp.state === 'with-help');
  if (helped.length === 0) return null;
  return { label: SO_FAR_LABEL, rows: [], softLine: `With help so far: ${helped.map((stamp) => stamp.titleEn).join(', ')}.` };
}
