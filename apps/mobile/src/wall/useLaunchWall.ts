/**
 * The launch wall's wiring (D24). The rules are `launchWall.ts`'s; this hands
 * them the navigator, AppState, the celebration queue, Home's arrival and the
 * two reads. App.tsx calls it once and renders `LaunchWallArrival` inside the
 * account hand-off, which is the only place Home's arrival can be read.
 */

import { useContext, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { celebrationsHeld, onCelebrationHoldChange } from '../celebrate/queue.ts';
import { HomeArrivalAllowed } from '../onboarding/HomeArrival.tsx';
import { purchases } from '../purchases/adapter.ts';
import { fetchBillingStatus } from '../purchases/client.ts';
import { setStanding } from '../purchases/featureLocks.ts';
import { paywallSurface } from '../purchases/paywallView.ts';
import { scopeGeneration } from '../storage/scope.ts';
import type { RootStackParamList } from '../nav/types.ts';
import { LAUNCH_WALL_AWAY_MS, launchWallController, type LaunchWall } from './launchWall.ts';
import { launchWallAwayMs, previewOffering } from './preview.ts';

export function useLaunchWall(navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>, userId: string): LaunchWall & { arrival: (allowed: boolean) => void } {
  const arrivalAllowed = useRef(true);
  const wall = useMemo(() => launchWallController({
    moment: () => ({
      ready: navigationRef.isReady(),
      route: navigationRef.isReady() ? navigationRef.getCurrentRoute() : undefined,
      celebrationsHeld: celebrationsHeld(),
      arrivalAllowed: arrivalAllowed.current,
      active: AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
    }),
    owner: scopeGeneration,
    status: async () => {
      const owner = scopeGeneration();
      const status = await fetchBillingStatus(userId);
      if (owner === scopeGeneration()) setStanding(userId, status);
      return status;
    },
    storeHasPlans: async () => {
      const offering = await purchases.offering(userId);
      // The same stand-in WallScreen uses, so a local-development store preview has plans to sell.
      return paywallSurface(offering.available ? offering : (previewOffering() ?? offering)) !== null;
    },
    open: (door) => navigationRef.navigate('Wall', { entry: door }),
    frame: (run) => requestAnimationFrame(run),
    cancelFrame: (id) => cancelAnimationFrame(id),
    now: () => Date.now(),
    awayMs: launchWallAwayMs(undefined, LAUNCH_WALL_AWAY_MS),
  }), [navigationRef, userId]);
  useEffect(() => {
    const foreground = AppState.addEventListener('change', (state) => wall.appState(state));
    const held = onCelebrationHoldChange(() => wall.flush());
    return () => { wall.dispose(); foreground.remove(); held(); };
  }, [wall]);
  return useMemo(() => ({
    ...wall,
    arrival: (allowed: boolean) => {
      arrivalAllowed.current = allowed;
      wall.flush();
    },
  }), [wall]);
}

/** Reports whether Home's arrival is allowed, from inside the account hand-off. Renders nothing. */
export function LaunchWallArrival({ report }: { report: (allowed: boolean) => void }): null {
  const allowed = useContext(HomeArrivalAllowed);
  useEffect(() => { report(allowed); }, [allowed, report]);
  return null;
}
