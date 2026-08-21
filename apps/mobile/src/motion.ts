/**
 * The app's one motion vocabulary.
 *
 * DESIGN.md has said for a while that this vocabulary "now has exactly one
 * implementation", and it had four: `useSceneMotion`, `VoiceOrb`, `Transcript`
 * and `SplashScreen` each called `AccessibilityInfo.isReduceMotionEnabled()`
 * and each hand-rolled its own final-frame branch. Three of them sampled the
 * setting once and never looked again, so a learner who turned reduce motion on
 * mid-session kept being animated at until the next launch. Only the scene hook
 * subscribed. That one was right, so it is the one that survived.
 *
 * The settling entrance was copy-pasted too, the same 380ms out-cubic in two
 * files, which is how a vocabulary becomes a dialect.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/**
 * Whether the learner has asked for less movement.
 *
 * Watched rather than sampled once: this is a setting somebody changes
 * *because* something is bothering them, usually while it is bothering them.
 * react-native-web's support for the change event varies by version, so both
 * the subscribe and the teardown are guarded.
 */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (live) setReduced(on);
    });
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (on: boolean) => {
      if (live) setReduced(on);
    });
    return () => {
      live = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

/**
 * One settling entrance: a thing arrives, slows, and stops. Transform and
 * opacity only, on the native driver, and nothing bounces.
 */
export const SETTLE_MS = 380;

/**
 * Drive a 0-to-1 settle, or land on its final frame when movement is withheld.
 *
 * The final frame rather than nothing, always: the arrival is the flourish and
 * the content is the point, so withholding motion must never withhold content.
 */
export function settleIn(value: Animated.Value, reduced: boolean, delayMs = 0): Animated.CompositeAnimation | null {
  if (reduced) {
    value.setValue(1);
    return null;
  }
  const animation = Animated.timing(value, {
    toValue: 1,
    duration: SETTLE_MS,
    delay: delayMs,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  });
  animation.start();
  return animation;
}
