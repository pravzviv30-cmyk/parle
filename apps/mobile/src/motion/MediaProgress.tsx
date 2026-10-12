import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import type { TutorVoiceKey } from '@luvani/core';
import type { TutorPreviewProgressSource } from '../tutor/tutorPreview.ts';
import { decorative, space } from '../theme.ts';
import { useReduceMotion } from '../motion.ts';
import { cancel, timing } from './drive.ts';
import { EASE } from './tokens.ts';
import { createMediaProgressUpdates } from './mediaProgress.ts';

/** Only this leaf receives media ticks; transform animation stays on the UI thread. */
export function MediaProgress({ voice, colour: ink, source, fallback = 0 }: {
  voice: TutorVoiceKey;
  colour: string;
  source?: TutorPreviewProgressSource;
  fallback?: number;
}) {
  const reduced = useReduceMotion(true);
  const progress = useSharedValue(0);
  useEffect(() => {
    const nextUpdate = createMediaProgressUpdates();
    const update = () => {
      const state = source?.getSnapshot();
      const actual = state ? state.voice === voice ? state.progress : 0 : fallback;
      const target = Number.isFinite(actual) ? Math.max(0, Math.min(1, actual)) : 0;
      const moving = reduced === false && state?.voice === voice && state.phase === 'playing';
      const action = nextUpdate(target, moving);
      if (action === 'none') return;
      // Interpolate only toward an observed media position. Never run a fake
      // timer toward the clip's duration, which would move during buffering.
      if (action === 'snap') {
        cancel(progress);
        progress.value = target;
      } else progress.value = timing(target, 100, EASE.linear, false);
    };
    update();
    const unsubscribe = source?.subscribe(update);
    return () => { unsubscribe?.(); cancel(progress); };
  }, [source, voice, fallback, progress, reduced]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));
  return <View {...decorative} style={st.playbackTrack}>
    <Reanimated.View style={[st.playbackFill, { backgroundColor: ink }, fill]} />
  </View>;
}

const st = StyleSheet.create({
  playbackTrack: { height: 2, marginTop: space(0.5), backgroundColor: 'transparent' },
  playbackFill: { height: 2, width: '100%', transformOrigin: 'left center' },
});
