/**
 * The thinking orb's arc: a segment of the outer ring, in the state's own sun,
 * going round once every 1.2 seconds while the tutor is really thinking (come
 * alive, core loop 3.3 and 3.4).
 *
 * Honest by construction: it is drawn only in the thinking state, which
 * `live/thinking.ts` sets at the learner's final transcript and clears at the
 * answer, with no minimum and no pretend progress. It goes round, on the linear
 * curve through motion/drive.ts, only while `active`: `orbLayers` turns that off
 * when the room is not in front of the learner, the app is in the background,
 * the caller pauses the orb, or movement is reduced, and the arc then holds
 * still at twelve o'clock (`tutor/orbLayers.ts`). The drawing is a still Svg
 * circle on the orb's 120 box; only its layer turns. Decorative.
 */

import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useReduceMotion } from '../motion.ts';
import { cancel, repeat, timing } from '../motion/drive.ts';
import { EASE } from '../motion/tokens.ts';
import { decorative, STROKE } from '../theme.ts';
import { ORB_ARC } from './orbLayers.ts';
import { ORB_BOX } from './OrbGlyph.tsx';

const CENTRE = ORB_BOX / 2;
/** The outer ring's radius on the orb's box, as `OrbGlyph` draws it. */
const RADIUS = 58;
const LENGTH = 2 * Math.PI * RADIUS;

export function OrbThinkingArc({ size, color, active }: { size: number; color: string; active: boolean }) {
  const reduced = useReduceMotion();
  const turn = useSharedValue(0);
  const going = active && !reduced;

  useEffect(() => {
    cancel(turn);
    turn.value = 0;
    if (!going) return undefined;
    turn.value = repeat(timing(1, ORB_ARC.turn, EASE.linear, reduced), -1, false, reduced);
    return () => {
      cancel(turn);
      turn.value = 0;
    };
  }, [going, reduced, turn]);

  // A quarter turn back, so a still arc starts at twelve o'clock as a ring drawing does.
  const look = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360 - 90}deg` }] }));
  const arc = LENGTH * ORB_ARC.share;
  return (
    <Reanimated.View {...decorative} style={[st.layer, look]}>
      <Svg width={size} height={size} viewBox={`0 0 ${ORB_BOX} ${ORB_BOX}`} {...decorative}>
        <Circle
          cx={CENTRE}
          cy={CENTRE}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE * 1.5}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${LENGTH}`}
        />
      </Svg>
    </Reanimated.View>
  );
}

const st = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
});
