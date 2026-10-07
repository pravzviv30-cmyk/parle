/**
 * One pass of light across a pill (come alive section 3).
 *
 * Three tilted bands in the card's white, at 0.10, 0.24 and 0.10, cross the
 * pill from left to right in `GLINT.pass` on the linear curve, through
 * motion/drive.ts, `GLINT.wait` after `when` first becomes true. Once per
 * mount, never a loop: it says "this is ready now", it does not nag. Place it
 * last inside the pill; it fills the pill, clips itself to the pill's corners,
 * and is decorative and untouchable, so the pill's label and press are
 * unchanged.
 *
 * Reduced motion: nothing. A glint is only movement, so its final frame is no
 * glint. Watched live; the app leaving the foreground ends it too.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '../motion.ts';
import { decorative, paper, radius as corner } from '../theme.ts';
import { cancel, delay, timing } from './drive.ts';
import { useAnswered, useLandOnLeave } from './landing.ts';
import { EASE, GLINT } from './tokens.ts';

export function Glint({
  when,
  wait = GLINT.wait,
  radius = corner.control,
}: {
  /** The first time this is true, the glint passes once. */
  when: boolean;
  /** How long after `when` it starts, in milliseconds. */
  wait?: number;
  /** The pill's corner, so the light stays inside it. */
  radius?: number;
}) {
  const reduced = useAnswered(useReduceMotion(true));
  const travel = useSharedValue(0);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const [passing, setPassing] = useState(false);
  const spent = useRef(false);

  const land = useCallback(() => {
    cancel(travel);
    setPassing(false);
  }, [travel]);

  useEffect(() => {
    if (reduced) land();
    if (reduced === null || !when || box === null || spent.current) return;
    // Spent the first time it is asked for, played or not: turning reduced
    // motion off later never brings back a glint that belonged to that moment.
    spent.current = true;
    if (reduced) return;
    setPassing(true);
    travel.value = 0;
    travel.value = delay(wait, timing(1, GLINT.pass, EASE.linear, reduced, () => setPassing(false)), reduced);
  }, [reduced, when, box, wait, travel, land]);

  useLandOnLeave(land);

  const width = box?.width ?? 0;
  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: (GLINT.from + (GLINT.to - GLINT.from) * travel.value) * width }, { rotate: `${GLINT.tilt}deg` }],
  }));

  const measure = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    if (w > 0 && h > 0) setBox({ width: w, height: h });
  };
  // The bands stand twice the pill's height so their tilt never shows an end,
  // and are centred on the travelling point, so the pass starts outside the pill.
  const tall = (box?.height ?? 0) * 2;
  const across = GLINT.bands.reduce((sum, band) => sum + band.width, 0) * width;
  return (
    <View {...decorative} pointerEvents="none" onLayout={measure} style={[StyleSheet.absoluteFill, st.clip, { borderRadius: radius }]}>
      {passing && box !== null ? (
        <Reanimated.View pointerEvents="none" style={[st.bands, { height: tall, top: -box.height / 2, left: -across / 2 }, sweep]}>
          {GLINT.bands.map((band, i) => (
            <View key={i} style={{ width: band.width * box.width, height: tall, backgroundColor: paper.card, opacity: band.opacity }} />
          ))}
        </Reanimated.View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  clip: { overflow: 'hidden' },
  bands: { position: 'absolute', flexDirection: 'row' },
});
