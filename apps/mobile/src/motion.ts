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
import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native';

/**
 * Whether the learner has asked for less movement.
 *
 * Watched rather than sampled once: this is a setting somebody changes
 * *because* something is bothering them, usually while it is bothering them.
 * react-native-web's support for the change event varies by version, so both
 * the subscribe and the teardown are guarded.
 */
export function useReduceMotion(waitUntilKnown: true): boolean | null;
export function useReduceMotion(waitUntilKnown?: false): boolean;
export function useReduceMotion(waitUntilKnown = false): boolean | null {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (live) setReduced(on);
    }).catch(() => { if (live) setReduced(true); });
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (on: boolean) => {
      if (live) setReduced(on);
    });
    return () => {
      live = false;
      sub?.remove?.();
    };
  }, []);
  return waitUntilKnown ? reduced : reduced !== false;
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
 *
 * `onSettled` hears the arrival end: at once when the final frame is drawn
 * straight away, and when the settle finishes otherwise. A settle stopped
 * part-way, because its screen went, never reports one.
 */
export function settleIn(
  value: Animated.Value,
  reduced: boolean,
  delayMs = 0,
  onSettled?: () => void,
): Animated.CompositeAnimation | null {
  if (reduced) {
    value.setValue(1);
    onSettled?.();
    return null;
  }
  const animation = Animated.timing(value, {
    toValue: 1,
    duration: SETTLE_MS,
    delay: delayMs,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: NATIVE_DRIVER,
  });
  animation.start(onSettled ? ({ finished }) => { if (finished) onSettled(); } : undefined);
  return animation;
}

/**
 * The highlighter drawing in behind a French line: one stroke, left to right,
 * slower than a settle because a pen is slower than a card arriving. Revamp B
 * stills the band (STYLE section 11 leaves the pen stroke out of the motion
 * budget), so this has no caller; Stage 6 retires the export.
 */
export const DRAW_MS = 520;

/**
 * Draw a 0-to-1 highlighter stroke once, or land on the drawn band when
 * movement is withheld. Like `settleIn`, withholding motion never withholds the
 * mark: the band is the content and the stroke is the flourish.
 */
export function drawIn(value: Animated.Value, reduced: boolean, delayMs = 0): Animated.CompositeAnimation | null {
  if (reduced) {
    value.setValue(1);
    return null;
  }
  const animation = Animated.timing(value, {
    toValue: 1,
    duration: DRAW_MS,
    delay: delayMs,
    easing: Easing.out(Easing.quad),
    useNativeDriver: true,
  });
  animation.start();
  return animation;
}

/**
 * How far a pressed thing shrinks: STYLE section 11, "every tappable thing
 * scales to 0.97".
 */
export const PRESS_SCALE = 0.97;

/** The native Animated module is not on the web; a spring asked to cross there logs and stalls. */
export const NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * Take a scale to `to` on the press spring, or land there at once when
 * movement is withheld.
 *
 * The one spring in the app. STYLE section 11 gives it as iOS describes a
 * spring, response 0.3 s and damping ratio 0.7, and Animated takes physical
 * numbers, so they are converted rather than eyeballed:
 *
 *   stiffness = (2 * PI / response)^2 = (2 * PI / 0.3)^2  = 438.6, so 439
 *   damping   = 2 * ratio * sqrt(stiffness * mass)
 *             = 2 * 0.7 * sqrt(439)                     = 29.33, so 29.3
 *   mass      = 1
 *
 * Do not round them further. A ratio of 0.7 overshoots a little on release by
 * design; anyone who wants a clamped press changes STYLE first. The press is
 * cancelled by Pressable itself: when a scroll takes the responder it fires
 * `onPressOut` and never `onPress`, so the spring returns and nothing happens.
 */
export function pressTo(value: Animated.Value, to: number, reduced: boolean): Animated.CompositeAnimation | null {
  if (reduced) {
    value.setValue(to);
    return null;
  }
  const animation = Animated.spring(value, { toValue: to, stiffness: 439, damping: 29.3, mass: 1, useNativeDriver: NATIVE_DRIVER });
  animation.start();
  return animation;
}
