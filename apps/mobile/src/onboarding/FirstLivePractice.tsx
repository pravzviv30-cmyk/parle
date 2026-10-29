/** The existing live room, orb and transcript, opened with the guest capability. */
import { useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { firstPracticeScenario, tutorVoice, GUEST_CAFE_SCENE, GUEST_SCENE_MAX_SECONDS } from '@luvani/core';
import { rungLabel } from '../tutor/rungLabel.ts';
import { onColour } from '../palette.ts';
import { GUEST_ROOM_ENDED, GUEST_SCENE, GUEST_SCENE_LESSON_ID, guestSceneMode } from './guestScene.ts';
import { IconAction, Sheet } from '../components.tsx';
import { paper } from '../theme.ts';
import { boldType as type, c } from './boldRhythm.ts';
import { BoldButton as PillButton } from './BoldButton.tsx';
import { useLiveSession } from '../live/useLiveSession.ts';
import { failureCopy } from '../live/failure.ts';
import { takeTypedDoor, typedDoorFor } from '../live/typedDoor.ts';
import { RoomLevels } from '../live/RoomLevels.tsx';
import { type OrbState } from '../tutor/VoiceOrb.tsx';
import { SupportBlock } from '../SessionView.tsx';
import { SafetyStopView, SafetyBanner } from '../tutor/SafetyStopView.tsx';
import { safetySurface } from '../tutor/safetyView.ts';
import { C2LiveRoom } from '../live/C2LiveRoom.tsx';
import { useQuietVoice } from '../live/useQuietVoice.ts';
import { useOnboardingFramePresentation } from './OnboardingLayout.tsx';
import type { OnboardingProgressValue } from './onboardingProgress.ts';
import { readGuestLiveResult, endGuestLivePractice, saveGuestPractice, type GuestPractice } from './guestPractice.ts';
import { repairFirstLiveRecord, sceneResultRecord, type FirstContribution } from './firstLiveModel.ts';

export function FirstLivePractice({ guest, progress, onFinished, onSafetyExit, active = true }: {
  guest: GuestPractice; progress: OnboardingProgressValue; onFinished: (record: GuestPractice) => void; onSafetyExit: () => void; active?: boolean;
}) {
  const held = useRef(guest);
  const mounted = useRef(true);
  const finished = useRef(false);
  const finishing = useRef(false);
  const [typing, setTyping] = useState(false);
  const [transcript, setTranscript] = useState(true);
  const { quietVoice, onQuietVoice } = useQuietVoice(setTranscript);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [issue, setIssue] = useState('');
  const [saving, setSaving] = useState(false);
  const [micPending, setMicPending] = useState(false);
  // The guest café scene runs the scripted lesson tutor, voiced or typed; an
  // older record without it still runs the guest conversation.
  const scene = guest.live?.scene === GUEST_SCENE;
  const [typedScene, setTypedScene] = useState(false);
  // Bumped for each typed restart, so a restart always runs with the typed mode in hand.
  const [typedRestart, setTypedRestart] = useState(0);
  useOnboardingFramePresentation(progress, { ground: paper.ground }, active);
  const remember = (turn: FirstContribution) => {
    const current = held.current.live!;
    if (current.contributions.some(c => c.id === turn.id)) return;
    held.current = { ...held.current, live: { ...current, contributions: [...current.contributions, turn].slice(-500) } };
    void saveGuestPractice(held.current).catch(() => { if (mounted.current) setIssue('Your practice has not saved on this device yet. Keep this screen open and try saving again.'); });
  };
  const live = useLiveSession(guest.id!, scene ? GUEST_SCENE_LESSON_ID : 'convo-01', undefined, scene
    ? { mode: guestSceneMode(typedScene), guestToken: guest.token!, tutorVoice: guest.plan.tutorVoice }
    : { mode: 'convo', guestToken: guest.token!, tutorVoice: guest.plan.tutorVoice, onConfirmedContribution: remember });
  const name = tutorVoice(guest.plan.tutorVoice).persona.name;
  useEffect(() => {
    mounted.current = true;
    void live.start();
    return () => { mounted.current = false; };
  }, []);
  // Typing chosen when the room cannot switch in place: open the scene typed.
  // The server re-signs an unclaimed scene room in the other mode; a claimed
  // one answers 409, which is the "This scene has ended" state.
  useEffect(() => { if (typedRestart > 0) void live.start(); }, [typedRestart]);
  useEffect(() => {
    if (!live.sessionId || held.current.live?.sessionId === live.sessionId) return;
    held.current = { ...held.current, live: { ...held.current.live!, sessionId: live.sessionId } };
    void saveGuestPractice(held.current).catch(() => { if (mounted.current) setIssue('Your session is open, but could not be saved on this device yet.'); });
  }, [live.sessionId]);
  useEffect(() => {
    const app = AppState.addEventListener('change', state => { if (state !== 'active') void live.pauseMic(); });
    if (!active) void live.pauseMic();
    return () => app.remove();
  }, [active, live.pauseMic]);
  const collect = async () => {
    if (finishing.current || finished.current) return;
    finishing.current = true; setSaving(true); setIssue('');
    try {
      const result = await readGuestLiveResult(held.current);
      if (result.outcome === 'active') throw new Error('The tutor is still saving your session. Try again in a moment.');
      const record = repairFirstLiveRecord(sceneResultRecord(held.current.live, result));
      if (!record || (held.current.live?.sessionId && record.sessionId !== held.current.live.sessionId)) throw new Error('Your session result is not available yet. Try again.');
      const next: GuestPractice = { ...held.current, live: record, secondsUsed: record.seconds,
        completed: record.outcome === 'completed',
        finishedAt: record.outcome === 'completed' && record.completedAt ? [record.completedAt] : [] };
      await saveGuestPractice(next);
      await live.leave();
      if (!mounted.current) return;
      held.current = next; finished.current = true; onFinished(next);
    } catch (cause) {
      if (mounted.current) setIssue(cause instanceof Error ? cause.message : 'Your session could not be saved yet. Try again.');
    } finally { finishing.current = false; if (mounted.current) setSaving(false); }
  };
  // A conversation ends on its recap; the scene ends on the lesson summary.
  const over = scene ? live.summary : live.recap;
  useEffect(() => { if (over && !live.tutorSpeaking && live.safety?.action !== 'stop') void collect(); }, [over, live.tutorSpeaking]);
  // The service stops the scene at three minutes; this is the screen's own backstop.
  useEffect(() => {
    if (!scene || !live.sessionId) return;
    const timer = setTimeout(() => { if (!finished.current) void end(); }, GUEST_SCENE_MAX_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [scene, live.sessionId]);
  const opened = scene ? !!live.prompt : !!(live.convo || live.opening);
  // A guest grant only asks /onboarding/live, so a 409 here is this guest room already claimed.
  const roomEnded = live.status.phase === 'error' && live.status.failure === 'session-elsewhere';
  const ready = live.status.phase === 'live' && opened && !live.waitingForTutor && !live.reconnecting;
  const failed = live.status.phase === 'error' || live.status.phase === 'out-of-minutes';
  const canRecoverByTyping = !roomEnded && live.status.phase === 'error' && (scene ? !typedScene : !!live.sessionId) && !live.settlement && !ending && !over
    && typedDoorFor(live.status.failure, { typing });
  const canRetryConnection = !roomEnded && live.status.phase === 'error' && !opened && !live.sessionId && !live.settlement && !ending;
  const state: OrbState = failed ? 'error' : live.reconnecting || !ready ? 'connecting' : live.tutorSpeaking ? 'speaking' : live.thinking ? 'thinking' : live.micOpen ? 'listening' : 'ready';
  const caption = saving ? 'Saving your session…' : ending ? 'Finishing this conversation…' : scene && (over || live.status.phase === 'ended') ? 'Your café scene is over' : roomEnded ? GUEST_ROOM_ENDED.label : live.status.phase === 'error' ? failureCopy(live.status.failure).label : live.status.phase === 'out-of-minutes' ? live.status.label : live.reconnecting ? 'Reconnecting…' : !ready ? `Connecting to ${name}…` : live.tutorSpeaking ? `${name} is speaking` : live.thinking ? 'Thinking…' : live.micOpen ? 'Listening' : typing ? 'Ready for your message' : 'Ready when you are';
  const end = async () => {
    setEnding(true); await live.pauseMic();
    if (ready) live.requestRecap();
    else {
      try { await endGuestLivePractice(held.current); await live.leave(); await collect(); }
      catch { setIssue('Your session could not close yet. Try again.'); setEnding(false); }
    }
  };
  const recoverByTyping = () => {
    if (!canRecoverByTyping) return;
    // A scene with no room to switch in (never granted, or granted and never
    // joined, as after a refused microphone) restarts typed instead.
    if (scene && !live.sessionId) { restartTyped(); return; }
    // A guest conversation must keep this room and meter: a failed switch never
    // falls back to minting another grant while this session is outstanding.
    if (takeTypedDoor(live) === 'kept-the-room') { setTyping(true); setIssue(''); }
    else if (scene) restartTyped();
    else setIssue('This session cannot continue by typing. End the session or check its result.');
  };
  const restartTyped = () => { setTypedScene(true); setTypedRestart(n => n + 1); setIssue(''); };
  const changeInput = async (nextTyping = !typing) => {
    if (micPending) return;
    setMicPending(true);
    try {
      // Still connecting, or the room never opened: the scene restarts typed.
      if (nextTyping && scene && !ready) restartTyped();
      else if (nextTyping) { if (await live.pauseMic()) setTyping(true); }
      else { if (await live.openMic()) setTyping(false); }
    } finally { if (mounted.current) setMicPending(false); }
  };
  const send = async () => {
    if (!draft.trim() || sending || !ready || live.thinking || ending) return false;
    const text = draft.trim(); setSending(true);
    const sent = await live.sendSay(text);
    if (!mounted.current) return false;
    if (sent) setDraft('');
    else setIssue('That message did not send. Your words are still here. Try Send again.');
    setSending(false);
    return sent;
  };
  const safety = safetySurface(live.safety);
  if (safety.kind === 'stop') return <View style={{ flex: 1 }}><SafetyStopView surface={safety} onClose={() => { void (async () => {
    const clean = { ...held.current, completed: false, finishedAt: [], live: { ...held.current.live!, outcome: 'interrupted' as const, contributions: [], pack: null,
      ...(held.current.live?.scene ? { sceneTurns: [] } : {}) } };
    await saveGuestPractice(clean); await live.leave(); onSafetyExit();
  })().catch(() => setIssue('Your session could not close yet. Try Close again.')); }} />
    {issue ? <Text accessibilityRole="alert" style={[type.small, { padding: 20 }]}>{issue}</Text> : null}
  </View>;
  return <RoomLevels micTrack={live.audioTracks.mic} tutorTrack={live.audioTracks.tutor} micOpen={live.micOpen} tutorSpeaking={live.tutorSpeaking} focused={active} quietVoice={quietVoice}>
    <View style={{ flex: 1, minHeight: 0 }}>
      <C2LiveRoom tutorName={name} voice={guest.plan.tutorVoice} description={scene ? `${GUEST_CAFE_SCENE.title}, about two minutes` : `${firstPracticeScenario(guest.live!.brief).en}, ${guest.live!.brief.minutes === null ? 'at your pace' : `${guest.live!.brief.minutes} minutes`}`}
        state={state} caption={caption} turns={live.turns} tutorSpeaking={live.tutorSpeaking} partialTranscript={live.partialTranscript}
        typing={typing || typedScene || (scene && live.voiceless)} startedWithSpeech={scene ? !typedScene : undefined} ready={ready && !ending && !over} modePending={micPending} active={active} embedded
        transcriptVisible={transcript} onTranscriptVisibility={setTranscript} quietVoice={quietVoice} onQuietVoice={onQuietVoice} draft={draft} wrappingUp={live.wrappingUp}
        onDraft={text => { setDraft(text); live.sendTyping(); }} onSend={send} canSend={!live.thinking && !live.tutorSpeaking && !ending}
        onModeChange={next => void changeInput(next)} onMic={() => void (live.micOpen ? live.pauseMic() : live.openMic())} micOpen={live.micOpen}
        onEnd={() => setConfirmEnd(true)} notice={issue || (scene ? live.feedback?.message : undefined) || live.notice}
        top={<>{live.audioBlocked ? <PillButton label={`Listen to ${name}`} onPress={live.resumeAudio} /> : null}
          {safety.kind === 'redirect' ? <SafetyBanner surface={safety} onDismiss={live.dismissSafety} /> : null}
          {scene && live.prompt ? <Text style={[type.small, { color: onColour.blue, textAlign: 'center' }]}>{rungLabel(live.prompt.directive.rung, name)}, {live.prompt.position} of {live.prompt.total}</Text> : null}</>}
        support={scene
          ? live.prompt && live.prompt.support.kind !== 'none' ? <SupportBlock support={live.prompt.support} onOptionPress={live.sendChoice}
            onHearLine={!live.tutorSpeaking && !typing && !typedScene ? () => live.sendHear() : undefined} /> : undefined
          : live.convo?.supportView && live.convo.supportView.kind !== 'none' ? <SupportBlock support={live.convo.supportView} /> : undefined}
        tools={<><IconAction icon="hint" label="Give me a hint" disabled={live.thinking || live.tutorSpeaking} onPress={() => live.sendHelp()} />
          {scene && live.prompt?.turn.note ? <Text style={type.small}>{live.prompt.turn.note}</Text> : null}</>}
        footer={failed ? <>
          <Text accessibilityLiveRegion="polite" style={type.body}>{roomEnded ? GUEST_ROOM_ENDED.message : live.status.phase === 'error' || live.status.phase === 'out-of-minutes' ? live.status.message : ''}</Text>
          {roomEnded && <PillButton label={saving || ending ? 'Saving…' : GUEST_ROOM_ENDED.action} disabled={saving || ending} onPress={() => void end()} />}
          {canRecoverByTyping && <PillButton label="Continue by typing" onPress={recoverByTyping} />}
          {canRetryConnection && <PillButton label="Try connecting again" onPress={() => void live.start()} />}
          {!!live.sessionId && !roomEnded && <IconAction icon="refresh" label="Check session result" onPress={() => void collect()} />}
          <IconAction icon="close" label="End session" onPress={() => setConfirmEnd(true)} />
        </> : ending || over ? <PillButton label={saving ? 'Saving…' : 'Continue to my summary'} disabled={saving} onPress={() => void collect()} /> : undefined}
      />
      <Sheet visible={confirmEnd} title="End this practice?" onClose={() => setConfirmEnd(false)}>
        <Text style={type.body}>{scene ? 'The lines you reach will be kept.' : 'Your confirmed replies will be kept.'} Only a completed practice counts towards your streak.</Text>
        <PillButton label="Keep practising" onPress={() => setConfirmEnd(false)} />
        <IconAction icon="close" label="End practice" onPress={() => { setConfirmEnd(false); void end(); }} />
      </Sheet>
    </View>
  </RoomLevels>;
}
