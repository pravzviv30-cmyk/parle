/**
 * F907 and F931, read at the state level: what an address resolves to, and
 * how many walls the root stack holds after Terms, Privacy and a second
 * navigate. The real StackRouter runs here; a browser replay is still the
 * proof of the web history itself.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { getPathFromState as defaultPathFromState, getStateFromPath as defaultStateFromPath, type NavigationState as AnyState, type PartialState } from '@react-navigation/core';
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

  // F1255: @react-navigation/core 7.22.1 replaced query-string with its own parser. This
  // pins what the app's map reads and writes. Every case but the last passes on both parsers;
  // the last is the advisory's own shape and fails on the old one. The other change the old
  // parser made, sorting keys on the way out, is deliberately not asserted here.
  test('a deep link query round-trips through the navigation parser that replaced query-string', () => {
    const config = linking.config as Parameters<typeof defaultStateFromPath>[1];
    const params = (path: string) => resolve(path)?.routes[0]?.params;
    const back = (path: string) => defaultPathFromState(resolve(path)!, config);
    assert.deepEqual(params('/drill?tag=a&tag=b'), { tag: ['a', 'b'] }, 'a repeated key is a list');
    assert.equal(back('/drill?tag=a&tag=b'), '/drill?tag=a&tag=b');
    assert.deepEqual(params('/drill?q=caf%C3%A9+cr%C3%A8me'), { q: 'café crème' }, 'a plus is a space and UTF-8 decodes');
    assert.equal(back('/drill?q=caf%C3%A9+cr%C3%A8me'), '/drill?q=caf%C3%A9%20cr%C3%A8me');
    assert.deepEqual(params('/drill?q=%E2%9C%93'), { q: '✓' });
    // A malformed percent sequence stays as text rather than throwing, and is escaped on the way out.
    assert.deepEqual(params('/drill?q=%E0%A4%A'), { q: '%E0%A4%A' });
    assert.equal(back('/drill?q=%E0%A4%A'), '/drill?q=%25E0%25A4%25A');
    assert.deepEqual(params('/drill?q=&flag'), { q: '', flag: null }, 'an empty value and a bare key survive');
    assert.deepEqual(params(back('/drill?q=&flag')), { q: '', flag: null }, 'compared as params, because the old parser sorted keys');
    assert.deepEqual(params('/drill?a[]=1'), { 'a[]': '1' }, 'brackets are part of the key, not an array');
    // GHSA-qr28-fpjm-wq7f: undecodable %XX runs sent decode-uri-component into its slow
    // fallback, about 1.5 s for this input on core 7.21.12. Core 7.25.0 parses it in well under 1 ms.
    const started = performance.now();
    assert.equal((params(`/drill?q=${'%FF'.repeat(400)}`) as { q?: string }).q, '%FF'.repeat(400));
    assert.ok(performance.now() - started < 200, 'a run of undecodable percent sequences took over 200 ms to parse');
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

// F929: the brief is tutor-only. react-navigation (core getPathFromState, called
// by native useLinking on every state change, not only on reload) writes the
// focused route's params through the `stringify` config, so the address is
// whatever stringifySeedTopic writes. Asked of the real library and the real map.
test('the tutor brief never reaches the web address', async () => {
  const { getPathFromState } = await import('@react-navigation/core');
  const { learningSuggestions } = await import('../main/learningSuggestions.ts');
  const { talkChips } = await import('../tutor/speakTabView.ts');
  const { DAILY_SCENARIOS, seedTopicOf } = await import('@luvani/core');
  const seeds = [
    ...talkChips(learningSuggestions({ level: 'getby', confidence: 'hesitant', focus: 'speaking' })).map((c) => c.params.seedTopic!).filter(Boolean),
    seedTopicOf(DAILY_SCENARIOS[0]!),
  ];
  for (const seedTopic of seeds) {
    assert.ok(seedTopic.brief, 'this seed carries no brief to keep out');
    const state = { index: 1, routes: [{ name: 'Main', state: { index: 0, routes: [{ name: 'Tutor' }] } }, { name: 'Convo', params: { seedTopic, textMode: true } }] };
    const path = decodeURIComponent(getPathFromState(state as never, linking.config as never));
    assert.match(path, /^\/conversation\?/, path);
    assert.ok(path.includes(seedTopic.en), `the title should survive a reload: ${path}`);
    assert.ok(!path.includes(seedTopic.brief!) && !/brief/.test(path), `the brief reached the address: ${path}`);
  }
});
