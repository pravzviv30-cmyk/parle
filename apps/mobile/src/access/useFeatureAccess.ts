/**
 * The reactive face of the lock seam (2026-10-20, lock seam wiring).
 *
 * A surface calls this once; it re-renders whenever the billing standing
 * changes, and hands back `access` for its view models and `open` for a
 * locked tap, which navigates to `Wall { entry: 'locked' }`. With a user id the
 * answer is that account's standing, as `useFeatureLocks` reads it; without
 * one it is the cached standing, as `featureAccess` reads it. Either way an
 * unknown plan answers 'unlocked'. Only `access/` talks to `purchases/`.
 */

import { useCallback } from 'react';
import { useFeatureLocks } from '../purchases/useFeatureLocks.ts';
import { featureAccess, type FeatureAccess, type LockedFeature } from './featureAccess.ts';

export function useFeatureAccess(userId?: string | null): { access: (feature: LockedFeature) => FeatureAccess; open: (feature: LockedFeature) => void } {
  const locks = useFeatureLocks(userId ?? null);
  const scoped = useCallback((feature: LockedFeature): FeatureAccess => (locks.access(feature) === 'locked' ? 'locked' : 'unlocked'), [locks.access]);
  return { access: userId ? scoped : featureAccess, open: locks.open };
}
