/**
 * The one door to the animation engine.
 *
 * Reanimated 4.5.1 reads the system reduce-motion setting once, when its module
 * loads, and every `withTiming`, `withSpring` and friend left to its default
 * follows that stale answer for the rest of the launch. A learner who turns
 * Reduce Motion on mid-session would go on being animated at. So nothing calls
 * the engine's animation functions except this file, and every wrapper here
 * takes `reduced`, the live answer from `useReduceMotion()` in motion.ts, and
 * hands the engine `ReduceMotion.Always` or `ReduceMotion.Never` explicitly.
 * `motion.test.ts` holds both halves: the `with*` calls live only here, and
 * each one passes `mode(reduced)`.
 *
 * Callers still land on the final frame themselves when `reduced` is true
 * (`value.value = to`) and start nothing; passing the mode here is the second
 * belt, for anything already running when the setting changes.
 *
 * Imported only by `.tsx` files and motion.ts, never by a module a Node suite
 * loads: a suite that fails to load the engine vanishes without failing.
 */

import {
  Easing,
  ReduceMotion,
  cancelAnimation,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { Bezier, SpringToken } from './tokens.ts';

/** The live answer, said to the engine so it never consults its own. */
function mode(reduced: boolean): ReduceMotion {
  return reduced ? ReduceMotion.Always : ReduceMotion.Never;
}

/** A token curve as the engine's easing. */
export function bezier(curve: Bezier) {
  const [x1, y1, x2, y2] = curve;
  return Easing.bezier(x1, y1, x2, y2);
}

/** Travel to `to` over `duration` on a token curve. */
export function timing(to: number, duration: number, ease: Bezier, reduced: boolean): number {
  return withTiming(to, { duration, easing: bezier(ease), reduceMotion: mode(reduced) });
}

/** Travel to `to` on a token spring. Pass `SPRING.<name>`, never numbers. */
export function spring(to: number, cfg: SpringToken, reduced: boolean): number {
  return withSpring(to, { ...cfg, reduceMotion: mode(reduced) });
}

/** Start `anim` after `ms`. */
export function delay(ms: number, anim: number, reduced: boolean): number {
  return withDelay(ms, anim, mode(reduced));
}

/** Run animations one after another. */
export function sequence(reduced: boolean, ...anims: number[]): number {
  return withSequence(mode(reduced), ...anims);
}

/**
 * Repeat `anim` `count` times. A count of -1 runs until replaced, which only a
 * loop the motion rules allow may ask for (motion.test.ts names the files), and
 * only while something it can pause on says it is showing.
 */
export function repeat(anim: number, count: number, reverse: boolean, reduced: boolean): number {
  return withRepeat(anim, count, reverse, undefined, mode(reduced));
}

/** Stop whatever is driving a value, where it stands. */
export function cancel(value: SharedValue<number>): void {
  cancelAnimation(value);
}
