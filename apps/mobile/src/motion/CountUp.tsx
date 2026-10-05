/**
 * A real number counting up to itself (come alive section 3).
 *
 * The count runs on the UI thread through motion/drive.ts, over `DUR.count` on
 * the out curve. Each time the rounded number changes, the JS thread redraws
 * the text, at most about 30 times a second (`COUNT_FRAME_MS`); the final
 * value is always drawn. Ticks come from `countTicks.ts`: by touch at most 12,
 * 70 ms apart; by sound at most 10, 90 ms apart; never on the final value.
 *
 * A screen reader hears only the final value, once: the container carries the
 * label and the moving digits inside it are hidden, as `recap/OnceCount.tsx`
 * does. The digits are tabular, and an invisible copy of the widest value
 * holds the width, so nothing beside the number shuffles as it counts (Outfit's
 * tabular figures are unverified, and the held width covers that).
 *
 * Reduced motion: the final value at once and no ticks, watched live. The
 * number must be a real stored one (KEEP: no invented numbers).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useReduceMotion } from '../motion.ts';
import { decorative } from '../theme.ts';
import { createCountTicks, type TickKind } from './countTicks.ts';
import { cancel, timing } from './drive.ts';
import { tick as tickUnderFinger } from './haptics.ts';
import { useAnswered, useLandOnLeave } from './landing.ts';
import { COUNT_FRAME_MS, DUR, EASE } from './tokens.ts';

export function CountUp({
  from = 0,
  to,
  format = String,
  duration = DUR.count,
  tick = 'none',
  onSoundTick,
  label,
  textStyle,
  style,
}: {
  /** Where the count starts. A real earlier value, or 0. */
  from?: number;
  /** The real value it lands on. Whole numbers. */
  to: number;
  /** How a value is written. Defaults to the plain number. */
  format?: (value: number) => string;
  duration?: number;
  /** Which ticks the count makes on the way. None by default. */
  tick?: TickKind;
  /** Plays the count-tick sound, for a count that ticks by sound. */
  onSoundTick?: () => void;
  /** What a screen reader hears. Defaults to the final value as written. */
  label?: string;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useAnswered(useReduceMotion(true));
  const value = useSharedValue(from);
  const [shown, setShown] = useState(from);
  // The target of the run in progress, or of the last one: a count is never replayed to where it already is.
  const target = useRef<number | null>(null);
  const ticks = useRef(createCountTicks(to, 'none'));
  const drawnAt = useRef(Number.NEGATIVE_INFINITY);
  const latest = useRef({ to, onSoundTick });
  useEffect(() => {
    latest.current = { to, onSoundTick };
  });

  // One rounded step, carried over from the UI thread: redraw, at most about
  // 30 times a second, and tick when the rules allow. The final value always
  // draws and never ticks.
  const step = useCallback((next: number) => {
    const now = Date.now();
    const final = next === latest.current.to;
    if (!final && now - drawnAt.current < COUNT_FRAME_MS) return;
    drawnAt.current = now;
    setShown(next);
    const fire = ticks.current.step(now, next);
    if (fire.haptic) tickUnderFinger();
    if (fire.sound) latest.current.onSoundTick?.();
  }, []);

  useAnimatedReaction(
    () => Math.round(value.value),
    (now, previous) => {
      if (previous !== null && now !== previous) scheduleOnRN(step, now);
    },
    [step],
  );

  const land = useCallback(() => {
    cancel(value);
    value.value = latest.current.to;
    target.current = latest.current.to;
    setShown(latest.current.to);
  }, [value]);

  useEffect(() => {
    if (reduced === null) return;
    if (reduced) {
      land();
      return;
    }
    if (target.current === to) return;
    target.current = to;
    ticks.current = createCountTicks(to, tick);
    value.value = timing(to, duration, EASE.out, reduced, (finished) => {
      if (finished) setShown(to);
    });
  }, [reduced, to, tick, duration, value, land]);

  useLandOnLeave(land);

  const first = format(from);
  const last = format(to);
  const widest = last.length >= first.length ? last : first;
  return (
    <View accessible accessibilityLabel={label ?? last} style={style}>
      <View {...decorative}>
        <Text style={[textStyle, st.digits, st.held]}>{widest}</Text>
        <Text style={[textStyle, st.digits, StyleSheet.absoluteFill]}>{format(shown)}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  digits: { fontVariant: ['tabular-nums'] },
  // The widest value, drawn and never seen, so the count keeps one width from start to end.
  held: { opacity: 0 },
});
