import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { createAudioPlayer } from 'expo-audio';
import type { TutorVoiceKey } from '@luvani/core';
import { enterVoicePlayback } from '../sound/audioSession.ts';
import { useVoiceHold } from '../sound/useVoiceHold.ts';
import { voiceSample } from './voiceSamples.ts';
import { createTutorPreview, type TutorPreviewState } from './tutorPreview.ts';

export interface TutorPreview extends TutorPreviewState {
  toggle: (voice: TutorVoiceKey) => void;
  stop: () => void;
}

/**
 * Playback only: no microphone permissions, voice generation or selection writes.
 * Native players are manually owned because each source needs its own status
 * subscription. The controller stops/releases before replacement and this hook
 * releases on every exit, without competing with useAudioPlayer's cleanup.
 */
export function useTutorPreview({ active }: { active: boolean }): TutorPreview {
  const enabled = useRef(active);
  enabled.current = active;
  const [controller] = useState(() => createTutorPreview({
    web: Platform.OS === 'web',
    ready: enterVoicePlayback,
    createPlayer: (voice) => {
      // Subscribe before loading so even a synchronously resolved bundled asset
      // reports to the record that actually owns it. 100ms tracks media time.
      const player = createAudioPlayer(null, { updateInterval: 100 });
      return {
        load: () => player.replace(voiceSample(voice)),
        play: () => player.play(),
        pause: () => player.pause(),
        release: () => player.release(),
        subscribe: (listener) => {
          const subscription = player.addListener('playbackStatusUpdate', listener);
          return () => subscription.remove();
        },
      };
    },
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useVoiceHold(state.phase === 'playing' || state.phase === 'loading');

  useEffect(() => {
    if (!active) controller.stop();
  }, [active, controller]);

  useEffect(() => {
    const changes = AppState.addEventListener('change', (next) => {
      if (next !== 'active') controller.stop();
    });
    // Opening Android's notification shade does not change AppState.
    const blur = Platform.OS === 'android' ? AppState.addEventListener('blur', controller.stop) : null;
    const hidden = () => { if (document.visibilityState !== 'visible') controller.stop(); };
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', hidden);
    return () => {
      changes.remove();
      blur?.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', hidden);
      controller.stop();
    };
  }, [controller]);

  const toggle = useCallback((voice: TutorVoiceKey) => {
    if (enabled.current && (AppState.currentState === 'active' || AppState.currentState == null || Platform.OS === 'web')) controller.toggle(voice);
  }, [controller]);
  return { ...state, toggle, stop: controller.stop };
}
