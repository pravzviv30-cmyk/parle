/**
 * A ring that draws to a real fraction (come alive section 3).
 *
 * An Svg track and, over it, the same circle drawn by its dash offset, which
 * Reanimated animates on the UI thread. The run itself (through
 * motion/drive.ts, on the in-out curve, `onDone` said once) is
 * `useRingDraw.ts`, shared with the web half. The ring starts at twelve o'clock
 * because its layer turns a quarter back; the centre sits over it and does not
 * turn. Only the dash offset and the stroke's opacity move (motion.test.ts,
 * rule 6); the opacity hides the round cap's dot while nothing is drawn yet.
 *
 * The web draws the same ring from state in `ProgressRing.web.tsx`, because an
 * animated Svg prop on react-native-web is the open risk W2 in the spec.
 *
 * Reduced motion: the ring is drawn at `to` at once and `onDone` fires on the
 * next tick, watched live. The fraction must be a real stored one.
 */

import { StyleSheet, View } from 'react-native';
import Reanimated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useReduceMotion } from '../motion.ts';
import { colour, decorative, paper } from '../theme.ts';
import { ringGeometry, type ProgressRingProps } from './ring.ts';
import { useAnswered } from './landing.ts';
import { DUR } from './tokens.ts';
import { useRingDraw } from './useRingDraw.ts';

const DrawnCircle = Reanimated.createAnimatedComponent(Circle);

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
  const { centre, radius, length } = ringGeometry(size, stroke);
  const arc = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - drawn.value),
    strokeOpacity: drawn.value > 0.001 ? 1 : 0,
  }));

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
          <DrawnCircle
            cx={centre}
            cy={centre}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${length} ${length}`}
            fill="none"
            animatedProps={arc}
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
