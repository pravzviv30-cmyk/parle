import { useCallback, useEffect, useRef, useState } from 'react';
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
import { recorderUri } from '../daily/recorderUri.ts';
import * as tutorVoice from '../speech/tutorVoice.ts';
import { headSound } from './headSound.ts';
import { MIC_DENIED, SELF_GUIDED, nextSoundCheckReference, soundCheckDecision, type SoundCheckDecision } from './model.ts';
import { loadSoundChecks, recordSoundCheck } from './store.ts';
import { trackProductEvent } from '../analytics/track.ts';
import { PHONE_SETTINGS_AVAILABLE, openPhoneSettings } from '../settings/phoneSettings.ts';
import { activeUserId, scopeGeneration } from '../storage/scope.ts';
import { abandonSoundCheckRecording } from './abandonRecording.ts';

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
  const preparedUri = useRef<string | null>(recorderUri(recorder, null));
  const cleanupRef = useRef<Promise<void> | null>(null);
  const stopping = useRef<Promise<void> | null>(null);
  const stopRecorder = useCallback((): Promise<void> => {
    if (stopping.current) return stopping.current;
    const work = (async () => { await recorder.stop(); })().finally(() => { if (stopping.current === work) stopping.current = null; });
    stopping.current = work;
    return work;
  }, [recorder]);
  const mission = missionId === null ? undefined : getMission(missionId);
  const [reference, setReference] = useState<string | null>(null);
  // How the learner's own last measured sound is made, drawn above the line.
  // Null on a first check, on a run of self-guided attempts, and whenever the
  // symbol on the record is not one this build knows: the panel is absent
  // rather than a frame with a gap in it. See `headSound.ts`.
  const [acoustic, setAcoustic] = useState<Acoustic | null>(null);
  const [phase, setPhase] = useState<'loading' | 'unread' | 'ready' | 'recording' | 'scoring' | 'result'>(
    'loading',
  );
  const [result, setResult] = useState<SoundCheckDecision | null>(null);
  const [readOwner, setReadOwner] = useState<{ scope: number; userId: string; missionId: string | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const ownsReadNow = useCallback(() => readOwner !== null && readOwner.scope === scopeGeneration() &&
    readOwner.userId === userId && readOwner.userId === activeUserId() && readOwner.missionId === missionId,
  [readOwner, userId, missionId]);
  const ownerMatches = ownsReadNow();
  const shownPhase = ownerMatches ? phase : 'loading';
  const shownReference = ownerMatches ? reference : null;
  const shownAcoustic = ownerMatches ? acoustic : null;
  const shownResult = ownerMatches ? result : null;

  useEffect(() => {
    let cancelled = false;
    const owner = { scope: scopeGeneration(), userId, missionId };
    const sameAccount = () => !cancelled && owner.scope === scopeGeneration() && owner.userId === activeUserId();
    setReadOwner(owner);
    setReference(null);
    setAcoustic(null);
    setResult(null);
    setPhase('loading');
    void Promise.resolve().then(() => loadSoundChecks({ strict: true })).then(
      (evidence) => {
        if (!sameAccount()) return;
        setReference(mission ? nextSoundCheckReference(mission, evidence) : null);
        setAcoustic(acousticFor(headSound(evidence)));
        setPhase('ready');
      },
      () => {
        if (!sameAccount()) return;
        // The first authored line can still be heard and said locally. It is
        // not a claim that this learner has no earlier measured checks.
        setReference(mission?.referencePhrases[0] ?? null);
        setPhase('unread');
      },
    );
    return () => {
      cancelled = true;
      tutorVoice.stop();
      const abandoned = recorderUri(recorder, preparedUri.current);
      preparedUri.current = null;
      const work = abandonSoundCheckRecording(
        recorder, stopRecorder, abandoned, discardRecording,
        () => setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }),
      ).finally(() => { if (cleanupRef.current === work) cleanupRef.current = null; });
      cleanupRef.current = work;
    };
  }, [mission, missionId, userId, attempt, recorder, stopRecorder]);

  const persist = useCallback(
    (decision: SoundCheckDecision) => {
      if (!mission || !reference || !ownsReadNow()) return;
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
    [mission, reference, ownsReadNow],
  );

  const selfGuided = useCallback(
    (decision: SoundCheckDecision = SELF_GUIDED) => {
      if (!ownsReadNow() || (phase !== 'ready' && phase !== 'recording')) return;
      setResult(decision);
      setPhase('result');
      persist(decision);
    },
    [persist, ownsReadNow, phase],
  );

  const toggle = useCallback(async () => {
    if (!reference || !ownsReadNow() || phase === 'scoring' || phase === 'loading' || phase === 'unread') return;
    if (phase === 'recording') {
      let lost = false;
      try {
        await stopRecorder();
      } catch {
        // It was still spoken; only assessment goes without.
        lost = true;
      }
      // Where it was written, asked for on its own. A stop that threw can still
      // have left bytes on disk, and the path is the only way to reach them.
      const uri = recorderUri(recorder, preparedUri.current);
      preparedUri.current = null;
      void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
      if (!ownsReadNow()) { discardRecording(uri); return; }
      if (lost || !uri) {
        // Nothing here can be assessed, so nothing here should be kept either.
        discardRecording(uri);
        return selfGuided();
      }
      setPhase('scoring');
      const score = await consumeRecording(uri, (recorded) => scoreRecordedAttempt(userId, recorded, reference));
      if (!ownsReadNow()) return;
      const decision = soundCheckDecision(score?.observations.length ?? 0, score?.report ?? null);
      setResult(decision);
      setPhase('result');
      persist(decision);
      return;
    }

    try {
      if (cleanupRef.current) await cleanupRef.current;
      if (!ownsReadNow()) return;
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!ownsReadNow()) return;
      // Refused access is explained, not silently turned into practice.
      if (!permission.granted) return selfGuided(MIC_DENIED);
      tutorVoice.stop();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      if (!ownsReadNow()) return;
      preparedUri.current = recorderUri(recorder, preparedUri.current);
      await recorder.prepareToRecordAsync();
      preparedUri.current = recorderUri(recorder, preparedUri.current);
      if (!ownsReadNow()) {
        await abandonSoundCheckRecording(recorder, stopRecorder, preparedUri.current, discardRecording,
          () => setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }));
        preparedUri.current = null;
        return;
      }
      recorder.record();
      setPhase('recording');
    } catch {
      selfGuided();
    }
  }, [reference, phase, recorder, stopRecorder, selfGuided, userId, persist, ownsReadNow]);

  // No back header on the "no check" card: it is a terminal card and Done is the
  // one door. Everywhere else the chevron is the way out, so the "Not now" pill
  // that used to sit at the bottom is gone.
  const noCheck = !mission || (shownPhase === 'ready' && shownReference === null);

  return (
    <ScrollScreen
      header={!noCheck && shownPhase !== 'result' ? <ScreenHeader back={{ onPress: onDone }} /> : undefined}
      footer={noCheck || shownPhase === 'result' ? <PillButton label="Done" onPress={onDone} /> : null}
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
          {shownAcoustic !== null && shownPhase !== 'result' && (
            <View style={st.acoustic}>
              <AcousticCard acoustic={shownAcoustic} />
            </View>
          )}

          {shownReference && (
            <Card tone="journal" style={{ marginTop: space(6), alignItems: 'center', paddingVertical: space(6) }}>
              <Text style={[fitDisplay(shownReference), { color: paper.ink, textAlign: 'center' }]}>{shownReference}</Text>
              <Pressable
                onPress={() => { if (ownsReadNow()) tutorVoice.speak(shownReference); }}
                accessibilityRole="button"
                accessibilityLabel="Hear the reference line"
                style={({ pressed }) => [st.hear, pressed && { opacity: 0.6 }]}
              >
                <EarGlyph size={16} color={paper.inkSoft} />
                <Text style={[type.small, { color: paper.inkSoft }]}>Hear it</Text>
              </Pressable>
            </Card>
          )}

          {shownPhase === 'unread' ? (
            <Card style={{ marginTop: space(5), gap: space(3) }}>
              <Text accessibilityLiveRegion="polite" style={[type.body, { color: paper.ink }]}>{shownReference ? 'Your earlier sound checks could not be read. You can still hear and say this known line; it will not be assessed until the read succeeds.' : 'Your earlier sound checks could not be read. Try again before checking a sound.'}</Text>
              <GhostButton label="Retry sound checks" onPress={() => { if (ownsReadNow()) setAttempt((n) => n + 1); }} />
            </Card>
          ) : shownPhase === 'loading' ? (
            <Text accessibilityLiveRegion="polite" style={[type.body, { color: paper.inkSoft, marginTop: space(5) }]}>Reading your sound checks…</Text>
          ) : shownPhase === 'result' && shownResult ? (
            <Card style={{ marginTop: space(5) }}>
              <Text style={[type.title, { color: paper.ink }]}>{shownResult.headline}</Text>
              <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{shownResult.detail}</Text>
              {shownResult === MIC_DENIED && PHONE_SETTINGS_AVAILABLE && (
                <View style={{ marginTop: space(3) }}>
                  <GhostButton label="Open settings" onPress={() => void openPhoneSettings()} />
                </View>
              )}
            </Card>
          ) : (
            <View style={st.micBlock}>
              <SpeakCircle
                onPress={() => void toggle()}
                active={shownPhase === 'recording'}
                muted={!CAN_RECORD}
                disabled={shownPhase === 'scoring'}
                accessibilityLabel={shownPhase === 'recording' ? 'Finish recording' : 'Start recording'}
              />
              <Text style={[type.bodyStrong, { color: paper.ink, textAlign: 'center' }]}>
                {shownPhase === 'recording' ? 'Tap when you are done' : shownPhase === 'scoring' ? 'Checking the sound…' : 'Tap, then say the line'}
              </Text>
              {!CAN_RECORD && <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>Recording is unavailable here. Say it aloud and use the self-guided option.</Text>}
              <GhostButton label="I said it without assessment" disabled={shownPhase === 'scoring'} onPress={() => selfGuided()} />
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
