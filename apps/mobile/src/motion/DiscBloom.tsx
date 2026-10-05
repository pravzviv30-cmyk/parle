/**
 * A soft flat glow opening behind something earned: the spec's Bloom (come
 * alive section 3), named `DiscBloom` because J14 in surfaceContract.test.ts
 * keeps `Bloom` on its list of retired exports, a different, older component,
 * and a retired name coming back is exactly what that list exists to stop.
 *
 * Three concentric flat discs in one palette colour, each a share of the
 * radius at its own opacity (`BLOOM.discs`), with no gradient: the paper world
 * has no airbrush. They grow together from 0.3 to full size over `DUR.slow` on
 * the out curve, through motion/drive.ts. A held bloom settles to rest at 0.92
 * and stays; otherwise it fades away over `DUR.base`. Transform and opacity
 * only, decorative and untouchable.
 *
 * The caller places it (it is `2.2 * radius` square) behind the thing it lights.
 *
 * Reduced motion: a held bloom is there at rest at once; a passing one, whose
 * final frame is gone, is not drawn. Watched live.
 */

import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '../motion.ts';
import { colour, decorative } from '../theme.ts';
import { cancel, delay, sequence, spring, timing } from './drive.ts';
import { useAnswered, useLandOnLeave } from './landing.ts';
import { BLOOM, DUR, EASE, SPRING } from './tokens.ts';

export function DiscBloom({
  color = colour.sun,
  radius,
  hold = false,
  style,
}: {
  /** The discs' colour. A palette token. */
  color?: string;
  /** The middle disc's radius is 0.85 of this; the outer one reaches 1.1 of it. */
  radius: number;
  /** Stay, resting at 0.92, rather than fading away. */
  hold?: boolean;
  /** Where the caller places it. */
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useAnswered(useReduceMotion(true));
  const grow = useSharedValue<number>(BLOOM.from);
  const shown = useSharedValue(0);
  const started = useRef(false);

  const land = useCallback(() => {
    cancel(grow);
    cancel(shown);
    grow.value = hold ? BLOOM.rest : 1;
    shown.value = hold ? 1 : 0;
  }, [grow, shown, hold]);

  useEffect(() => {
    if (reduced === null) return;
    if (reduced) {
      land();
      return;
    }
    if (started.current) return;
    started.current = true;
    shown.value = 1;
    grow.value = hold
      ? sequence(reduced, timing(1, DUR.slow, EASE.out, reduced), spring(BLOOM.rest, SPRING.settle, reduced))
      : timing(1, DUR.slow, EASE.out, reduced);
    if (!hold) shown.value = delay(DUR.slow, timing(0, DUR.base, EASE.in, reduced), reduced);
  }, [reduced, hold, grow, shown, land]);

  useLandOnLeave(land);

  const look = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ scale: grow.value }] }));
  if (reduced === null || (reduced && !hold)) return null;
  const size = 2 * radius * BLOOM.discs[BLOOM.discs.length - 1]!.size;
  return (
    <Reanimated.View {...decorative} pointerEvents="none" style={[st.box, { width: size, height: size }, style, look]}>
      {BLOOM.discs.map((disc) => {
        const d = 2 * radius * disc.size;
        return (
          <View
            key={disc.size}
            style={[st.disc, { width: d, height: d, borderRadius: d / 2, backgroundColor: color, opacity: disc.opacity }]}
          />
        );
      })}
    </Reanimated.View>
  );
}

const st = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  disc: { position: 'absolute' },
});
