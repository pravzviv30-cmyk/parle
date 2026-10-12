import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { clearPreloadedSource, createAudioPlayer, preload } from 'expo-audio';
import { Asset } from 'expo-asset';
import type { TutorVoiceKey } from '@luvani/core';
import { enterVoicePlayback } from '../sound/audioSession.ts';
import { useVoiceHold } from '../sound/useVoiceHold.ts';
import { VOICE_SAMPLES, voiceSample } from './voiceSamples.ts';
import { createTutorPreview, type TutorPreviewProgressSource, type TutorPreviewState } from './tutorPreview.ts';
import { createPreviewPreloader } from './previewPreload.ts';

// Six short bundled clips, shared between the two chooser entry points. Expo
// consumes a cached AVPlayerItem on iOS; other platforms clear it explicitly.
const samples = createPreviewPreloader(Object.keys(VOICE_SAMPLES) as TutorVoiceKey[], {
  preload: async voice => {
    // Debug builds can resolve require() to Metro over Wi-Fi. Populate Expo's
    // local asset cache first; replace() then resolves the same local URI.
    // A failed optional warmup leaves normal tap-to-load retry available.
    if (Platform.OS !== 'web') await Asset.fromModule(voiceSample(voice)).downloadAsync();
    await preload(voiceSample(voice));
  },
  clear: voice => clearPreloadedSource(voiceSample(voice)),
});

export interface TutorPreview extends TutorPreviewState {
  toggle: (voice: TutorVoiceKey) => void;
  stop: () => void;
  progressSource: TutorPreviewProgressSource;
}

/**
 * Playback only: no microphone permissions, voice generation or selection writes.
 * Native players are manually owned because each source needs its own status
 * subscription. The controller stops/releases before replacement and this hook
 * releases on every exit, without competing with useAudioPlayer's cleanup.
 */
export function useTutorPreview({ active }: { active: boolean }): TutorPreview {
  const enabled = useRef(active);
  const releaseWarm = useRef<(() => void) | null>(null);
  const previousVoice = useRef<TutorVoiceKey | null>(null);
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
  const state = useSyncExternalStore(controller.subscribeControls, controller.getControlSnapshot, controller.getControlSnapshot);
  useVoiceHold(state.phase === 'playing' || state.phase === 'loading');

  const releaseSamples = useCallback(() => { releaseWarm.current?.(); releaseWarm.current = null; }, []);
  const warmSamples = useCallback(() => {
    const visible = Platform.OS !== 'web' || typeof document === 'undefined' || document.visibilityState === 'visible';
    if (enabled.current && visible && !releaseWarm.current) releaseWarm.current = samples.retain();
  }, []);

  useEffect(() => {
    if (!active) controller.stop();
    if (active && (AppState.currentState === 'active' || AppState.currentState == null)) warmSamples();
    else { if (active) controller.stop(); releaseSamples(); }
  }, [active, controller, releaseSamples, warmSamples]);

  useEffect(() => {
    const previous = previousVoice.current;
    previousVoice.current = state.voice;
    if (previous && previous !== state.voice) samples.refresh(previous);
    if (state.voice && (state.phase === 'ended' || state.phase === 'error')) samples.refresh(state.voice);
  }, [state.voice, state.phase]);

  useEffect(() => {
    const changes = AppState.addEventListener('change', (next) => {
      if (next !== 'active') { controller.stop(); releaseSamples(); }
      else warmSamples();
    });
    // Opening Android's notification shade does not change AppState.
    const blur = Platform.OS === 'android' ? AppState.addEventListener('blur', () => { controller.stop(); releaseSamples(); }) : null;
    const focus = Platform.OS === 'android' ? AppState.addEventListener('focus', warmSamples) : null;
    const hidden = () => {
      if (document.visibilityState !== 'visible') { controller.stop(); releaseSamples(); }
      else warmSamples();
    };
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', hidden);
    return () => {
      changes.remove();
      blur?.remove();
      focus?.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', hidden);
      controller.stop();
      releaseSamples();
    };
  }, [controller, releaseSamples, warmSamples]);

  const toggle = useCallback((voice: TutorVoiceKey) => {
    if (enabled.current && (AppState.currentState === 'active' || AppState.currentState == null || Platform.OS === 'web')) controller.toggle(voice);
  }, [controller]);
  return { ...state, toggle, stop: controller.stop, progressSource: controller };
}
