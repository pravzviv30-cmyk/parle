/**
 * One pop (UI-015): when `play` turns true, the child swells to `POP_PEAK` and
 * settles back to 1 on `SPRING.pop`, once. Today's flame when the streak ticks.
 * `PopIn` (MascotMotion.tsx) grows a stamp from 0.6 and would make a flame
 * already on screen jump, so this is its own primitive.
 *
 * Reduced motion, read live: no scale. Transform only.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '../motion.ts';
import { cancel, sequence, spring } from './drive.ts';
import { useAnswered, useLandOnLeave } from './landing.ts';
import { SPRING } from './tokens.ts';

/** How far the pop swells. */
export const POP_PEAK = 1.18;

export function PopOnce({ play, children }: { play: boolean; children?: ReactNode }) {
  // Waits for the OS's answer (as Drift, CountUp and ProgressRing do), so a
  // first mount that has not heard yet does not spend the pop as reduced.
  const reduced = useAnswered(useReduceMotion(true));
  const scale = useSharedValue(1);
  const played = useRef(false);
  useEffect(() => {
    // A rise that has gone again re-arms, so a later rise (a later day, Today still mounted) pops again.
    if (!play) {
      played.current = false;
      return;
    }
    if (reduced === null || played.current) return;
    played.current = true;
    if (reduced) return;
    scale.value = sequence(reduced, spring(POP_PEAK, SPRING.pop, reduced), spring(1, SPRING.pop, reduced));
  }, [play, reduced, scale]);
  useEffect(() => {
    if (!reduced) return;
    cancel(scale);
    scale.value = 1;
  }, [reduced, scale]);
  useLandOnLeave(() => {
    cancel(scale);
    scale.value = 1;
  });
  const look = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Reanimated.View pointerEvents="box-none" style={look}>{children}</Reanimated.View>;
}
