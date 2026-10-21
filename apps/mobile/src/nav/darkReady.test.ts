import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALWAYS_LIGHT, DARK_READY, pinnedLight, routeMode } from './darkReady.ts';
import { b } from '../palette.ts';
import { themedStyles } from '../main/themedStyles.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const NAVIGATOR = read('./RootNavigator.tsx');
/** Every tab and stack route the navigator registers, read off the source. */
const ROUTES = [...NAVIGATOR.matchAll(/<(?:Tab|Stack)\.Screen name="(\w+)"/g)].map((m) => m[1]!);
const NONE: ReadonlySet<string> = new Set();

describe('dark mode is on, and unrebuilt screens stay light — UI-008, 2026-10-20', () => {
  test('the navigator registers the routes this suite walks', () => {
    assert.ok(ROUTES.length >= 40, `only ${ROUTES.length} routes were read, so the walk below proves little`);
    for (const name of ['Home', 'Explore', 'Tutor', 'Practice', 'MyFrench', 'Settings', 'Wall', 'FirstScene']) {
      assert.ok(ROUTES.includes(name), `${name} is not registered, or the route pattern no longer reads the navigator`);
    }
  });

  test('with the device dark and nothing ready, every route draws the light tokens', () => {
    for (const route of ROUTES) {
      const mode = routeMode(route, 'dark', NONE);
      assert.equal(mode, 'light', `${route} follows a dark device before it is rebuilt`);
      assert.deepEqual(b[mode], b.light, `${route} reads tokens other than b.light`);
      assert.equal(pinnedLight(route, NONE), true, `${route} is not wrapped in PinLight`);
    }
  });

  test('a route that is not in the shipped DARK_READY set draws light on a dark device', () => {
    for (const route of ROUTES) {
      if (DARK_READY.has(route)) continue;
      assert.equal(routeMode(route, 'dark'), 'light', `${route} is not in DARK_READY yet draws dark`);
    }
    for (const route of DARK_READY) assert.ok(ROUTES.includes(route), `DARK_READY names ${route}, which is no route`);
  });

  test('a ready route follows the device both ways, so the pin is the only thing holding the rest light', () => {
    const ready = new Set(['Home']);
    assert.equal(routeMode('Home', 'dark', ready), 'dark', 'a ready route does not follow a dark device');
    assert.equal(routeMode('Home', 'light', ready), 'light', 'a ready route does not follow a light device');
    assert.equal(routeMode('Explore', 'dark', ready), 'light', 'readying one route unpinned another');
  });

  // 2026-10-21 UI-008: the paywall left ALWAYS_LIGHT for DARK_READY, so only the first scene stays light by rule.
  test('the first scene stays light even when DARK_READY names it, and the paywall follows the device', () => {
    const everything = new Set(ROUTES);
    assert.equal(ALWAYS_LIGHT.has('Wall'), false, 'the paywall is still light by rule');
    assert.equal(routeMode('Wall', 'dark'), 'dark', 'the paywall does not follow a dark device');
    assert.equal(routeMode('Wall', 'light'), 'light', 'the paywall does not follow a light device');
    for (const route of ['FirstScene']) {
      assert.ok(ALWAYS_LIGHT.has(route), `${route} is not light by rule`);
      assert.equal(routeMode(route, 'dark', everything), 'light', `${route} followed a dark device because DARK_READY named it`);
    }
    assert.equal(routeMode(undefined, 'dark', everything), 'light', 'before the navigator is ready the bar and container are not light');
  });
});

describe('the wiring holds every screen to its route mode — UI-008', () => {
  test('both navigators wrap every screen and the tab bar by route, and paint the ground by route', () => {
    const source = strip(NAVIGATOR);
    assert.match(source, /screenLayout=\{\(\{ route, children \}\) => <RouteTheme route=\{route\.name\}>\{children\}<\/RouteTheme>\}/, 'the tabs are not wrapped by route');
    assert.match(source, /screenLayout=\{\(\{ route, children \}\) => route\.name === 'Tabs' \? children : <RouteTheme route=\{route\.name\}>\{children\}<\/RouteTheme>\}/, 'the pushed screens are not wrapped by route');
    assert.match(source, /tabBar=\{\(props\) => <RouteTheme route=\{props\.state\.routes\[props\.state\.index\]\?\.name \?\? 'Home'\}><LuvaniTabBar \{\.\.\.props\} \/><\/RouteTheme>\}/, 'the tab bar does not follow the focused route');
    assert.match(source, /sceneStyle: \{ backgroundColor: groundFor\(route\.name\) \}/, 'the tab scene ground does not follow its route');
    assert.match(source, /contentStyle: \{ backgroundColor: groundFor\(route\.name\) \}/, 'the stack ground does not follow its route');
    const theme = strip(read('./RouteTheme.tsx'));
    assert.match(theme, /pinnedLight\(route\) \? <PinLight>\{children\}<\/PinLight> : <>\{children\}<\/>/, 'a pinned route is not drawn under PinLight');
  });

  test('onboarding, sign up and the launch are pinned light by rule, whatever DARK_READY says', () => {
    const app = strip(read('../../App.tsx'));
    assert.match(app, /onboarding=\{\(existing, done\) => <PinLight>\{\(/, 'the onboarding branches are not under PinLight');
    assert.match(app, /<PinLight>\s*<AuthFlow/, 'sign up is not under PinLight');
    const root = app.slice(app.indexOf('export default function App('));
    assert.ok(root.indexOf('<PinLight>') !== -1 && root.indexOf('<PinLight>') < root.indexOf('<LaunchScreen'), 'the launch is not under PinLight');
    assert.ok(root.indexOf('</PinLight>') > root.indexOf('<LaunchScreen'), 'the launch is outside the root PinLight');
    // The learner's mode is provided only inside the signed-in navigation.
    assert.equal((app.match(/<MainAppearanceProvider>/g) ?? []).length, 1, 'a second appearance provider could reach onboarding');
    assert.ok(app.indexOf('<MainAppearanceProvider>') > app.indexOf('onboarding={(existing, done)'), 'the appearance provider wraps the onboarding branch');
  });

  test('the container theme and the status bar follow the focused route, not the device alone', () => {
    const wrapper = strip(read('../main/MainNavigationTheme.tsx'));
    assert.match(wrapper, /const drawn = routeMode\(route, mode\);/);
    assert.match(wrapper, /<StatusBar style=\{b\[drawn\]\.statusBar\} \/>/);
    assert.match(wrapper, /children\(navThemes\[drawn\]\)/);
    assert.match(strip(read('../../App.tsx')), /<MainNavigationTheme navigationRef=\{navigationRef\}>/);
    assert.equal(b.light.statusBar, 'dark', 'a light screen gets a light clock');
    assert.equal(b.dark.statusBar, 'light', 'a dark screen gets a dark clock');
  });
});

describe('themed styles are built once per mode — UI-008', () => {
  test('a maker runs once per mode and every caller shares the sheet', () => {
    let calls = 0;
    const make = (t: { mode: 'light' | 'dark' }) => { calls += 1; return { mode: t.mode }; };
    const light = themedStyles(make, { mode: 'light' });
    assert.equal(themedStyles(make, { mode: 'light' }), light, 'a second light caller built its own sheet');
    const dark = themedStyles(make, { mode: 'dark' });
    assert.notEqual(dark, light, 'dark reused the light sheet');
    assert.equal(themedStyles(make, { mode: 'dark' }), dark);
    assert.equal(calls, 2, `the maker ran ${calls} times for two modes`);
  });
});
