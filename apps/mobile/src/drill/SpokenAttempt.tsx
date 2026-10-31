import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { AudioModule, RecordingPresets, useAudioRecorder } from 'expo-audio';
import { IconAction, GhostButton, SpeakCircle } from '../components.tsx';
import { colour, space, type } from '../theme.ts';
import { useB } from '../main/bTheme.tsx';
import { finishLocalTake } from '../daily/finishLocalTake.ts';
import { recorderUri } from '../daily/recorderUri.ts';
import { SpeakMic } from './SpeakMic.tsx';
import { discardRecording } from '../speech/discardRecording.ts';
import { useRecorderLevel } from '../speech/useRecorderLevel.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { holdMic } from '../sound/audioFocus.ts';
import { enterRecording, leaveRecording } from '../sound/audioSession.ts';
import { RECORDING_READY, RECORDING_LIVE, RECORDING_TYPE } from './ownWordsCopy.ts';

/** The speak circle's size, which the level ring matches. */
const SPEAK = 108;
/** The usual preset, metered, so the ring follows the learner's real voice. */
const METERED_TAKE = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

/**
 * A bounded temporary take; the consumer owns deletion after handoff. While it
 * records, a mint ring swells around the circle from the recorder's real level
 * (`speech/useRecorderLevel.ts`), and none is drawn until a level has been
 * heard, and Cloud listens beside it (`SpeakMic`). Nothing sounds or vibrates here: the microphone hold keeps both seams
 * still for the whole take.
 */
export function SpokenAttempt({ onTake, onTyping, busy }: {
  onTake: (uri: string | null) => void; onTyping: () => void; busy: boolean;
}) {
  const t = useB();
  const recorder = useAudioRecorder(METERED_TAKE);
  const preparedUri = useRef<string | null>(recorderUri(recorder, null));
  const focused = useIsFocused();
  const [recording, setRecording] = useState(false);
  const voice = useRecorderLevel(recorder, recording);
  const active = useRef(focused);
  const live = useRef(false);
  const working = useRef(false);
  const owner = useRef(scopeGeneration());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const current = () => active.current && owner.current === scopeGeneration();
  // The microphone focus, held from before the mode change until the take ends
  // by any route: every route out goes through resetAudio (F724).
  const micHold = useRef<(() => void) | null>(null);
  const letGoOfMic = () => { micHold.current?.(); micHold.current = null; };
  const resetAudio = () => { letGoOfMic(); return leaveRecording(); };

  const stop = useCallback(async (handoff = false) => {
    if (working.current || !live.current) return;
    working.current = true;
    live.current = false;
    clearTimeout(timer.current);
    try {
      const uri = await finishLocalTake({ stop: () => recorder.stop(), uri: () => recorderUri(recorder, preparedUri.current),
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
      letGoOfMic();
      micHold.current = holdMic();
      await enterRecording();
      preparedUri.current = recorderUri(recorder, preparedUri.current);
      await recorder.prepareToRecordAsync();
      preparedUri.current = recorderUri(recorder, preparedUri.current);
      if (!current()) {
        await finishLocalTake({ stop: () => recorder.stop(), uri: () => recorderUri(recorder, preparedUri.current), resetAudio,
          current: () => false, discard: discardRecording });
        return;
      }
      recorder.record();
      live.current = true;
      setRecording(true);
      timer.current = setTimeout(() => { void stop(true); }, 20_000);
    } catch {
      await recorder.stop().catch(() => {});
      discardRecording(recorderUri(recorder, preparedUri.current));
      await resetAudio().catch(() => {});
      if (current()) onTyping();
    } finally { working.current = false; if (!current()) void stop(); }
  };

  return <View style={{ alignItems: 'center', gap: space(3) }}>
    <SpeakMic live={recording} voice={voice} size={SPEAK} ring={colour.mint} cloud>
      <SpeakCircle active={recording} disabled={busy} size={SPEAK} onPress={() => { void toggle(); }} accessibilityLabel={recording ? 'Stop recording' : 'Record your French'} />
    </SpeakMic>
    <Text style={[type.small, { color: t.muted }]}>{recording ? RECORDING_LIVE : RECORDING_READY}</Text>
    <IconAction layout="inline" icon="keyboard" label={RECORDING_TYPE} disabled={busy} onPress={() => { void stop(false).then(onTyping); }} />
  </View>;
}

