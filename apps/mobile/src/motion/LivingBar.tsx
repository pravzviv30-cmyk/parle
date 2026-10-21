/**
 * A progress bar that feels alive when it moves (come alive section 3).
 *
 * The fill grows from the left by `scaleX`, on the settle spring, through
 * motion/drive.ts. A shine strip runs along the top of the fill, and while it
 * grows a spark at its leading edge swells and fades once. When it fills and
 * `celebrateAtFull` is set, the whole bar stretches tall and springs back on the
 * pop spring, and `onFull` is said, once per time it fills. Transform and
 * opacity only (motion.test.ts, rule 6).
 *
 * Reduced motion: the fill is at `to` at once, with no spark and no stretch;
 * `onFull` is still said on the next tick when it fills, because what it fills
 * is real. Watched live. The fraction must be a real stored one.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '../motion.ts';
import { decorative } from '../theme.ts';
import { useB } from '../main/bTheme.tsx';
import { cancel, sequence, spring, timing } from './drive.ts';
import { useAnswered, useLandOnLeave } from './landing.ts';
import { fraction } from './ring.ts';
import { DUR, EASE, LIVING_BAR, SPRING } from './tokens.ts';

export function LivingBar({
  from = 0,
  to,
  color: askedColor,
  track: askedTrack,
  height = 10,
  radius = 5,
  celebrateAtFull = false,
  onFull,
  accessibilityLabel,
  style,
}: {
  /** Where the fill starts, a fraction from 0 to 1. A real earlier value, or 0. */
  from?: number;
  /** The real stored fraction it fills to, from 0 to 1. */
  to: number;
  /** The fill. A palette token. */
  color?: string;
  /** The empty part. A palette token. */
  track?: string;
  height?: number;
  radius?: number;
  /** Stretch the bar once when it fills. */
  celebrateAtFull?: boolean;
  /** Said once each time the bar fills. */
  onFull?: () => void;
  /** With a label the bar is announced as a progress bar; without one it is decorative and the words beside it speak. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useAnswered(useReduceMotion(true));
  const goal = fraction(to);
  const fill = useSharedValue(fraction(from));
  const spark = useSharedValue(0);
  // 2026-10-21 UI-008: the defaults, shine and spark read the theme; in light
  // they are the old colour.blue, paper.line and white exactly. The shine stays
  // a white highlight in dark (onBrand), never the dark card.
  const t = useB();
  const color = askedColor ?? t.brand;
  const track = askedTrack ?? t.line;
  const stretch = useSharedValue(1);
  const [width, setWidth] = useState(0);
  const target = useRef<number | null>(null);
  const latest = useRef({ goal, onFull });
  useEffect(() => {
    latest.current = { goal, onFull };
  });

  // A fill that has reached full and not said so yet. Landing early still says
  // so, because the bar is then full; never after the bar has gone.
  const owed = useRef(false);
  // On screen. Set in the body as well as cleared in the cleanup, so a
  // StrictMode rehearsal or a Fast Refresh does not leave it cleared for good.
  const alive = useRef(true);
  // The next-tick answer under reduced motion, one at a time: a newer one
  // replaces it. Cleared when the bar goes, not when the fill changes: reduced
  // motion turned off within the tick, with no new fill, starts no spring, so
  // this answer is the only thing that says the bar filled.
  const answer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (answer.current !== null) clearTimeout(answer.current);
      answer.current = null;
    };
  }, []);
  const settle = useCallback(() => {
    if (!owed.current) return;
    owed.current = false;
    if (alive.current) latest.current.onFull?.();
  }, []);

  // Every value at its final frame.
  const still = useCallback(() => {
    cancel(fill);
    cancel(spark);
    cancel(stretch);
    fill.value = latest.current.goal;
    spark.value = 0;
    stretch.value = 1;
  }, [fill, spark, stretch]);

  const land = useCallback(() => {
    still();
    settle();
  }, [still, settle]);

  useEffect(() => {
    if (reduced === null) return;
    const before = target.current ?? fraction(from);
    const changed = target.current !== goal;
    target.current = goal;
    // Owed when this change fills it; a change back below full takes it back.
    if (changed) owed.current = goal >= 1 && (before < 1 || owed.current);
    if (reduced) {
      still();
      // The next tick, so a caller never hears it during its own render.
      if (answer.current !== null) clearTimeout(answer.current);
      answer.current = setTimeout(settle, 0);
      return;
    }
    if (!changed) return;
    fill.value = spring(goal, SPRING.settle, reduced, (finished) => {
      if (!finished || goal < 1) return;
      if (celebrateAtFull) {
        stretch.value = sequence(reduced, timing(LIVING_BAR.fullPop, DUR.micro, EASE.out, reduced), spring(1, SPRING.pop, reduced));
      }
      settle();
    });
    if (goal > before) {
      const half = LIVING_BAR.spark / 2;
      spark.value = 0;
      spark.value = sequence(reduced, timing(1, half, EASE.out, reduced), timing(0, half, EASE.in, reduced));
    }
  }, [reduced, goal, from, celebrateAtFull, fill, spark, stretch, still, settle]);

  useLandOnLeave(land);

  const bar = useAnimatedStyle(() => ({ transform: [{ scaleY: stretch.value }] }));
  const grown = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));
  const edge = useAnimatedStyle(() => ({
    opacity: spark.value,
    transform: [{ translateX: fill.value * width - height / 2 }, { scale: spark.value }],
  }));

  const labelled = accessibilityLabel !== undefined;
  const measure = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  return (
    <Reanimated.View
      {...(labelled ? {} : decorative)}
      accessible={labelled}
      accessibilityRole={labelled ? 'progressbar' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={labelled ? { min: 0, max: 100, now: Math.round(goal * 100) } : undefined}
      onLayout={measure}
      style={[st.track, { height, borderRadius: radius, backgroundColor: track }, style, bar]}
    >
      <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, st.fill, { backgroundColor: color }, grown]}>
        <View style={[st.shine, { height: height * LIVING_BAR.shine, backgroundColor: t.onBrand }]} />
      </Reanimated.View>
      <Reanimated.View
        pointerEvents="none"
        style={[st.spark, { width: height, height, borderRadius: height / 2, backgroundColor: t.onBrand }, edge]}
      />
    </Reanimated.View>
  );
}

const st = StyleSheet.create({
  track: { overflow: 'hidden', justifyContent: 'center' },
  fill: { transformOrigin: 'left' },
  shine: { position: 'absolute', top: 0, left: 0, right: 0, opacity: LIVING_BAR.shineOpacity },
  spark: { position: 'absolute', left: 0 },
});
