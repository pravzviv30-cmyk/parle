/** Say it aloud. Moved from DrillScreen with no change. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AudioModule, useAudioRecorder } from 'expo-audio';
import type { RepeatThisExercise } from '@luvani/core';
import { colour, space, type } from '../../theme.ts';
import { useB, useThemedStyles } from '../../main/bTheme.tsx';
import { Card, IconAction, Label, PillButton, SpeakCircle, fitDisplay } from '../../components.tsx';
import { LevelRing } from '../../motion/LevelRing.tsx';
import { useRecorderLevel } from '../../speech/useRecorderLevel.ts';
import { Illustration } from '../../art/flat/Illustration.tsx';
import * as tutorVoice from '../../speech/tutorVoice.ts';
import { holdMic } from '../../sound/audioFocus.ts';
import { discardRecording } from '../../speech/discardRecording.ts';
import { enterRecording, leaveRecording } from '../../sound/audioSession.ts';
import { CAN_RECORD, HearRow, METERED_TAKE, kindTag } from './shared.tsx';
import { SPEAK, makeDs } from './styles.ts';

export function RepeatThisView({
  exercise,
  onAnswer,
  onSpoke,
  onNoMic,
  locked,
  initialMic,
}: {
  exercise: RepeatThisExercise;
  onAnswer: (a: string) => void;
  /** A finished take: its uri, or null when the recorder lost it. Grading either way is the callee's law. */
  onSpoke: (uri: string | null) => void;
  onNoMic: () => void;
  locked: boolean;
  /** Screen preview only: the microphone state to open in. Absent everywhere the app draws it. */
  initialMic?: 'armed' | 'live' | 'silent';
}) {
  const bt = useB();
  const ds = useThemedStyles(makeDs);
  const recorder = useAudioRecorder(METERED_TAKE);
  // 'armed': the circle records on tap. 'live': the microphone is on. 'silent':
  // the platform said no — recorder missing, permission refused, or a start
  // that threw — and the honest self-report control is back in charge, because
  // refusing the microphone must cost the learner nothing.
  const [mic, setMic] = useState<'armed' | 'live' | 'silent'>(initialMic ?? (CAN_RECORD ? 'armed' : 'silent'));
  // The ring around the live circle, from the recorder's real level; none is
  // drawn until a level has been heard.
  const voice = useRecorderLevel(recorder, mic === 'live');
  // The recorder's async edges must run one at a time; a double-tap cannot be
  // allowed to race prepare against stop.
  const busyRef = useRef(false);
  // The microphone focus, held from before the mode change until the take
  // ends, fails or the view goes, so no haptic or sound effect lands on it (F724).
  const micHold = useRef<(() => void) | null>(null);
  const letGoOfMic = useCallback(() => {
    const release = micHold.current;
    micHold.current = null;
    if (!release) return false;
    release();
    return true;
  }, []);
  useEffect(() => () => {
    if (letGoOfMic()) void leaveRecording().catch(() => undefined);
  }, [letGoOfMic]);

  const toggleRecord = useCallback(async () => {
    if (busyRef.current || locked) return;
    busyRef.current = true;
    try {
      if (mic === 'live') {
        let lost = false;
        try {
          await recorder.stop();
        } catch {
          // A take the recorder lost was still spoken; only scoring goes without.
          lost = true;
        }
        // Where it was written, asked for on its own. A stop that threw can
        // still have left bytes on disk, and reading the path is the only way
        // to reach them; if even that fails there is nothing to name.
        let uri: string | null = null;
        try {
          uri = recorder.uri;
        } catch {
          uri = null;
        }
        if (lost) {
          // Unscorable, so it travels no further, and unscorable is exactly
          // when a file would otherwise be left behind for good.
          discardRecording(uri);
          uri = null;
        }
        // Hand the audio session back to playback, so Hear it keeps its volume.
        letGoOfMic();
        void leaveRecording().catch(() => undefined);
        setMic('armed');
        onSpoke(uri);
      } else {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) {
          setMic('silent');
          return;
        }
        tutorVoice.stop(); // the reference playing into the microphone scores nobody
        letGoOfMic();
        micHold.current = holdMic();
        await enterRecording();
        await recorder.prepareToRecordAsync();
        recorder.record();
        setMic('live');
      }
    } catch {
      setMic('silent');
      if (letGoOfMic()) void leaveRecording().catch(() => undefined);
    } finally {
      busyRef.current = false;
    }
  }, [mic, locked, recorder, onSpoke, letGoOfMic]);

  return (
    <View style={{ gap: space(4) }}>
      <Card style={ds.exCard}>
        <Label>{kindTag(exercise)}</Label>
        <Text style={[fitDisplay(exercise.reference), { color: bt.text, textAlign: 'center', marginTop: space(4) }]}>
          {exercise.reference}
        </Text>
        <Text style={[type.small, { color: bt.muted, textAlign: 'center', marginTop: space(2.5) }]}>
          {exercise.referenceEn}
        </Text>
        {exercise.ipa !== null && (
          <Text style={[type.notation, { color: bt.muted, textAlign: 'center', marginTop: space(2) }]}>
            /{exercise.ipa}/
          </Text>
        )}
        <HearRow text={exercise.reference} />
      </Card>

      <View style={{ alignItems: 'center', gap: space(3) }}>
        {mic === 'silent' ? (
          <>
            {/* The speak circle in its muted state: nothing records here, and
                the red fill must keep meaning "the microphone is on". */}
            <View style={ds.speakBlock}>
              <Illustration name="state-microphone" fit="small" />
              <Text style={[type.label, { color: bt.text }]}>Speak</Text>
            </View>

            {/* Without a microphone the learner's word is the grade. Saying so
                out loud in the control's own copy keeps the report honest. */}
            <View style={ds.saidIt}>
              <PillButton label="Type instead" onPress={onNoMic} disabled={locked} />
              <IconAction layout="inline" icon="tick-circle" label="I said it" onPress={() => onAnswer(exercise.reference)} disabled={locked} />
            </View>
          </>
        ) : (
          /* The one speak control made real: hollow at rest, and filled green
             only while the microphone is actually on. Green means you speak,
             here as in ConvoScreen; red belongs to the tutor's own voice and
             never marks the learner's microphone. Tapping Done grades exactly
             as I said it does; the recording only ever adds a line. */
          <View style={ds.speakBlock}>
            <View style={ds.speakCircle}>
              {mic === 'live' && voice.metered && (
                <View style={ds.speakRing}>
                  <LevelRing level={voice.level} size={SPEAK} color={colour.mint} />
                </View>
              )}
              <SpeakCircle
                onPress={() => void toggleRecord()}
                active={mic === 'live'}
                disabled={locked}
                size={SPEAK}
                accessibilityLabel={mic === 'live' ? 'Stop recording' : 'Record yourself saying it'}
              />
            </View>
            <Text style={[type.label, { color: bt.text }]}>{mic === 'live' ? 'Done' : 'Speak'}</Text>
          </View>
        )}

        <Pressable
          onPress={onNoMic}
          disabled={locked}
          accessibilityRole="button"
          accessibilityLabel="I can't speak right now"
          style={({ pressed }) => [ds.noMic, pressed && { opacity: 0.6 }]}
        >
          <Text style={[type.small, { color: bt.muted }]}>Unable to speak right now?</Text>
        </Pressable>
      </View>
    </View>
  );
}
