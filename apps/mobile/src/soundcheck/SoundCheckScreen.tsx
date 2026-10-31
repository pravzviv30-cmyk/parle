import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AudioModule, RecordingPresets, useAudioRecorder } from 'expo-audio';
import { getMission } from '@luvani/core';

import { IconAction, Card, EarGlyph, PillButton, SpeakCircle, fitDisplay } from '../components.tsx';
import { AcousticCard } from '../myfrench/AcousticCard.tsx';
import { acousticFor, type Acoustic } from '../myfrench/acoustic.ts';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { HIT, bType, frenchText, space, type } from '../theme.ts';
import { DrillFrame, DrillPrompt, useFootLayout } from '../drill/DrillFrame.tsx';
import { drillStage } from '../drill/drillStage.ts';
import { SpeakMic } from '../drill/SpeakMic.tsx';
import { Enter } from '../motion/layout.tsx';
import { DUR } from '../motion/tokens.ts';
import { useRecorderLevel } from '../speech/useRecorderLevel.ts';
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
import { holdMic } from '../sound/audioFocus.ts';
import { enterRecording, leaveRecording } from '../sound/audioSession.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';

const CAN_RECORD =
  Platform.OS !== 'web' ||
  (typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined');

/** The usual preset, metered for the level ring; the take itself is unchanged. */
const METERED_TAKE = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

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
  const t = useB();
  const st = useThemedStyles(makeSt);
  // Metered, so the one mic's ring follows the learner's real voice.
  const recorder = useAudioRecorder(METERED_TAKE);
  const preparedUri = useRef<string | null>(recorderUri(recorder, null));
  const cleanupRef = useRef<Promise<void> | null>(null);
  const stopping = useRef<Promise<void> | null>(null);
  const stopRecorder = useCallback((): Promise<void> => {
    if (stopping.current) return stopping.current;
    const work = (async () => { await recorder.stop(); })().finally(() => { if (stopping.current === work) stopping.current = null; });
    stopping.current = work;
    return work;
  }, [recorder]);
  // The microphone focus, held from before the mode change until the take ends
  // by any route, so no haptic or sound effect lands on it (F724).
  const micHold = useRef<(() => void) | null>(null);
  const resetRecordingAudio = useCallback((): Promise<void> => {
    micHold.current?.();
    micHold.current = null;
    return leaveRecording();
  }, []);
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
  const voice = useRecorderLevel(recorder, shownPhase === 'recording');

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
        resetRecordingAudio,
      ).finally(() => { if (cleanupRef.current === work) cleanupRef.current = null; });
      cleanupRef.current = work;
    };
  }, [mission, missionId, userId, attempt, recorder, stopRecorder, resetRecordingAudio]);

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
      void resetRecordingAudio().catch(() => undefined);
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
      micHold.current?.();
      micHold.current = holdMic();
      await enterRecording();
      if (!ownsReadNow()) { await resetRecordingAudio(); return; }
      preparedUri.current = recorderUri(recorder, preparedUri.current);
      await recorder.prepareToRecordAsync();
      preparedUri.current = recorderUri(recorder, preparedUri.current);
      if (!ownsReadNow()) {
        await abandonSoundCheckRecording(recorder, stopRecorder, preparedUri.current, discardRecording,
          resetRecordingAudio);
        preparedUri.current = null;
        return;
      }
      recorder.record();
      setPhase('recording');
    } catch {
      void resetRecordingAudio().catch(() => undefined);
      selfGuided();
    }
  }, [reference, phase, recorder, stopRecorder, selfGuided, userId, persist, ownsReadNow, resetRecordingAudio]);

  // No back header on the "no check" card: it is a terminal card and Done is the
  // one door. Everywhere else the chevron is the way out, so the "Not now" pill
  // that used to sit at the bottom is gone.
  const noCheck = !mission || (shownPhase === 'ready' && shownReference === null);
  // The one Done, on the terminal cards and on the result sheet.
  const done = <PillButton label="Done" onPress={onDone} lip />;

  if (noCheck) {
    return (
      <ScrollScreen footer={done}>
        {missionId === null ? (
          <Card>
            <Text style={[type.title, { color: t.text }]}>Choose a situation first.</Text>
            <Text style={[type.body, { color: t.muted, marginTop: space(2) }]}>
              A sound check uses the known lines from one situation, so it needs to know which one.
            </Text>
            {onChooseSituation !== undefined && (
              <View style={{ marginTop: space(4) }}>
                <IconAction layout="inline" icon="map" label="Choose a situation" onPress={onChooseSituation} />
              </View>
            )}
          </Card>
        ) : (
          <Card>
            <Text style={[type.title, { color: t.text }]}>No sound check for this situation yet.</Text>
            <Text style={[type.body, { color: t.muted, marginTop: space(2) }]}>The conversation and its practice still count.</Text>
          </Card>
        )}
      </ScrollScreen>
    );
  }

  // 2026-10-31 drill B v2 (UI-016; drill-b.md "Sound"): the check stands in the
  // one drill frame on the speak family's peach stage. The stage holds the
  // eyebrow, the title and the honest line about what is assessed; the area
  // holds how the sound is made, the line card with Hear it and the one mic;
  // the result rises as the calm sheet at the foot, with Done.
  const resultSheet = shownPhase === 'result' && shownResult ? (
    <ResultSheet result={shownResult} done={done} />
  ) : null;

  return (
    <DrillFrame
      stage={drillStage('sound-check', t.mode)}
      header={!noCheck && shownPhase !== 'result' ? <ScreenHeader leave={{ onPress: onDone, label: 'Back', close: true }} /> : <View style={{ height: HIT, marginBottom: 18 }} />}
      sheet={resultSheet}
      eyebrow="Sound check"
      prompt={<DrillPrompt header>One useful line, once.</DrillPrompt>}
      stageExtra={<Text style={[type.body, { color: t.muted }]}>This is the part Luvani can assess honestly, because the words are known in advance.</Text>}
    >
      {/* How the sound is made, above the line that uses it. It came off My
          French in revamp A: instructions two taps from the doing are a
          leaflet, and this is the screen where the learner does it. */}
      {shownAcoustic !== null && shownPhase !== 'result' && <AcousticCard acoustic={shownAcoustic} />}

      {shownReference ? (
        <Card tone="journal" style={st.line}>
          <Text {...frenchText} style={[fitDisplay(shownReference), { color: t.text, textAlign: 'center' }]}>{shownReference}</Text>
          <Pressable
            onPress={() => { if (ownsReadNow()) tutorVoice.speak(shownReference); }}
            accessibilityRole="button"
            accessibilityLabel="Hear the reference line"
            style={({ pressed }) => [st.hear, pressed && { opacity: 0.7 }]}
          >
            <EarGlyph size={16} color={t.text} />
            <Text style={[type.label, { color: t.text }]}>Hear it</Text>
          </Pressable>
        </Card>
      ) : null}

      {shownPhase === 'unread' ? (
        <Card style={{ gap: space(3) }}>
          <Text accessibilityLiveRegion="polite" style={[type.body, { color: t.text }]}>{shownReference ? 'Your earlier sound checks could not be read. You can still hear and say this known line; it will not be assessed until the read succeeds.' : 'Your earlier sound checks could not be read. Try again before checking a sound.'}</Text>
          <IconAction layout="inline" icon="refresh" label="Retry sound checks" onPress={() => { if (ownsReadNow()) setAttempt((n) => n + 1); }} />
        </Card>
      ) : shownPhase === 'loading' ? (
        <Text accessibilityLiveRegion="polite" style={[type.body, { color: t.muted }]}>Reading your sound checks…</Text>
      ) : shownPhase === 'result' && shownResult ? null : (
        <View style={st.micBlock}>
          <SpeakMic live={shownPhase === 'recording'} voice={voice} size={SPEAK} ring={t.mint}>
            <SpeakCircle
              onPress={() => void toggle()}
              active={shownPhase === 'recording'}
              muted={!CAN_RECORD}
              disabled={shownPhase === 'scoring'}
              size={SPEAK}
              accessibilityLabel={shownPhase === 'recording' ? 'Finish recording' : 'Start recording'}
            />
          </SpeakMic>
          <Text style={[type.bodyStrong, { color: t.text, textAlign: 'center' }]}>
            {shownPhase === 'recording' ? 'Tap when you are done' : shownPhase === 'scoring' ? 'Checking the sound…' : 'Tap, then say the line'}
          </Text>
          {!CAN_RECORD && <Text style={[type.small, { color: t.muted, textAlign: 'center' }]}>Recording is unavailable here. Say it aloud and use the self-guided option.</Text>}
          <IconAction layout="inline" icon="tick-circle" label="I said it without assessment" disabled={shownPhase === 'scoring'} onPress={() => selfGuided()} />
        </View>
      )}
    </DrillFrame>
  );
}

/**
 * The result, as the drill's calm sheet: the card under a line edge at its
 * top, the headline and its detail, Open settings when the microphone was
 * refused, then Done. No mark, sound or haptic: a sound check is never a pass
 * or a fail. Short by design (a headline and one line), so it never needs
 * the cap and scroll the answer sheet carries.
 */
function ResultSheet({ result, done }: { result: SoundCheckDecision; done: ReactNode }) {
  const t = useB();
  const st = useThemedStyles(makeSt);
  const foot = useFootLayout();
  return (
    <Enter from="down" distance={space(6)} duration={DUR.fast}>
      <View accessibilityLiveRegion="polite" style={[st.sheet, { paddingBottom: 26 + foot.inset }]}>
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={[bType.sheet21, { color: t.text }]}>{result.headline}</Text>
          <Text style={[bType.meta, { color: t.text }]}>{result.detail}</Text>
          {result === MIC_DENIED && PHONE_SETTINGS_AVAILABLE && (
            <View style={{ marginTop: space(1) }}>
              <IconAction layout="inline" icon="settings" label="Open settings" onPress={() => void openPhoneSettings()} />
            </View>
          )}
        </View>
        {done}
      </View>
    </Enter>
  );
}

/** The one mic's size, as on the speak drills. */
const SPEAK = 108;

function makeSt(t: B) {
  return StyleSheet.create({
  line: { alignItems: 'center', paddingVertical: space(5), gap: space(2) },
  // The board's Hear it chip: the stage's peach on the line card.
  hear: { minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(4), borderRadius: HIT / 2, backgroundColor: t.peach },
  micBlock: { alignItems: 'center', gap: space(3), marginTop: space(2) },
  sheet: { backgroundColor: t.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 2, borderColor: t.line, paddingTop: 20, paddingHorizontal: 18, gap: 12 },
});
}
