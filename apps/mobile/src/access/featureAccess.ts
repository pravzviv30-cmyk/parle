/**
 * The one access seam for lock badges (Phase B, B0, 2026-10-20; wired to the
 * D24 standing 2026-10-20, lock seam wiring).
 *
 * A surface draws `<LockBadge>` only when this says 'locked', so the badge
 * never decides anything. The answer is main's cached billing standing,
 * `featureLockedNow`, which fails open: a plan nobody could read answers
 * 'unlocked', so a learner is never stranded behind a lock nobody checked.
 *
 * The feature list is main's (`purchases/featureLocks.ts`), re-exported so
 * there is one list. This file imports from that module and nothing else in
 * `purchases/` or `wall/`; featureAccess.test.ts holds that. The reactive hook
 * that re-renders a surface and opens the Wall is `useFeatureAccess.ts`.
 */

import { featureLockedNow, LOCKED_FEATURES, type LockedFeature } from '../purchases/featureLocks.ts';

export { LOCKED_FEATURES, type LockedFeature };

export type FeatureAccess = 'unlocked' | 'locked';

export function featureAccess(feature: LockedFeature): FeatureAccess {
  return featureLockedNow(feature) ? 'locked' : 'unlocked';
}

/**
 * What a tap on a lockable item does: a locked one opens the Wall, anything
 * else goes where it always went. The one rule behind every route-less lock
 * (`fullJourney`, `continueArc`), so no surface decides it inline.
 */
export function tapThrough(access: (feature: LockedFeature) => FeatureAccess, feature: LockedFeature, openWall: (feature: LockedFeature) => void, go: () => void): void {
  if (access(feature) === 'locked') openWall(feature);
  else go();
}
