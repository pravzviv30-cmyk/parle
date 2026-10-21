/**
 * The navigator's half of the DARK_READY rule (DECISIONS.md UI-008,
 * 2026-10-20): a route not yet rebuilt for dark renders under `<PinLight>`,
 * and a ready one follows the provider. Both navigators wrap every screen
 * through `screenLayout`, and the tab bar is wrapped by the focused route, so
 * the bar, the scene ground and the screen always agree.
 */
import type { ReactElement, ReactNode } from 'react';
import { PinLight, useB } from '../main/bTheme.tsx';
import { b } from '../palette.ts';
import { pinnedLight, routeMode } from './darkReady.ts';

export function RouteTheme({ route, children }: { route: string; children: ReactNode }): ReactElement {
  return pinnedLight(route) ? <PinLight>{children}</PinLight> : <>{children}</>;
}

/** The ground a route's scene paints before its screen draws. */
export function useRouteGround(): (route: string) => string {
  const { mode } = useB();
  return (route: string) => b[routeMode(route, mode)].ground;
}
