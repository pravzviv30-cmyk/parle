/**
 * Two rings that swell with a live sound level (come alive, core loop
 * sections 3.3 and 3.6).
 *
 * The caller owns the level: a SharedValue from 0 to 1 that a recorder or the
 * live room writes on the UI thread, with no React state per sample. The first
 * ring follows it at once, scaling to `1 + 0.22 * L` at opacity
 * `0.25 + 0.6 * L`; the second trails it, re-aimed through motion/drive.ts over
 * `LEVEL_RING.follow` each time the level moves, so the pair breathes rather
 * than flickers. Place it behind the control it rings, the same size as that
 * control. Transform and opacity only; decorative and untouchable, because the
 * control it surrounds says what is happening.
 *
 * Nothing loops: it moves only when the level does, so a silent microphone is
 * a still ring.
 *
 * Reduced motion: no scale and no trailing ring, only three opacity steps on
 * the first (0.3, 0.6 and 1 from a level of 0.15, 0.45 and 0.75), so the
 * learner still sees they are being heard. Watched live.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '../motion.ts';
import { colour, decorative, STROKE } from '../theme.ts';
import { cancel, timing } from './drive.ts';
import { useLandOnLeave } from './landing.ts';
import { EASE, LEVEL_RING } from './tokens.ts';

export function LevelRing({
  level,
  size,
  color = colour.mint,
}: {
  /** The live level, 0 to 1, written by the recorder or the room. */
  level: SharedValue<number>;
  /** The diameter of the control it rings. */
  size: number;
  /** The rings' colour. A palette token. */
  color?: string;
}) {
  const reduced = useReduceMotion();
  const trail = useSharedValue(0);

  useAnimatedReaction(
    () => level.value,
    (now, previous) => {
      if (reduced || now === previous) return;
      trail.value = timing(Math.min(1, Math.max(0, now)), LEVEL_RING.follow, EASE.out, reduced);
    },
    [reduced],
  );

  useEffect(() => {
    if (!reduced) return;
    cancel(trail);
    trail.value = 0;
  }, [reduced, trail]);

  useLandOnLeave(() => {
    cancel(trail);
    trail.value = 0;
  });

  const first = useAnimatedStyle(() => {
    const at = Math.min(1, Math.max(0, level.value));
    if (reduced) {
      const step = LEVEL_RING.steps.find((s) => at >= s.from);
      return { opacity: step === undefined ? 0 : step.opacity, transform: [{ scale: 1 }] };
    }
    return { opacity: LEVEL_RING.base + LEVEL_RING.lift * at, transform: [{ scale: 1 + LEVEL_RING.grow * at }] };
  }, [reduced]);

  const second = useAnimatedStyle(() => {
    if (reduced) return { opacity: 0, transform: [{ scale: 1 }] };
    const at = trail.value;
    return { opacity: LEVEL_RING.base + LEVEL_RING.lift * at, transform: [{ scale: 1 + LEVEL_RING.grow * at }] };
  }, [reduced]);

  const ring = { width: size, height: size, borderRadius: size / 2, borderColor: color };
  return (
    <View {...decorative} pointerEvents="none" style={[st.box, { width: size, height: size }]}>
      <Reanimated.View pointerEvents="none" style={[st.ring, ring, second]} />
      <Reanimated.View pointerEvents="none" style={[st.ring, ring, first]} />
    </View>
  );
}

const st = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: STROKE },
});
