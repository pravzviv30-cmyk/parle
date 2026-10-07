/**
 * The microphone meter on the first run's spoken reply (come alive, README
 * Part 5.C row 7): five bars that stand with the real level of the take that
 * is recording, and a thin ring round them that fills over the take's real
 * twenty-second cap. The level comes from expo-audio's metering through
 * `GuestRecording.tsx`; every number here is read from the recorder, nothing
 * moves on a timer of its own, and a quiet microphone is a still meter.
 *
 * The bars move by `scaleY` alone through motion/drive.ts. The ring is drawn
 * from the elapsed seconds the recorder reports, not animated. Decorative: the
 * microphone button beside it says what is happening.
 *
 * Reduced motion: no bars and no ring; the meter becomes words, "Hearing you"
 * or "Waiting for your voice", and the take's length against its cap, watched
 * live. No sound and no haptic while it shows: the microphone holds focus.
 */

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useReduceMotion } from '../../motion.ts';
import { cancel, timing } from '../../motion/drive.ts';
import { DUR, EASE } from '../../motion/tokens.ts';
import { colour, decorative, paper, radius, space, STROKE, type } from '../../theme.ts';
import { FIRST_RUN_COPY, TAKE_CAP_SECONDS, takeLength } from './copy.ts';
import { barScales, hearsVoice } from './micLevel.ts';

/** The ring's box and the meter inside it. */
const RING = 120;
const BAR_TALL = 44;
const BAR_WIDE = 6;

function Bar({ scale }: { scale: SharedValue<number> }) {
  const look = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));
  return <Reanimated.View style={[st.bar, look]} />;
}

export function MicMeter({ level, seconds }: { level: number; seconds: number }) {
  const reduced = useReduceMotion();
  const a = useSharedValue(0.25);
  const b = useSharedValue(0.25);
  const c = useSharedValue(0.25);
  const d = useSharedValue(0.25);
  const e = useSharedValue(0.25);
  useEffect(() => {
    const bars = [a, b, c, d, e];
    const scales = barScales(level);
    bars.forEach((bar, i) => {
      cancel(bar);
      bar.value = reduced ? scales[i]! : timing(scales[i]!, DUR.micro, EASE.linear, reduced);
    });
  }, [level, reduced, a, b, c, d, e]);
  useEffect(() => () => [a, b, c, d, e].forEach(cancel), [a, b, c, d, e]);

  if (reduced) {
    return (
      <View style={st.words}>
        <Text style={[type.bodyStrong, { color: paper.ink }]}>
          {hearsVoice(level) ? FIRST_RUN_COPY.hearingYou : FIRST_RUN_COPY.waitingForVoice}
        </Text>
        <Text style={[type.small, { color: paper.inkSoft }]}>{takeLength(seconds)}</Text>
      </View>
    );
  }
  const r = (RING - STROKE * 2) / 2;
  const length = 2 * Math.PI * r;
  const share = Math.min(1, Math.max(0, seconds / TAKE_CAP_SECONDS));
  return (
    <View {...decorative} pointerEvents="none" style={st.box}>
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill} {...decorative}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} fill="none" stroke={paper.skeleton} strokeWidth={STROKE} />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          fill="none"
          stroke={colour.mint}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${length} ${length}`}
          strokeDashoffset={length * (1 - share)}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <View style={st.bars}>
        {[a, b, c, d, e].map((scale, i) => (
          <Bar key={i} scale={scale} />
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  box: { height: RING, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  bars: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), height: BAR_TALL },
  bar: { height: BAR_TALL, minWidth: BAR_WIDE, borderRadius: radius.pill, backgroundColor: colour.mint },
  words: { alignItems: 'center', gap: space(1) },
});
