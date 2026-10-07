/**
 * The listening orb's ring: the learner's real microphone level, drawn as two
 * rings behind the orb that swell as they speak (come alive, core loop 3.3).
 *
 * The shared `LevelRing` primitive does the drawing: the first ring follows the
 * level at once, the second trails it, transform and opacity only, and under
 * Reduce Motion three opacity steps stand in for the swell, watched live. This
 * file only places it behind the orb, sized so that even at its loudest it
 * stays clear of the word under the orb (`ORB_LEVEL_RING_SHARE`), and in the
 * state's own colour, so the colours the intro teaches are unchanged.
 *
 * `VoiceOrb` draws it only while `orbLayers` says the level is measured and the
 * room is awake (`tutor/orbLayers.ts`); otherwise the orb breathes on today's
 * loop. Decorative and untouchable: the orb's own label says whose turn it is.
 */

import { StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { LevelRing } from '../motion/LevelRing.tsx';
import { decorative } from '../theme.ts';
import { ORB_LEVEL_RING_SHARE } from './orbLayers.ts';

export function OrbLevelRing({ level, size, color }: { level: SharedValue<number>; size: number; color: string }) {
  return (
    <View {...decorative} style={st.layer}>
      <LevelRing level={level} size={Math.round(size * ORB_LEVEL_RING_SHARE)} color={color} />
    </View>
  );
}

const st = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
});
