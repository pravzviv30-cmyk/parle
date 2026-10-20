/**
 * The D24 locks, wired (rules in `featureLocks.ts`).
 *
 * - `useFeatureStanding` keeps the cached standing fresh: on launch, on every
 *   return to the foreground, and on every billing change. Called once, by App.
 * - `useLockedRouteGuard` is the navigator's guard: a focused route that is a
 *   locked feature is replaced by the wall at its `locked` door. Unknown reads
 *   once; unreadable leaves the screen open.
 * - `useFeatureLocks` is the reactive read for a surface: `access(feature)` and
 *   `open(feature)`, which opens the wall at its `locked` door.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { StackActions, useNavigation, type NavigationContainerRefWithCurrent } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { onUserScopeReset, scopeGeneration } from '../storage/scope.ts';
import type { RootStackParamList } from '../nav/types.ts';
import { onBillingChange } from './billingChanges.ts';
import { fetchBillingStatus } from './client.ts';
import { clearStanding, featureLockState, invalidateStanding, lockedRouteGuard, onStandingChange, setStanding, standingFor, standingVersion, type FeatureLockState, type LockedFeature } from './featureLocks.ts';

/** Read the server's answer for this account into the standing, fenced to the account. */
async function refreshStanding(userId: string): Promise<void> {
  const owner = scopeGeneration();
  const asked = standingVersion();
  let status = null;
  try { status = await fetchBillingStatus(userId); } catch { status = null; }
  if (owner === scopeGeneration() && asked === standingVersion()) setStanding(userId, status);
}

export function useFeatureStanding(userId: string): void {
  useEffect(() => {
    void refreshStanding(userId);
    const foreground = AppState.addEventListener('change', (state) => { if (state === 'active') void refreshStanding(userId); });
    const billing = onBillingChange((change) => { if (change.userId === userId && change.owner === scopeGeneration()) { invalidateStanding(userId); void refreshStanding(userId); } });
    const reset = onUserScopeReset(() => clearStanding());
    return () => { foreground.remove(); billing(); reset(); clearStanding(); };
  }, [userId]);
}

export function useLockedRouteGuard(navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>, userId: string): () => Promise<void> {
  return useMemo(() => lockedRouteGuard({
    route: () => (navigationRef.isReady() ? navigationRef.getCurrentRoute() : undefined),
    standing: () => standingFor(userId),
    read: async () => {
      const owner = scopeGeneration();
      const status = await fetchBillingStatus(userId);
      if (owner === scopeGeneration()) setStanding(userId, status);
      return status;
    },
    owner: scopeGeneration,
    toWall: () => navigationRef.dispatch(StackActions.replace('Wall', { entry: 'locked' })),
  }), [navigationRef, userId]);
}

export function useFeatureLocks(userId: string | null | undefined): { access: (feature: LockedFeature) => FeatureLockState; open: (feature: LockedFeature) => void } {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [, setTick] = useState(0);
  useEffect(() => onStandingChange(() => setTick((n) => n + 1)), []);
  const access = useCallback((feature: LockedFeature) => featureLockState(feature, standingFor(userId)), [userId]);
  const open = useCallback((_feature: LockedFeature) => nav.navigate('Wall', { entry: 'locked' }), [nav]);
  return { access, open };
}
