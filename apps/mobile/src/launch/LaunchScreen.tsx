/**
 * The launch: Hum, the Luvani mark, turning while the app opens.
 *
 * The native launch screen and this one are the same frame: the mark at
 * LAUNCH_MARK_SIZE, centred on the brand blue, drawn from the same 256 canvas
 * (see launchTiming.ts). The native one is held up from the moment this file
 * loads; this screen is drawn over everything as soon as the app can draw, and
 * releases the native one once it has been laid out, so on iOS the swap cannot
 * be seen. (Android fades its native launch out over 400 ms, so there it would
 * show; Android is not built yet.) Then:
 *
 *   - a new learner sees the still mark for 1.5 seconds; then the ring turns;
 *   - after a beat the mark lifts and the name settles in beneath it, the one
 *     settling entrance (motion.ts), which leaves the stacked logo on screen;
 *   - the finished mark and name stay centred while Get Started fades in at
 *     the bottom and invites a new learner into their plan;
 *   - returning learners continue automatically once the app is ready and the
 *     name has arrived. The destination is already rendered behind this screen.
 *
 * Transform and opacity only, on the native driver; the SVG is never animated,
 * only the views around it. With reduce motion on, the ring stays still and
 * the stacked logo is drawn at once, so the screen leaves as soon as the app is
 * ready. MAX_LAUNCH_MS releases a load that never finishes. A ready first-run
 * welcome remains until Get Started, including when reduce motion is enabled.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hide as hideNativeLaunch, preventAutoHideAsync } from 'expo-splash-screen';
import { colour, decorative, paper } from '../theme.ts';
import { NATIVE_DRIVER, SETTLE_MS, settleIn, useReduceMotion } from '../motion.ts';
import { HUM_CORE, HUM_RING_PATH, HUM_VIEWBOX, HUM_WORDMARK } from '../brand/hum.ts';
import { ArrowRight, PillButton } from '../components.tsx';
import { GlowAction } from '../onboarding/motion/OnboardingScenes.tsx';
import {
  ENTRANCE_DELAY_MS,
  FIRST_LAUNCH_STILL_MS,
  LAUNCH_MARK_SIZE,
  MAX_LAUNCH_MS,
  RING_TURN_MS,
  launchMayLeave,
  launchCanStart,
  createVisibleDelay,
} from './launchTiming.ts';
import { useLaunchReady, useLaunchWelcome } from './useLaunch.ts';

/** The stacked logo's proportions: the ring is 1.9 times the name's height. */
const RING_SPAN = (224 / HUM_VIEWBOX) * LAUNCH_MARK_SIZE;
const WORD_HEIGHT = Math.round(RING_SPAN / 1.9);
const WORD_WIDTH = Math.round((WORD_HEIGHT * HUM_WORDMARK.width) / HUM_WORDMARK.height);
const WORD_GAP = Math.round(WORD_HEIGHT * 0.42);
/** How far the mark lifts so the finished logo sits centred as one group. */
const LIFT = (WORD_GAP + WORD_HEIGHT) / 2;
/** How far the name rises as it arrives. */
const WORD_RISE = 12;
const VIEWBOX = `0 0 ${HUM_VIEWBOX} ${HUM_VIEWBOX}`;

// Expo drops the native launch screen on the app's first view unless told to
// wait. That first view is the safe-area provider, which draws nothing until
// it knows the insets, so without this the window could show empty for a
// frame before this screen arrives. Called as the file loads, before anything
// renders, which is when Expo needs to hear it.
preventAutoHideAsync().catch(() => undefined);

export function LaunchScreen({ onDone }: { onDone: () => void }) {
  const reduced = useReduceMotion(true);
  const appReady = useLaunchReady();
  const welcome = useLaunchWelcome();
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [laidOut, setLaidOut] = useState(false);
  const [stillFinished, setStillFinished] = useState(false);
  const [actionReady, setActionReady] = useState(false);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  const spin = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const presence = useRef(new Animated.Value(1)).current;
  const welcomeEntrance = useRef(new Animated.Value(0)).current;
  const [entered, setEntered] = useState(false);
  const [started, setStarted] = useState(false);
  const [capped, setCapped] = useState(false);
  const released = useRef(false);
  const leaving = useRef(false);

  // This frame is the native launch screen's frame, so the native one goes
  // the moment this one has been laid out, and never on a timer.
  const releaseNativeLaunch = useCallback(() => {
    if (released.current) return;
    released.current = true;
    hideNativeLaunch();
    setLaidOut(true);
  }, []);

  // Start counting only when this frame is visible, even if identity is still
  // loading. Pausing the app preserves the unspent part of the 1.5-second hold.
  useEffect(() => {
    if (!laidOut) return undefined;
    const delay = createVisibleDelay(FIRST_LAUNCH_STILL_MS, () => setStillFinished(true));
    delay.setActive(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', state => delay.setActive(state === 'active'));
    return () => { delay.dispose(); subscription.remove(); };
  }, [laidOut]);
  const mayStart = laidOut && launchCanStart(welcome, reduced, stillFinished);

  // The one loop: the ring turns. Still until the setting is known, and still
  // for good when the learner has asked for less movement.
  useEffect(() => {
    if (reduced !== false) return undefined;
    if (!mayStart) return undefined;
    if (!active) return undefined;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: RING_TURN_MS,
        easing: Easing.linear,
        useNativeDriver: NATIVE_DRIVER,
      }),
    );
    loop.start();
    // Stopped part-way, the ring stands back upright: the mark has one lobe
    // pointing straight up, and that is the frame reduce motion draws.
    return () => {
      loop.stop();
      spin.setValue(0);
    };
  }, [reduced, spin, active, mayStart]);

  // The one settling entrance: the mark lifts and the name arrives beneath it.
  useEffect(() => {
    if (reduced === null || !mayStart || entered) return undefined;
    if (!active) return undefined;
    const arrival = settleIn(entrance, reduced, welcome ? 0 : ENTRANCE_DELAY_MS, () => setEntered(true));
    return () => arrival?.stop();
  }, [reduced, entrance, mayStart, active, entered, welcome]);

  // A failed load is released at the cap; a ready welcome awaits Get Started.
  useEffect(() => {
    const cap = setTimeout(() => setCapped(true), MAX_LAUNCH_MS);
    return () => clearTimeout(cap);
  }, []);

  // Keep the completed lockup centred. Only the bottom action fades in.
  useEffect(() => {
    welcomeEntrance.stopAnimation();
    if (!welcome || !entered || !appReady) {
      welcomeEntrance.setValue(0);
      setActionReady(false);
      return;
    }
    const arrival = settleIn(welcomeEntrance, reduced !== false, 0, () => setActionReady(true));
    return () => arrival?.stop();
  }, [welcome, entered, appReady, reduced, welcomeEntrance]);

  // Leave once the app is ready and the name has arrived.
  useEffect(() => {
    if (leaving.current || !launchMayLeave({ appReady, entered, capped, welcome, started })) return;
    leaving.current = true;
    const departure = Animated.timing(presence, {
      toValue: 0,
      duration: reduced ? 0 : SETTLE_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    });
    departure.start(({ finished }) => { if (finished) onDone(); });
    return () => { departure.stop(); leaving.current = false; };
  }, [appReady, entered, capped, welcome, started, reduced, presence, onDone]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const lift = entrance.interpolate({ inputRange: [0, 1], outputRange: [0, -LIFT] });
  const rise = entrance.interpolate({ inputRange: [0, 1], outputRange: [WORD_RISE, 0] });

  return (
    <Animated.View
      style={[st.screen, { opacity: presence }]}
      onLayout={releaseNativeLaunch}
      accessible={!welcome}
      accessibilityRole={welcome ? undefined : 'image'}
      accessibilityLabel="Luvani"
      accessibilityViewIsModal
    >
      <StatusBar style="light" />
      <Animated.View style={st.mark} accessible={welcome === true} accessibilityRole="image" accessibilityLabel="Luvani">
        <Animated.View style={[st.group, { transform: [{ translateY: lift }] }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
            <Svg {...decorative} width="100%" height="100%" viewBox={VIEWBOX}>
              <Path d={HUM_RING_PATH} fill={colour.sun} />
            </Svg>
          </Animated.View>
          <Svg {...decorative} style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={VIEWBOX}>
            <Circle cx={HUM_CORE.cx} cy={HUM_CORE.cy} r={HUM_CORE.r} fill={colour.coral} />
          </Svg>
          <Animated.View style={[st.word, { opacity: entrance, transform: [{ translateY: rise }] }]}>
            <Svg {...decorative} width="100%" height="100%" viewBox={`0 0 ${HUM_WORDMARK.width} ${HUM_WORDMARK.height}`}>
              <Path d={HUM_WORDMARK.d} fill={paper.onInk} />
            </Svg>
          </Animated.View>
        </Animated.View>
      </Animated.View>
      {welcome && entered && appReady && <Animated.View pointerEvents={actionReady && !started ? 'auto' : 'none'} accessibilityElementsHidden={!actionReady} importantForAccessibility={actionReady ? 'auto' : 'no-hide-descendants'} style={[st.start, { bottom: insets.bottom + 28, opacity: welcomeEntrance }]}>
        <GlowAction tone="sun" active={actionReady && active && !started}>
          <PillButton tone="sun" label="Get Started" trailingIcon={<ArrowRight color={paper.ink} />} onPress={() => { if (actionReady && !started) setStarted(true); }} />
        </GlowAction>
      </Animated.View>}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  screen: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colour.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { width: LAUNCH_MARK_SIZE, height: LAUNCH_MARK_SIZE, overflow: 'visible' },
  start: { position: 'absolute', width: '100%', maxWidth: 480, paddingHorizontal: 24, alignSelf: 'center' },
  group: { width: LAUNCH_MARK_SIZE, height: LAUNCH_MARK_SIZE, overflow: 'visible' },
  word: {
    position: 'absolute',
    top: LAUNCH_MARK_SIZE / 2 + RING_SPAN / 2 + WORD_GAP,
    left: (LAUNCH_MARK_SIZE - WORD_WIDTH) / 2,
    width: WORD_WIDTH,
    height: WORD_HEIGHT,
  },
});
