/**
 * F907 and F931, read at the state level: what an address resolves to, and
 * how many walls the root stack holds after Terms, Privacy and a second
 * navigate. The real StackRouter runs here; a browser replay is still the
 * proof of the web history itself.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { getStateFromPath as defaultStateFromPath, type NavigationState as AnyState, type PartialState } from '@react-navigation/core';
import { CommonActions, StackActions, StackRouter, type ParamListBase, type StackNavigationState } from '@react-navigation/routers';
import { evidence } from '../../test/evidence.ts';
import { linking } from './linking.ts';
import { singleWallId } from './singleWall.ts';

type NavigationState = StackNavigationState<ParamListBase>;
type Resolved = PartialState<AnyState> | undefined;
const resolve = (path: string): Resolved => defaultStateFromPath(path, linking.config as Parameters<typeof defaultStateFromPath>[1]) as Resolved;
const focused = (state: Resolved): string[] => {
  const names: string[] = [];
  let at: Resolved = state;
  while (at !== undefined) {
    const route = at.routes[at.index ?? at.routes.length - 1]!;
    names.push(route.name);
    at = route.state as Resolved;
  }
  return names;
};

describe('addresses', () => {
  test('an unknown address goes Home rather than to the plans page', () => {
    for (const path of ['/nope', '/plans/extra/deep', '/home/elsewhere', '/%E2%9C%93']) {
      assert.deepEqual(focused(resolve(path)), ['Tabs', 'Home'], `${path} did not resolve to Home`);
    }
    // Known addresses are unchanged.
    assert.deepEqual(focused(resolve('/plans?entry=launch')), ['Wall']);
    assert.deepEqual(focused(resolve('/terms')), ['Terms']);
    assert.deepEqual(focused(resolve('/practice')), ['Tabs', 'Practice']);
    assert.equal(linking.getStateFromPath, undefined, 'a custom parser replaced the map this test reads');
  });
});

describe('one wall', () => {
  const routeNames = ['Tabs', 'Wall', 'Terms', 'Policy'];
  const router = StackRouter({});
  const options = { routeNames, routeParamList: {} as ParamListBase, routeGetIdList: { Wall: singleWallId } };
  const walls = (state: NavigationState) => state.routes.filter((route) => route.name === 'Wall').length;
  const act = (state: NavigationState, action: Parameters<typeof router.getStateForAction>[1]) => {
    const next = router.getStateForAction(state, action, options);
    assert.ok(next !== null, `${action.type} was not handled`);
    return next as NavigationState;
  };

  test('opening Terms then Privacy from the wall keeps one wall', () => {
    // A reload on /plans: the wall alone, as linking builds it.
    let state = router.getRehydratedState({ routes: [{ name: 'Wall', params: { entry: 'launch' } }] } as never, options) as NavigationState;
    state = act(state, CommonActions.navigate('Terms'));
    state = act(state, CommonActions.goBack());
    state = act(state, CommonActions.navigate('Policy'));
    // The browser's Back with no history record arrives as a fresh navigate to the wall's address.
    state = act(state, CommonActions.navigate('Wall', { entry: 'launch' }));
    assert.equal(walls(state), 1, 'a second wall was pushed');
    assert.equal(state.routes[state.index]?.name, 'Wall');
    // And from Home, with a wall already open under Terms.
    let home = router.getInitialState(options) as NavigationState;
    home = act(home, CommonActions.navigate('Wall', { entry: 'launch' }));
    home = act(home, CommonActions.navigate('Terms'));
    home = act(home, StackActions.push('Wall', { entry: 'locked' }));
    assert.equal(walls(home), 1, 'a push stacked a second wall');
    // React Navigation 7 moves the open wall to the top rather than popping what sits above it.
    assert.equal(home.routes[home.index]?.name, 'Wall');
    assert.equal(home.routes[0]?.name, 'Tabs');

    assert.match(evidence('apps/mobile/src/nav/RootNavigator.tsx'), /<Stack\.Screen name="Wall" component=\{WallRoute\} getId=\{singleWallId\}/, 'the wall screen is not single-instance');
  });
});

describe('leaving the wall', () => {
  const routeNames = ['Tabs', 'Wall', 'Terms', 'Policy', 'Convo', 'Review'];
  const router = StackRouter({});
  const options = { routeNames, routeParamList: {} as ParamListBase, routeGetIdList: { Wall: singleWallId } };
  const act = (state: NavigationState, action: Parameters<typeof router.getStateForAction>[1]) => {
    const next = router.getStateForAction(state, action, options);
    assert.ok(next !== null, `${action.type} was not handled`);
    return next as NavigationState;
  };

  test('a wall opened over a live scene never pops the scene', () => {
    // The onward ways out of the wall, as WallRoute takes them: Start speaking, the bank, and leave with nothing behind.
    for (const onward of [StackActions.replace('Convo', { textMode: false }), StackActions.replace('Review')]) {
      let state = router.getInitialState(options) as NavigationState;
      state = act(state, CommonActions.navigate('Wall', { entry: 'launch' }));
      state = act(state, onward);
      if (onward.payload.name === 'Review') state = act(state, CommonActions.navigate('Convo', { textMode: false }));
      const convoKey = state.routes.find((route) => route.name === 'Convo')?.key;
      assert.ok(convoKey);
      // Out of minutes in the scene: the refused wall over it.
      state = act(state, CommonActions.navigate('Wall', { entry: 'refused', resumeRouteKey: convoKey }));
      assert.ok(state.routes.some((route) => route.key === convoKey), `the live scene was popped after ${onward.payload.name}`);
      assert.equal(state.routes.filter((route) => route.name === 'Wall').length, 1);
    }
    // A wall opened cold (a reload on /plans) and left: the tabs replace it.
    let cold = router.getRehydratedState({ routes: [{ name: 'Wall', params: { entry: 'launch' } }] } as never, options) as NavigationState;
    cold = act(cold, StackActions.replace('Tabs'));
    cold = act(cold, CommonActions.navigate('Convo', { textMode: false }));
    cold = act(cold, CommonActions.navigate('Wall', { entry: 'refused' }));
    assert.deepEqual(cold.routes.map((route) => route.name), ['Tabs', 'Convo', 'Wall']);

    // WallRoute itself: Terms and Privacy return to the wall; nothing else is pushed over it.
    const nav = evidence('apps/mobile/src/nav/RootNavigator.tsx');
    const wall = nav.slice(nav.indexOf('function WallRoute('), nav.indexOf('function TutorMemoryRoute('));
    assert.ok(wall.length > 0, 'WallRoute moved; this check reads nothing');
    const pushed = [...wall.matchAll(/nav\.navigate\('(\w+)'/g)].map((m) => m[1]).sort();
    assert.deepEqual(pushed, ['Policy', 'Terms'], 'the wall is left underneath another flow');
  });
});

describe('the compare sheet', () => {
  test('the compare sheet keeps a readable width on a desktop screen', () => {
    const page = evidence('apps/mobile/src/wall/WallPlansPage.tsx');
    const compare = page.slice(page.indexOf('function ComparePlans('), page.indexOf('</Sheet>', page.indexOf('function ComparePlans(')));
    assert.ok(compare.length > 0, 'ComparePlans moved; this check reads nothing');
    // The Sheet's reading measure (`sheetReading`: maxWidth READING), the one the other reading sheets use.
    assert.match(compare, /<Sheet reading /, 'the compare sheet stretches to the full desktop width');
    assert.match(evidence('apps/mobile/src/components.tsx'), /sheetReading: \{ alignSelf: 'center', width: '100%', maxWidth: READING \}/);
  });
});
