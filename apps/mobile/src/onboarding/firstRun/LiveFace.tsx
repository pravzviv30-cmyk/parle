/**
 * The live face of the first run's Continue, laid over its off face (F758;
 * come alive, icons section 3.4).
 *
 * `NextButton` draws the off face, the sand skeleton with soft ink words, and
 * this layer over it: the ink fill with white words. When an answer is chosen
 * the layer fades in over `DUR.fast` on the out curve, through motion/drive.ts,
 * and fades out the same way if the answer goes. Opacity only, untouchable, so
 * the button's label, state and press are the button's own.
 *
 * Reduced motion: the face is simply on or off, watched live.
 */

import { useEffect, type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '../../motion.ts';
import { cancel, timing } from '../../motion/drive.ts';
import { DUR, EASE } from '../../motion/tokens.ts';

export function LiveFace({ live, style, children }: { live: boolean; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduced = useReduceMotion();
  const shown = useSharedValue(live ? 1 : 0);
  useEffect(() => {
    cancel(shown);
    const to = live ? 1 : 0;
    shown.value = reduced ? to : timing(to, DUR.fast, EASE.out, reduced);
  }, [live, reduced, shown]);
  useEffect(() => () => cancel(shown), [shown]);
  const look = useAnimatedStyle(() => ({ opacity: shown.value }));
  return (
    <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style, look]}>
      {children}
    </Reanimated.View>
  );
}
