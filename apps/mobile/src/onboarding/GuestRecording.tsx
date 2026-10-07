import { useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { AudioModule, RecordingPresets, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { recorderUri } from '../daily/recorderUri.ts';
import { IconAction, Press, MicGlyph } from '../components.tsx';
import { silenceRecordingHaptics } from '../motion/hapticPreference.ts';
import { discardRecording } from '../speech/discardRecording.ts';
import { enterRecording, leaveRecording } from '../sound/audioSession.ts';
import { colour, paper, type } from '../theme.ts';
import { FIRST_RUN_COPY, TAKE_CAP_SECONDS } from './firstRun/copy.ts';
import { meterLevel } from './firstRun/micLevel.ts';
import { MicMeter } from './firstRun/MicMeter.tsx';

/** The take's recorder, with its level reported so the meter shows the real voice (come alive, first run). */
const TAKE_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };
/** How often the meter reads the recorder, in milliseconds. */
const METER_EVERY_MS = 50;

/**
 * Twenty-second take, deleted after consumption. No haptic and no sound effect
 * while the microphone is recording: the microphone holds audio focus. The
 * microphone permission is asked here, on the tap that starts a take, and
 * never before (disclosure.test.ts).
 */
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
  const recorder = useAudioRecorder(TAKE_OPTIONS);
  const preparedUri = useRef<string | null>(recorderUri(recorder, null));
  const take = useAudioRecorderState(recorder, METER_EVERY_MS);
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
      await leaveRecording();
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
      await leaveRecording().catch(() => {});
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
      // The microphone focus is held from here until the take ends, so no
      // sound effect can switch the session away from recording (F724).
      releaseHaptics.current?.();
      releaseHaptics.current = silenceRecordingHaptics();
      await enterRecording();
      preparedUri.current = recorderUri(recorder, preparedUri.current);
      await recorder.prepareToRecordAsync();
      preparedUri.current = recorderUri(recorder, preparedUri.current);
      if (!active.current) {
        await recorder.stop().catch(() => {});
        discardRecording(recorderUri(recorder, preparedUri.current));
        releaseHaptics.current?.();
        releaseHaptics.current = null;
        await leaveRecording();
        return;
      }
      recorder.record();
      live.current = true;
      setRecording(true);
      onRecordingChange(true);
      timer.current = setTimeout(() => {
        void stop(true);
      }, TAKE_CAP_SECONDS * 1000);
    } catch {
      if (active.current) {
        setNote('The microphone could not start. You can type instead.');
        onTyping();
      }
      await recorder.stop().catch(() => {});
      releaseHaptics.current?.();
      releaseHaptics.current = null;
      discardRecording(recorderUri(recorder, preparedUri.current));
      await leaveRecording().catch(() => {});
    } finally {
      working.current = false;
      if (!active.current) void stop(false);
    }
  };
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      {recording ? <MicMeter level={meterLevel(take.metering)} seconds={take.durationMillis / 1000} /> : null}
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
      <Text style={type.body}>{recording ? FIRST_RUN_COPY.listening : FIRST_RUN_COPY.tapToSpeak}</Text>
      <IconAction
        icon="keyboard"
        layout="inline"
        label={FIRST_RUN_COPY.typeInstead}
        disabled={busy}
        haptic={recording ? 'none' : undefined}
        onPress={() => {
          void stop(false).then(onTyping);
        }}
      />
      {note !== '' ? (
        <Text accessibilityLiveRegion="polite" style={type.small}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}
