import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { getMission } from '@luvani/core';

import { Card, EarGlyph, GhostButton, Label, PillButton, SpeakCircle, fitDisplay } from '../components.tsx';
import { AcousticCard } from '../myfrench/AcousticCard.tsx';
import { acousticFor, type Acoustic } from '../myfrench/acoustic.ts';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { HIT, paper, space, type } from '../theme.ts';
import { scoreRecordedAttempt } from '../speech/scoreAttempt.ts';
import { consumeRecording, discardRecording } from '../speech/discardRecording.ts';
import * as tutorVoice from '../speech/tutorVoice.ts';
import { headSound } from './headSound.ts';
import { MIC_DENIED, SELF_GUIDED, nextSoundCheckReference, soundCheckDecision, type SoundCheckDecision } from './model.ts';
import { loadSoundChecks, recordSoundCheck } from './store.ts';
import { trackProductEvent } from '../analytics/track.ts';
import { PHONE_SETTINGS_AVAILABLE, openPhoneSettings } from '../settings/phoneSettings.ts';

const CAN_RECORD =
  Platform.OS !== 'web' ||
  (typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined');

export function SoundCheckScreen({
  userId,
  missionId,
  onDone,
  onChooseSituation,
}: {
  userId: string;
  /**
   * The situation whose known lines are checked. Null when the screen was
   * opened without one (a reload or a shared address): the check never guesses
   * a scene, it asks the learner to choose one.
   */
  missionId: string | null;
  onDone: () => void;
  /** Opens the situations list, offered when there is no situation to check. */
  onChooseSituation?: () => void;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const mission = missionId === null ? undefined : getMission(missionId);
  const [reference, setReference] = useState<string | null>(null);
  // How the learner's own last measured sound is made, drawn above the line.
  // Null on a first check, on a run of self-guided attempts, and whenever the
  // symbol on the record is not one this build knows: the panel is absent
  // rather than a frame with a gap in it. See `headSound.ts`.
  const [acoustic, setAcoustic] = useState<Acoustic | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'recording' | 'scoring' | 'result'>(
    'loading',
  );
  const [result, setResult] = useState<SoundCheckDecision | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSoundChecks().then((evidence) => {
      if (cancelled) return;
      setReference(mission ? nextSoundCheckReference(mission, evidence) : null);
      setAcoustic(acousticFor(headSound(evidence)));
      setPhase('ready');
    });
    return () => {
      cancelled = true;
      tutorVoice.stop();
      void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
    };
  }, [mission]);

  const persist = useCallback(
    (decision: SoundCheckDecision) => {
      if (!mission || !reference) return;
      void recordSoundCheck({
        missionId: mission.id,
        reference,
        at: Date.now(),
        kind: decision.kind,
        focus: decision.focus,
        phoneme: decision.phoneme,
      });
      void trackProductEvent({
        name: 'sound_check_completed',
        properties: { missionId: mission.id, kind: decision.kind },
      });
    },
    [mission, reference],
  );

  const selfGuided = useCallback(
    (decision: SoundCheckDecision = SELF_GUIDED) => {
      setResult(decision);
      setPhase('result');
      persist(decision);
    },
    [persist],
  );

  const toggle = useCallback(async () => {
    if (!reference || phase === 'scoring' || phase === 'loading') return;
    if (phase === 'recording') {
      let lost = false;
      try {
        await recorder.stop();
      } catch {
        // It was still spoken; only assessment goes without.
        lost = true;
      }
      // Where it was written, asked for on its own. A stop that threw can still
      // have left bytes on disk, and the path is the only way to reach them.
      let uri: string | null = null;
      try {
        uri = recorder.uri;
      } catch {
        uri = null;
      }
      void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
      if (lost || !uri) {
        // Nothing here can be assessed, so nothing here should be kept either.
        discardRecording(uri);
        return selfGuided();
      }
      setPhase('scoring');
      const score = await consumeRecording(uri, (recorded) => scoreRecordedAttempt(userId, recorded, reference));
      const decision = soundCheckDecision(score?.observations.length ?? 0, score?.report ?? null);
      setResult(decision);
      setPhase('result');
      persist(decision);
      return;
    }

    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      // Refused access is explained, not silently turned into practice.
      if (!permission.granted) return selfGuided(MIC_DENIED);
      tutorVoice.stop();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
    } catch {
      selfGuided();
    }
  }, [reference, phase, recorder, selfGuided, userId, persist]);

  // No back header on the "no check" card: it is a terminal card and Done is the
  // one door. Everywhere else the chevron is the way out, so the "Not now" pill
  // that used to sit at the bottom is gone.
  const noCheck = !mission || (phase !== 'loading' && reference === null);

  return (
    <ScrollScreen
      header={!noCheck && phase !== 'result' ? <ScreenHeader back={{ onPress: onDone }} /> : undefined}
      footer={noCheck || phase === 'result' ? <PillButton label="Done" onPress={onDone} /> : null}
    >
      {noCheck && missionId === null ? (
        <Card>
          <Text style={[type.title, { color: paper.ink }]}>Choose a situation first.</Text>
          <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>
            A sound check uses the known lines from one situation, so it needs to know which one.
          </Text>
          {onChooseSituation !== undefined && (
            <View style={{ marginTop: space(4) }}>
              <GhostButton label="Choose a situation" onPress={onChooseSituation} />
            </View>
          )}
        </Card>
      ) : noCheck ? (
        <Card>
          <Text style={[type.title, { color: paper.ink }]}>No sound check for this situation yet.</Text>
          <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>The conversation and its practice still count.</Text>
        </Card>
      ) : (
        <>
          <Label>Sound check</Label>
          <Text accessibilityRole="header" style={[type.display, { color: paper.ink, marginTop: space(2) }]}>One useful line, once.</Text>
          <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>This is the part Luvani can assess honestly, because the words are known in advance.</Text>

          {/* How the sound is made, above the line that uses it. It came off My
              French in revamp A: instructions two taps from the doing are a
              leaflet, and this is the screen where the learner does it. */}
          {acoustic !== null && phase !== 'result' && (
            <View style={st.acoustic}>
              <AcousticCard acoustic={acoustic} />
            </View>
          )}

          {reference && (
            <Card tone="journal" style={{ marginTop: space(6), alignItems: 'center', paddingVertical: space(6) }}>
              <Text style={[fitDisplay(reference), { color: paper.ink, textAlign: 'center' }]}>{reference}</Text>
              <Pressable
                onPress={() => tutorVoice.speak(reference)}
                accessibilityRole="button"
                accessibilityLabel="Hear the reference line"
                style={({ pressed }) => [st.hear, pressed && { opacity: 0.6 }]}
              >
                <EarGlyph size={16} color={paper.inkSoft} />
                <Text style={[type.small, { color: paper.inkSoft }]}>Hear it</Text>
              </Pressable>
            </Card>
          )}

          {phase === 'result' && result ? (
            <Card style={{ marginTop: space(5) }}>
              <Text style={[type.title, { color: paper.ink }]}>{result.headline}</Text>
              <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{result.detail}</Text>
              {result === MIC_DENIED && PHONE_SETTINGS_AVAILABLE && (
                <View style={{ marginTop: space(3) }}>
                  <GhostButton label="Open settings" onPress={() => void openPhoneSettings()} />
                </View>
              )}
            </Card>
          ) : (
            <View style={st.micBlock}>
              <SpeakCircle
                onPress={() => void toggle()}
                active={phase === 'recording'}
                muted={!CAN_RECORD}
                disabled={phase === 'loading' || phase === 'scoring'}
                accessibilityLabel={phase === 'recording' ? 'Finish recording' : 'Start recording'}
              />
              <Text style={[type.bodyStrong, { color: paper.ink, textAlign: 'center' }]}>
                {phase === 'recording' ? 'Tap when you are done' : phase === 'scoring' ? 'Checking the sound…' : 'Tap, then say the line'}
              </Text>
              {!CAN_RECORD && <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>Recording is unavailable here. Say it aloud and use the self-guided option.</Text>}
              <GhostButton label="I said it without assessment" onPress={() => selfGuided()} />
            </View>
          )}
        </>
      )}
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  hear: { minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(3) },
  micBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space(3), marginTop: space(7) },
  acoustic: { marginTop: space(6) },
});
