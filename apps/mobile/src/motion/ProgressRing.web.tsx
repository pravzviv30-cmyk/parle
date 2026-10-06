/**
 * The progress ring on the web (come alive section 3, risk W2).
 *
 * The same ring, the same run (`useRingDraw.ts`, through motion/drive.ts), the
 * same props. The difference is how the dash offset reaches the Svg: an
 * animated Svg prop is the open risk on react-native-web, so here an animated
 * reaction carries the run's value to React state and the circle is redrawn
 * from that, at most about 30 times a second (`COUNT_FRAME_MS`). The final
 * value always draws.
 *
 * Reduced motion: drawn at `to` at once, through the shared run, watched live.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle } from 'react-native-svg';
import { useReduceMotion } from '../motion.ts';
import { colour, decorative, paper } from '../theme.ts';
import { monotonicNow } from './clock.ts';
import { fraction, ringGeometry, type ProgressRingProps } from './ring.ts';
import { useAnswered } from './landing.ts';
import { COUNT_FRAME_MS, DUR } from './tokens.ts';
import { useRingDraw } from './useRingDraw.ts';

export function ProgressRing({
  from = 0,
  to,
  size = 168,
  stroke = 12,
  color = colour.blue,
  track = paper.line,
  duration = DUR.reveal,
  delay = 0,
  onDone,
  accessibilityLabel,
  children,
}: ProgressRingProps) {
  const reduced = useAnswered(useReduceMotion(true));
  const { drawn, goal } = useRingDraw({ reduced, from, to, duration, wait: delay, onDone });
  const [shown, setShown] = useState(fraction(from));
  const paintedAt = useRef(Number.NEGATIVE_INFINITY);
  const latestGoal = useRef(goal);
  useEffect(() => {
    latestGoal.current = goal;
  });

  const paint = useCallback((next: number) => {
    const now = monotonicNow();
    if (next !== latestGoal.current && now - paintedAt.current < COUNT_FRAME_MS) return;
    paintedAt.current = now;
    setShown(next);
  }, []);

  useAnimatedReaction(
    () => drawn.value,
    (now, previous) => {
      if (now !== previous) scheduleOnRN(paint, now);
    },
    [paint],
  );

  const { centre, radius, length } = ringGeometry(size, stroke);
  const labelled = accessibilityLabel !== undefined;
  return (
    <View
      accessible={labelled}
      accessibilityRole={labelled ? 'progressbar' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={labelled ? { min: 0, max: 100, now: Math.round(goal * 100) } : undefined}
      style={[st.box, { width: size, height: size }]}
    >
      <View {...decorative} pointerEvents="none" style={[StyleSheet.absoluteFill, st.turned]}>
        <Svg width={size} height={size} {...decorative}>
          <Circle cx={centre} cy={centre} r={radius} stroke={track} strokeWidth={stroke} fill="none" />
          <Circle
            cx={centre}
            cy={centre}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${length} ${length}`}
            strokeDashoffset={length * (1 - shown)}
            strokeOpacity={shown > 0.001 ? 1 : 0}
            fill="none"
          />
        </Svg>
      </View>
      {children}
    </View>
  );
}

const st = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  // Twelve o'clock: an Svg circle's stroke starts at three.
  turned: { transform: [{ rotate: '-90deg' }] },
});
