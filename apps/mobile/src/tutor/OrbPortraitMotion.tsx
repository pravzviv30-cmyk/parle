/**
 * The two loops of the portrait stage (UI-014, direction D), kept with the
 * orb's layers because only the orb may loop (motion.test.ts rule 4):
 *
 * - `OrbDashedRing`: one dashed sun ring turning once every 2.4 s while the
 *   tutor is really thinking. Still and dashed when not `active` or under
 *   reduced motion.
 * - `OrbBreathe`: the portrait breathing from 1.0 to 1.035 and back while the
 *   tutor speaks. At rest when not `active` or under reduced motion.
 *
 * `active` is the caller's: the room is in front of the learner and the app is
 * in the foreground. Both watch reduced motion live. Decorative.
 */

import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useReduceMotion } from '../motion.ts';
import { cancel, repeat, timing } from '../motion/drive.ts';
import { EASE } from '../motion/tokens.ts';
import { decorative } from '../theme.ts';

/** One turn of the thinking ring, and one half-breath, in ms; the breath's depth. */
export const PORTRAIT_LOOP = { turn: 2400, breath: 550, breathe: 0.035, dash: 3 } as const;

export function OrbDashedRing({ size, color, active }: { size: number; color: string; active: boolean }) {
  const reduced = useReduceMotion();
  const turn = useSharedValue(0);
  const going = active && !reduced;
  useEffect(() => {
    cancel(turn);
    turn.value = 0;
    if (!going) return undefined;
    turn.value = repeat(timing(1, PORTRAIT_LOOP.turn, EASE.linear, reduced), -1, false, reduced);
    return () => { cancel(turn); turn.value = 0; };
  }, [going, reduced, turn]);
  const look = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  return (
    <Reanimated.View {...decorative} style={[st.layer, look]}>
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: PORTRAIT_LOOP.dash, borderStyle: 'dashed', borderColor: color }} />
    </Reanimated.View>
  );
}

export function OrbBreathe({ active, children }: { active: boolean; children: ReactNode }) {
  const reduced = useReduceMotion();
  const at = useSharedValue(0);
  const going = active && !reduced;
  useEffect(() => {
    cancel(at);
    at.value = 0;
    if (!going) return undefined;
    at.value = repeat(timing(1, PORTRAIT_LOOP.breath, EASE.inOut, reduced), -1, true, reduced);
    return () => { cancel(at); at.value = 0; };
  }, [going, reduced, at]);
  const look = useAnimatedStyle(() => ({ transform: [{ scale: 1 + PORTRAIT_LOOP.breathe * at.value }] }));
  return <Reanimated.View style={[st.breathe, look]}>{children}</Reanimated.View>;
}

const st = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  breathe: { pointerEvents: 'none' },
});
