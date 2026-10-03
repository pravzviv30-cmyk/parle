import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { GhostButton, SpeakCircle } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { finishLocalTake } from '../daily/finishLocalTake.ts';
import { discardRecording } from '../speech/discardRecording.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { RECORDING_READY, RECORDING_LIVE, RECORDING_TYPE } from './ownWordsCopy.ts';

/** A bounded temporary take; the consumer owns deletion after handoff. */
export function SpokenAttempt({ onTake, onTyping, busy }: {
  onTake: (uri: string | null) => void; onTyping: () => void; busy: boolean;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const focused = useIsFocused();
  const [recording, setRecording] = useState(false);
  const active = useRef(focused);
  const live = useRef(false);
  const working = useRef(false);
  const owner = useRef(scopeGeneration());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const current = () => active.current && owner.current === scopeGeneration();
  const resetAudio = () => setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });

  const stop = useCallback(async (handoff = false) => {
    if (working.current || !live.current) return;
    working.current = true;
    live.current = false;
    clearTimeout(timer.current);
    try {
      const uri = await finishLocalTake({ stop: () => recorder.stop(), uri: () => recorder.uri,
        resetAudio, current: () => handoff && current(), discard: discardRecording });
      if (handoff && current()) { setRecording(false); onTake(uri); }
    } catch {
      if (current()) { setRecording(false); onTyping(); }
    } finally { working.current = false; }
  }, [recorder, onTake, onTyping]);

  useEffect(() => {
    active.current = focused && AppState.currentState === 'active';
    if (!focused) { setRecording(false); void stop(); }
    const subscription = AppState.addEventListener('change', state => {
      active.current = focused && state === 'active';
      if (state !== 'active') { setRecording(false); void stop(); }
    });
    return () => { active.current = false; clearTimeout(timer.current); subscription.remove(); void stop(); };
  }, [focused, stop]);

  const toggle = async () => {
    if (busy || working.current || !current()) return;
    if (live.current) return stop(true);
    working.current = true;
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!current()) return;
      if (!permission.granted) return onTyping();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      if (!current()) {
        await finishLocalTake({ stop: () => recorder.stop(), uri: () => recorder.uri, resetAudio,
          current: () => false, discard: discardRecording });
        return;
      }
      recorder.record();
      live.current = true;
      setRecording(true);
      timer.current = setTimeout(() => { void stop(true); }, 20_000);
    } catch {
      await recorder.stop().catch(() => {});
      discardRecording(recorder.uri);
      await resetAudio().catch(() => {});
      if (current()) onTyping();
    } finally { working.current = false; if (!current()) void stop(); }
  };

  return <View style={{ alignItems: 'center', gap: space(3) }}>
    <SpeakCircle active={recording} disabled={busy} onPress={() => { void toggle(); }} accessibilityLabel={recording ? 'Stop recording' : 'Record your French'} />
    <Text style={[type.small, { color: paper.inkSoft }]}>{recording ? RECORDING_LIVE : RECORDING_READY}</Text>
    <GhostButton label={RECORDING_TYPE} disabled={busy} onPress={() => { void stop(false).then(onTyping); }} />
  </View>;
}
