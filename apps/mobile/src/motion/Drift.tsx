/**
 * A drift in, once, on mount (UI-015): from `DRIFT_FROM` points to the left
 * to rest while fading in, on `DUR.slow` and the out curve. Today's clouds.
 *
 * Reduced motion, read live: simply there. Only transform and opacity move.
 * Decorative wrapper: touches pass through to what is under it.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '../motion.ts';
import { cancel, timing } from './drive.ts';
import { useAnswered, useLandOnLeave } from './landing.ts';
import { DUR, EASE } from './tokens.ts';

/** How far to the left it starts, in points. */
export const DRIFT_FROM = -14;

export function Drift({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const reduced = useAnswered(useReduceMotion(true));
  const shown = useSharedValue(0);
  const started = useRef(false);
  const look = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateX: (1 - shown.value) * DRIFT_FROM }],
  }));
  useEffect(() => {
    if (reduced === null) return;
    if (reduced) {
      cancel(shown);
      shown.value = 1;
      return;
    }
    if (started.current) return;
    started.current = true;
    shown.value = timing(1, DUR.slow, EASE.out, reduced);
  }, [reduced, shown]);
  useLandOnLeave(() => {
    cancel(shown);
    shown.value = 1;
  });
  return <Reanimated.View pointerEvents="none" style={[style, look]}>{children}</Reanimated.View>;
}
