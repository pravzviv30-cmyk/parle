/**
 * The way out of a pushed screen closes it (F775).
 *
 * On the web a sitting can be opened cold, by a reload or a shared address,
 * with nothing behind it on the root stack. Its exit used to navigate to the
 * tabs, which React Navigation's stack router answers by pushing the tabs ON
 * TOP of the sitting: the sitting stays mounted underneath, so the holds it
 * keeps on the celebration queue never lift. `backOrTabs` resets instead.
 *
 * The stack here is React Navigation's own `StackRouter`, the router the root
 * native stack runs on, so `canGoBack`, `goBack`, `navigate` and `reset`
 * answer exactly as they do in the app. A route is mounted while it is on the
 * stack; a sitting route mounted here takes the two holds its page takes
 * (`practice/useSittingEnd.ts`): the sitting hold, and the settle hold it
 * keeps while it waits for its end card. The holds are the real queue's.
 */

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CommonActions, StackRouter, type ParamListBase, type StackActionType, type StackNavigationState } from '@react-navigation/routers';

import { celebrationsHeld, holdCelebrations, onCelebrationHoldChange } from '../celebrate/queue.ts';
import { createSettleHold } from '../practice/settleHold.ts';
import { backOrTabs, tabsAlone, type LeavingNav } from './leave.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const flat = (relative: string): string =>
  read(relative).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\s+/g, ' ');

/** Some of the root stack's routes: the tabs, three sittings and a pushed page. */
const ROUTES = ['Tabs', 'Drill', 'Lesson', 'Review', 'DailyPractice'];

/** A page mounted on the stack: what it does when it leaves. */
type Page = () => () => void;

/** A sitting page, holding the queue the way `useSittingEnd` does while it waits for its end card. */
const sittingPage: Page = () => {
  const letGo = holdCelebrations();
  const settle = createSettleHold();
  settle.open();
  settle.take();
  settle.claim();
  return () => {
    settle.close();
    letGo();
  };
};

const leftOpen: (() => void)[] = [];
afterEach(() => {
  while (leftOpen.length > 0) leftOpen.pop()!();
  assert.equal(celebrationsHeld(), false, 'a test left the queue held');
});

/** The root stack on React Navigation's own router, opened on `opened`, with the pages it mounts. */
function rootStack(opened: readonly string[], pages: Readonly<Record<string, Page>> = {}) {
  const router = StackRouter({ initialRouteName: 'Tabs' });
  const options = { routeNames: ROUTES, routeParamList: {}, routeGetIdList: {} };
  let state: StackNavigationState<ParamListBase> = router.getRehydratedState({ routes: opened.map((name) => ({ name })) }, options);
  const mounted = new Map<string, { name: string; unmount: () => void }>();
  const sync = (): void => {
    const keys = new Set(state.routes.map((route) => route.key));
    for (const [key, page] of mounted) {
      if (keys.has(key)) continue;
      mounted.delete(key);
      page.unmount();
    }
    for (const route of state.routes) {
      if (!mounted.has(route.key)) mounted.set(route.key, { name: route.name, unmount: (pages[route.name] ?? (() => () => {}))() });
    }
  };
  sync();
  leftOpen.push(() => {
    for (const page of mounted.values()) page.unmount();
    mounted.clear();
  });
  const dispatch = (action: CommonActions.Action | StackActionType): void => {
    const next = router.getStateForAction(state, action, options);
    assert.ok(next !== null, `the root stack did not handle ${action.type}`);
    // A reset hands over a partial state; the container rehydrates it, as here.
    state = next.stale === false ? (next as StackNavigationState<ParamListBase>) : router.getRehydratedState(next as never, options);
    sync();
  };
  const nav: LeavingNav & { navigate: (name: string, params?: object) => void } = {
    // What React Navigation's own canGoBack asks, for a navigator with no parent.
    canGoBack: () => router.getStateForAction(state, CommonActions.goBack(), options) !== null,
    goBack: () => dispatch(CommonActions.goBack()),
    reset: (tabs) => dispatch(CommonActions.reset(tabs)),
    navigate: (name, params) => dispatch(CommonActions.navigate(name, params)),
  };
  return {
    nav,
    /** The stack, bottom first, with any tab it opens on. */
    routes: () => state.routes.map((route) => ({ name: route.name, ...(route.params === undefined ? {} : { params: route.params }) })),
    /** The pages still mounted, by name. */
    mounted: () => [...mounted.values()].map((page) => page.name),
  };
}

describe('leaving a pushed screen closes it — F775', () => {
  test('leaving a sitting opened cold on the web closes it and lets its holds go', () => {
    let heard = 0;
    const stopHearing = onCelebrationHoldChange(() => {
      heard += 1;
    });
    leftOpen.push(stopHearing);

    // A practice sitting reloaded at /drill: nothing behind it, and it holds the queue.
    const cold = rootStack(['Drill'], { Drill: sittingPage });
    assert.equal(cold.nav.canGoBack(), false, 'the cold stack has something behind the sitting, so this reads nothing');
    assert.equal(celebrationsHeld(), true, 'the sitting does not hold the queue, so this reads nothing');
    const before = heard;
    backOrTabs(cold.nav, 'Practice');
    assert.deepEqual(cold.routes(), [{ name: 'Tabs', params: { screen: 'Practice' } }], 'a cold practice sitting does not leave to the Practice tab');
    assert.deepEqual(cold.mounted(), ['Tabs'], 'the sitting stayed mounted under the tabs');
    assert.equal(celebrationsHeld(), false, 'the sitting left, and its holds did not lift');
    assert.ok(heard > before, 'the game layer never heard the holds lift, so a catch-up it put off never runs');

    // Every other drill, a lesson and a review, opened cold, leave to the tabs the same way.
    for (const [name, tab] of [['Drill', undefined], ['Lesson', undefined], ['Review', 'Practice']] as const) {
      const stack = rootStack([name], { [name]: sittingPage });
      backOrTabs(stack.nav, tab);
      assert.deepEqual(stack.routes(), tabsAlone(tab).routes, `${name} opened cold leaves somewhere other than the tabs`);
      assert.deepEqual(stack.mounted(), ['Tabs'], `${name} opened cold stays mounted after it is left`);
      assert.equal(celebrationsHeld(), false, `${name} opened cold keeps the queue held after it is left`);
    }

    // The exit it replaced: the router pushes the tabs over the cold sitting,
    // which stays mounted and keeps the queue held. This is the bug.
    const old = rootStack(['Drill'], { Drill: sittingPage });
    old.nav.navigate('Tabs', { screen: 'Practice' });
    assert.deepEqual(old.mounted(), ['Drill', 'Tabs'], 'the router no longer pushes over a cold sitting, so this reads nothing');
    assert.equal(celebrationsHeld(), true);
    backOrTabs(old.nav);
    assert.deepEqual(old.mounted(), ['Drill'], 'with the tabs pushed over it, back is back to the sitting');
    backOrTabs(old.nav);
    assert.equal(celebrationsHeld(), false);

    // With a screen behind it, back is back, and the sitting goes too.
    const warm = rootStack(['Tabs', 'Drill'], { Drill: sittingPage });
    assert.equal(celebrationsHeld(), true);
    backOrTabs(warm.nav, 'Practice');
    assert.deepEqual(warm.routes(), [{ name: 'Tabs' }], 'a sitting with the tabs behind it was not simply closed');
    assert.equal(celebrationsHeld(), false);

    // A pushed page opened cold leaves the same way through useBackToHome.
    const daily = rootStack(['DailyPractice'], { DailyPractice: sittingPage });
    backOrTabs(daily.nav);
    assert.deepEqual(daily.mounted(), ['Tabs']);
    assert.equal(celebrationsHeld(), false, "today's phrase opened cold keeps the queue held after it is left");

    // Every way out of a sitting is this one.
    const navigator = flat('./RootNavigator.tsx');
    assert.match(navigator, /import \{ backOrTabs, type LeavingNav \} from '\.\/leave\.ts';/, 'the navigator does not leave through leave.ts');
    assert.doesNotMatch(navigator, /function backOrTabs\(/, 'the navigator keeps an exit of its own');
    assert.match(navigator, /onDone=\{\(\) => backOrTabs\(nav, practice !== undefined \? 'Practice' : undefined\)\}/, 'the drill leaves some other way');
    for (const [from, to] of [
      ['function FirstSceneRoute()', 'function LessonRoute()'],
      ['function LessonRoute()', 'function ConvoRoute()'],
      ['function ConvoRoute()', 'async function markPractisedNode('],
      ['function DrillRoute()', 'function ReviewRoute()'],
      ['function ReviewRoute()', 'function PolicyRoute()'],
      ['function SoundCheckRoute()', 'function Tabs()'],
    ] as const) {
      const at = navigator.indexOf(from);
      const route = navigator.slice(at, navigator.indexOf(to, at + from.length));
      assert.ok(at >= 0 && route.length > from.length, `${from} moved; this test is stale`);
      assert.match(route, /backOrTabs\(nav/, `${from} leaves some other way`);
      assert.doesNotMatch(route, /navigate\('Tabs'/, `${from} pushes the tabs over itself when it is opened cold`);
    }
    const hook = flat('./useBackToHome.ts');
    assert.match(hook, /return useCallback\(\(\) => backOrTabs\(nav\), \[nav\]\);/, 'useBackToHome leaves some other way');
    assert.doesNotMatch(hook, /navigate\(/, 'useBackToHome pushes the tabs over a page opened cold');
  });
});
