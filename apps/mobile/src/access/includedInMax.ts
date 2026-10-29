/**
 * "Included in Max" (F935, founder decision 21): what a Max-only entry says
 * to a learner who holds Max, so a subscriber can see what the plan gives.
 * Max-only is read from `requiredPlan` (Stream B's lock seam, read only), so
 * this can only label a feature Core does not open. A locked entry keeps its
 * lock badge instead, and an unknown plan draws nothing.
 */
import { requiredPlan, unlockPlanName, type LockedFeature } from '../purchases/featureLocks.ts';

export const INCLUDED_IN_MAX = `Included in ${unlockPlanName('regular')}`;

/** The label for a Max-only feature the learner's plan opens, else null. */
export function includedInMax(feature: LockedFeature, unlocked: boolean): string | null {
  return unlocked && requiredPlan(feature) === 'regular' ? INCLUDED_IN_MAX : null;
}
