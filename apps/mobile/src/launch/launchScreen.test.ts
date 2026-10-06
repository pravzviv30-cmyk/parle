/**
 * The launch: Hum turning while the app opens, held to its promises.
 *
 * apps/mobile has no renderer, so this is a source walk in the mould of
 * motion.test.ts and nativeStartup.test.ts: the things being defended are a
 * component, two config files and an SVG master, so those are what get read.
 * The timing rules themselves are proved in launchTiming.test.ts and the
 * readiness registry in launchHold.test.ts.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HUM_CORE, HUM_RING_PATH, HUM_VIEWBOX } from '../brand/hum.ts';
import { LAUNCH_MARK_SIZE } from './launchTiming.ts';
import { colour } from '../palette.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const SCREEN = strip(read('./LaunchScreen.tsx'));
const APP = strip(read('../../App.tsx'));
const MARK = read('../../assets/brand/luvani-mark.svg');
const config = JSON.parse(read('../../app.json')) as {
  expo: { plugins: ReadonlyArray<string | [string, { backgroundColor?: string; image?: string; imageWidth?: number }]> };
};
const splash = config.expo.plugins.find(
  (entry): entry is [string, { backgroundColor?: string; image?: string; imageWidth?: number }] =>
    Array.isArray(entry) && entry[0] === 'expo-splash-screen',
)?.[1];

describe('the launch is Hum, the same mark as the icon and the splash', () => {
  test('the launch screen draws exactly the ring and core of the brand master', () => {
    // One generator writes both, so a hand edit to either shows up here.
    const paths = [...MARK.matchAll(/<path fill="(#[0-9A-Fa-f]{6})" d="([^"]+)"\/>/g)].map((m) => ({
      fill: (m[1] ?? '').toUpperCase(),
      d: m[2] ?? '',
    }));
    assert.equal(paths.length, 2, 'luvani-mark.svg is no longer the two-part mark this test reads');
    const [ring, core] = paths as [{ fill: string; d: string }, { fill: string; d: string }];
    assert.equal(ring.fill, colour.sun, 'the ring in the master is not the sun');
    assert.equal(ring.d, HUM_RING_PATH, 'the launch screen\'s ring is not the ring in luvani-mark.svg');
    assert.equal(core.fill, colour.coral, 'the core in the master is not the coral');
    assert.match(MARK, /viewBox="0 0 256 256"/, 'the master is not drawn on the 256 canvas');
    assert.equal(HUM_VIEWBOX, 256);
    // The core is drawn as a circle in the app and as a path in the master;
    // its extent must agree to within a hair.
    const xs = [...core.d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
    const radius = (Math.max(...xs) - Math.min(...xs)) / 2;
    assert.ok(Math.abs(radius - HUM_CORE.r) < 0.05, `the core is ${HUM_CORE.r} in the app and ${radius} in the master`);
  });

  test('the native launch and the launch screen are one frame, so the hand-off cannot be seen', () => {
    assert.ok(splash, 'app.json no longer configures expo-splash-screen');
    assert.equal(splash.image, './assets/brand/luvani-mark-1024.png', 'the native launch draws something other than the mark');
    assert.equal(splash.imageWidth, LAUNCH_MARK_SIZE, 'the native mark and the launch screen\'s mark are different sizes');
    assert.equal(splash.backgroundColor?.toUpperCase(), colour.blue, 'the native launch is not on the brand blue');
    assert.match(SCREEN, /backgroundColor: colour\.blue/, 'the launch screen is not on the brand blue');
    assert.match(SCREEN, /mark: \{ width: LAUNCH_MARK_SIZE, height: LAUNCH_MARK_SIZE/, 'the launch mark is not LAUNCH_MARK_SIZE');
    assert.match(SCREEN, /const VIEWBOX = `0 0 \$\{HUM_VIEWBOX\} \$\{HUM_VIEWBOX\}`;/, 'the launch mark is not drawn on the master\'s canvas');
    assert.match(SCREEN, /alignItems: 'center',\s*justifyContent: 'center'/, 'the launch mark is not centred like the native one');
  });
});

describe('the launch moves only in the app\'s vocabulary', () => {
  test('the ring turns by a view transform on the native driver, and the SVG never moves', () => {
    const loop = SCREEN.slice(SCREEN.indexOf('Animated.loop('));
    assert.ok(SCREEN.includes('Animated.loop('), 'the ring no longer turns');
    assert.match(loop, /easing: Easing\.linear/, 'the ring speeds up and slows down instead of humming');
    assert.match(loop, /useNativeDriver: NATIVE_DRIVER/, 'the ring turns on the JS thread');
    assert.match(SCREEN, /transform: \[\{ rotate \}\]/, 'the ring is not turned by its view');
    assert.doesNotMatch(SCREEN, /<(?:Svg|Path|Circle)[^>]*(?:rotation|transform|origin)=/, 'an SVG attribute is animated');
  });

  test('the name arrives as the one settling entrance, and reduce motion draws the final frame', () => {
    assert.match(SCREEN, /useReduceMotion\(true\)/, 'the launch does not wait to learn whether movement is wanted');
    assert.match(SCREEN, /if \(reduced !== false\) return undefined;/, 'the ring turns before reduce motion is known, or despite it');
    assert.match(
      SCREEN,
      /settleIn\(entrance, reduced, ENTRANCE_DELAY_MS, \(\) => setEntered\(true\)\)/,
      'the name does not arrive on the app\'s one settle',
    );
    assert.match(SCREEN, /loop\.stop\(\);\s*spin\.setValue\(0\);/, 'a ring stopped part-way is left tilted instead of upright');
  });
});

describe('the launch opens wherever the app was already going', () => {
  test('the launch screen leaves only when the app is ready and the name has arrived, or at the cap', () => {
    assert.match(SCREEN, /launchMayLeave\(\{ appReady, entered, capped \}\)/, 'the launch decides to leave somewhere other than launchTiming');
    assert.match(SCREEN, /setTimeout\(\(\) => setCapped\(true\), MAX_LAUNCH_MS\)/, 'the launch has no cap');
    assert.match(SCREEN, /\.start\(\(\) => onDone\(\)\)/, 'the launch never hands back');
  });

  test('every wait on the way in holds the launch, so it fades onto a real screen', () => {
    // Every App.tsx wait renders the one Loading view, so holding there holds them all.
    const loading = APP.slice(APP.indexOf('function Loading()'), APP.indexOf('const SUPABASE_URL'));
    assert.match(loading, /useLaunchHold\(\);/, 'the app\'s loading view does not hold the launch');
    // The waits that draw something else, each beside the first early return
    // in its component. The hold must come before it, or the hook would only
    // run on some renders.
    const waits = [
      { file: '../app/ProfileContext.tsx', hold: "useLaunchHold(profile === 'loading');", firstReturn: "if (profile === 'loading') return null;" },
      { file: '../onboarding/GuestAccountHandoff.tsx', hold: 'useLaunchHold(guest === undefined);', firstReturn: 'if (guest === null) return' },
      { file: '../onboarding/PreAccountOnboarding.tsx', hold: 'useLaunchHold(!loaded);', firstReturn: 'if (!loaded)' },
    ];
    for (const { file, hold, firstReturn } of waits) {
      const source = strip(read(file));
      const at = source.indexOf(hold);
      assert.ok(at >= 0, `${file} waits on the way in without holding the launch`);
      assert.ok(source.indexOf(firstReturn) > at, `${file} holds the launch after an early return, so the hook runs conditionally`);
    }
  });

  test('a screen reader meets the launch alone, and the app once the launch has gone', () => {
    assert.match(SCREEN, /accessibilityLabel="Luvani"/, 'the launch has no name for a screen reader');
    assert.match(SCREEN, /accessibilityViewIsModal/, 'VoiceOver can wander from the launch into the app beneath');
    const app = APP.slice(APP.indexOf('export default function App()'));
    assert.match(app, /accessibilityElementsHidden=\{!launched\}/, 'VoiceOver can reach the app beneath the launch');
    assert.match(
      app,
      /importantForAccessibility=\{launched \? 'auto' : 'no-hide-descendants'\}/,
      'TalkBack can reach the app beneath the launch',
    );
  });

  test('the app renders beneath the launch, and the launch is drawn on top until it is done', () => {
    const app = APP.slice(APP.indexOf('export default function App()'));
    assert.match(app, /\{loaded \? \(/, 'the app no longer waits for Outfit before its first screen');
    assert.match(app, /<Gate \/>/, 'the door is gone from beneath the launch');
    assert.match(app, /\{!launched && <LaunchScreen onDone=\{finishLaunch\} \/>\}/, 'the launch is not drawn until it says it is done');
    assert.ok(app.indexOf('<Gate />') < app.indexOf('<LaunchScreen'), 'the launch is drawn beneath the app instead of over it');
  });
});
