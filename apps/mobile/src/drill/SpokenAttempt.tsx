import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { AudioModule, RecordingPresets, useAudioRecorder } from 'expo-audio';
import { GhostButton, SpeakCircle } from '../components.tsx';
import { colour, paper, space, type } from '../theme.ts';
import { finishLocalTake } from '../daily/finishLocalTake.ts';
import { LevelRing } from '../motion/LevelRing.tsx';
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
 * heard. Nothing sounds or vibrates here: the microphone hold keeps both seams
 * still for the whole take.
 */
export function SpokenAttempt({ onTake, onTyping, busy }: {
  onTake: (uri: string | null) => void; onTyping: () => void; busy: boolean;
}) {
  const recorder = useAudioRecorder(METERED_TAKE);
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
      letGoOfMic();
      micHold.current = holdMic();
      await enterRecording();
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
    <View style={st.circle}>
      {recording && voice.metered && <View style={st.ring}><LevelRing level={voice.level} size={SPEAK} color={colour.mint} /></View>}
      <SpeakCircle active={recording} disabled={busy} size={SPEAK} onPress={() => { void toggle(); }} accessibilityLabel={recording ? 'Stop recording' : 'Record your French'} />
    </View>
    <Text style={[type.small, { color: paper.inkSoft }]}>{recording ? RECORDING_LIVE : RECORDING_READY}</Text>
    <GhostButton label={RECORDING_TYPE} disabled={busy} onPress={() => { void stop(false).then(onTyping); }} />
  </View>;
}

const st = StyleSheet.create({
  circle: { width: SPEAK, height: SPEAK, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
});
