/**
 * Navigation and the status bar follow the mode the focused route draws in
 * (UI-008, 2026-10-20; the pattern from Codex's MainNavigationTheme). A route
 * pinned light by DARK_READY gets the light container theme and a dark status
 * bar even when the device is dark, so the clock always reads on its ground.
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { NavigationContainerRefWithCurrent, ParamListBase, Theme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { b } from '../palette.ts';
import { navThemes } from '../nav/theme.ts';
import { routeMode } from '../nav/darkReady.ts';
import { useB } from './bTheme.tsx';

export function MainNavigationTheme<P extends ParamListBase>({ navigationRef, children }: {
  /** The container's ref: the focused leaf route is read from its state events. */
  navigationRef: NavigationContainerRefWithCurrent<P>;
  children: (theme: Theme) => ReactNode;
}) {
  const { mode } = useB();
  const [route, setRoute] = useState<string | undefined>(undefined);
  useEffect(() => {
    const follow = () => setRoute(navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined);
    follow();
    const offState = navigationRef.addListener('state', follow);
    const offReady = navigationRef.addListener('ready', follow);
    return () => { offState(); offReady(); };
  }, [navigationRef]);
  const drawn = routeMode(route, mode);
  return <>
    <StatusBar style={b[drawn].statusBar} />
    {children(navThemes[drawn])}
  </>;
}
