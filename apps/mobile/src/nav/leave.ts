/**
 * The way out of a pushed screen: back when there is a screen behind it,
 * otherwise the tabs, with this screen closed (F775).
 *
 * On the web a pushed screen can be opened cold, by a reload or a shared
 * address, and then there is nothing behind it. A bare goBack does nothing
 * there (GO_BACK not handled), and a navigate to the tabs pushes them ON TOP
 * of this screen, which stays mounted underneath. A sitting left that way is
 * never closed, so the holds it keeps on the celebration queue (the sitting
 * hold and the settle hold, `practice/useSittingEnd.ts`) never lift and no
 * moment plays again until a reload. A reset leaves the tabs alone on the
 * stack, so the sitting unmounts and lets its holds go.
 *
 * Pure: the navigator is handed in. RootNavigator's routes and
 * `useBackToHome` call this, and `leave.test.ts` runs it against a stack
 * that behaves like the root one.
 */

import type { TabParamList } from './types.ts';

/** The root stack with the tabs alone on it, opened on `tab` when one is named. */
export interface TabsAlone {
  index: number;
  routes: { name: 'Tabs'; params?: { screen: keyof TabParamList } }[];
}

/** What leaving needs from the navigator. */
export interface LeavingNav {
  canGoBack(): boolean;
  goBack(): void;
  reset(state: TabsAlone): void;
}

export function tabsAlone(tab?: keyof TabParamList): TabsAlone {
  return { index: 0, routes: [tab === undefined ? { name: 'Tabs' } : { name: 'Tabs', params: { screen: tab } }] };
}

export function backOrTabs(nav: LeavingNav, tab?: keyof TabParamList): void {
  if (nav.canGoBack()) nav.goBack();
  else nav.reset(tabsAlone(tab));
}
