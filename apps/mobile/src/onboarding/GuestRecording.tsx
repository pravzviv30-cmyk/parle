import { useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { GhostButton, Press, MicGlyph } from '../components.tsx';
import { recorderUri } from '../daily/recorderUri.ts';
import { silenceRecordingHaptics } from '../motion/hapticPreference.ts';
import { discardRecording } from '../speech/discardRecording.ts';
import { colour, paper, type } from '../theme.ts';
/** Twenty-second take, deleted after consumption. No haptic while the microphone is recording. */
export function GuestRecording({
  onTake,
  onTyping,
  busy,
  onRecordingChange,
}: {
  onTake: (uri: string) => Promise<void>;
  onTyping: () => void;
  busy: boolean;
  onRecordingChange: (recording: boolean) => void;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  // A take can end after expo-audio has released the recorder; this still finds its file.
  const preparedUri = useRef<string | null>(recorderUri(recorder, null));
  const [recording, setRecording] = useState(false);
  const [note, setNote] = useState('');
  const active = useRef(true);
  const working = useRef(false);
  const live = useRef(false);
  const releaseHaptics = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stop = async (send: boolean) => {
    if (!live.current || working.current) return;
    working.current = true;
    live.current = false;
    clearTimeout(timer.current);
    try {
      await recorder.stop();
      releaseHaptics.current?.();
      releaseHaptics.current = null;
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorderUri(recorder, preparedUri.current);
      if (active.current) setRecording(false);
      onRecordingChange(false);
      if (uri && active.current && send) await onTake(uri);
    } catch {
      if (active.current) {
        setRecording(false);
        onRecordingChange(false);
        setNote('That take could not finish. You can type instead.');
      }
    } finally {
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      discardRecording(recorderUri(recorder, preparedUri.current));
      releaseHaptics.current?.();
      releaseHaptics.current = null;
      working.current = false;
    }
  };
  useEffect(() => {
    active.current = true;
    const app = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        active.current = false;
        void stop(false);
      } else active.current = true;
    });
    return () => {
      active.current = false;
      app.remove();
      onRecordingChange(false);
      clearTimeout(timer.current);
      void stop(false);
    };
  }, [recorder]);
  const record = async () => {
    if (busy || working.current || !active.current) return;
    if (live.current) return stop(true);
    working.current = true;
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!active.current) return;
      if (!permission.granted) {
        onTyping();
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
      preparedUri.current = recorderUri(recorder, preparedUri.current);
      await recorder.prepareToRecordAsync();
      preparedUri.current = recorderUri(recorder, preparedUri.current);
      if (!active.current) {
        await recorder.stop().catch(() => {});
        discardRecording(recorderUri(recorder, preparedUri.current));
        await setAudioModeAsync({ allowsRecording: false });
        return;
      }
      releaseHaptics.current = silenceRecordingHaptics();
      recorder.record();
      live.current = true;
      setRecording(true);
      onRecordingChange(true);
      timer.current = setTimeout(() => {
        void stop(true);
      }, 20000);
    } catch {
      if (active.current) {
        setNote('The microphone could not start. You can type instead.');
        onTyping();
      }
      await recorder.stop().catch(() => {});
      releaseHaptics.current?.();
      releaseHaptics.current = null;
      discardRecording(recorderUri(recorder, preparedUri.current));
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    } finally {
      working.current = false;
      if (!active.current) void stop(false);
    }
  };
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <Press
        haptic={recording ? 'none' : 'light'}
        disabled={busy}
        onPress={() => void record()}
        accessibilityLabel={recording ? 'Stop and send' : 'Speak'}
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          backgroundColor: recording ? colour.coral : colour.mint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MicGlyph color={recording ? paper.card : paper.ink} />
      </Press>
      <Text style={type.body}>{recording ? 'Listening. Tap to send.' : 'Tap to speak.'}</Text>
      <GhostButton
        label="Type instead"
        disabled={busy}
        onPress={() => {
          void stop(false).then(onTyping);
        }}
      />
      {note ? (
        <Text accessibilityLiveRegion="polite" style={type.small}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}
