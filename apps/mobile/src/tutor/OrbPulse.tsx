/**
 * The speaking orb's core, growing a little with the tutor's real voice (come
 * alive, core loop 3.3): `1 + 0.04 * level`, where the level is the tutor's
 * overall loudness as `live/RoomLevels` measures it, read on the UI thread.
 *
 * It wraps the orb's drawing and moves nothing while it is off: then the
 * drawing breathes on today's loop as it always has. `orbLayers` turns it on
 * only while the live bars draw (`tutor/orbLayers.ts`), and the loop rests for
 * that time, so the core never moves two ways at once. Transform only; under
 * Reduce Motion it holds at rest, watched live.
 */

import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Reanimated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { useReduceMotion } from '../motion.ts';
import { ORB_PULSE } from './orbLayers.ts';

export function OrbPulse({ level, on, children }: { level: SharedValue<number> | null; on: boolean; children: ReactNode }) {
  const reduced = useReduceMotion();
  const live = on && !reduced && level !== null;
  const look = useAnimatedStyle(() => {
    if (!live || level === null) return { transform: [{ scale: 1 }] };
    const now = Math.min(1, Math.max(0, level.value));
    return { transform: [{ scale: 1 + ORB_PULSE * now }] };
  }, [live, level]);
  return <Reanimated.View style={[st.pulse, look]}>{children}</Reanimated.View>;
}

const st = StyleSheet.create({
  pulse: { pointerEvents: 'none' },
});
