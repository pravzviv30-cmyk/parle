/** The existing live room, orb and transcript, opened with the guest capability. */
import { useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { firstPracticeScenario, tutorVoice } from '@luvani/core';
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
import { useOnboardingFramePresentation } from './OnboardingLayout.tsx';
import type { OnboardingProgressValue } from './onboardingProgress.ts';
import { readGuestLiveResult, endGuestLivePractice, saveGuestPractice, type GuestPractice } from './guestPractice.ts';
import { repairFirstLiveRecord, type FirstContribution } from './firstLiveModel.ts';

export function FirstLivePractice({ guest, progress, onFinished, onSafetyExit, active = true }: {
  guest: GuestPractice; progress: OnboardingProgressValue; onFinished: (record: GuestPractice) => void; onSafetyExit: () => void; active?: boolean;
}) {
  const held = useRef(guest);
  const mounted = useRef(true);
  const finished = useRef(false);
  const finishing = useRef(false);
  const [typing, setTyping] = useState(false);
  const [transcript, setTranscript] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [issue, setIssue] = useState('');
  const [saving, setSaving] = useState(false);
  const [micPending, setMicPending] = useState(false);
  useOnboardingFramePresentation(progress, { ground: paper.ground }, active);
  const remember = (turn: FirstContribution) => {
    const current = held.current.live!;
    if (current.contributions.some(c => c.id === turn.id)) return;
    held.current = { ...held.current, live: { ...current, contributions: [...current.contributions, turn].slice(-500) } };
    void saveGuestPractice(held.current).catch(() => { if (mounted.current) setIssue('Your practice has not saved on this device yet. Keep this screen open and try saving again.'); });
  };
  const live = useLiveSession(guest.id!, 'convo-01', undefined, {
    mode: 'convo', guestToken: guest.token!, tutorVoice: guest.plan.tutorVoice, onConfirmedContribution: remember,
  });
  const name = tutorVoice(guest.plan.tutorVoice).persona.name;
  useEffect(() => {
    mounted.current = true;
    void live.start();
    return () => { mounted.current = false; };
  }, []);
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
      const record = repairFirstLiveRecord({ ...held.current.live, ...result });
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
  useEffect(() => { if (live.recap && !live.tutorSpeaking && live.safety?.action !== 'stop') void collect(); }, [live.recap, live.tutorSpeaking]);
  const ready = live.status.phase === 'live' && !!(live.convo || live.opening) && !live.waitingForTutor && !live.reconnecting;
  const failed = live.status.phase === 'error' || live.status.phase === 'out-of-minutes';
  const canRecoverByTyping = live.status.phase === 'error' && !!live.sessionId && !live.settlement && !ending && !live.recap
    && typedDoorFor(live.status.failure, { typing });
  const canRetryConnection = live.status.phase === 'error' && !live.convo && !live.sessionId && !live.settlement && !ending;
  const state: OrbState = failed ? 'error' : live.reconnecting || !ready ? 'connecting' : live.tutorSpeaking ? 'speaking' : live.thinking ? 'thinking' : live.micOpen ? 'listening' : 'ready';
  const caption = saving ? 'Saving your session…' : ending ? 'Finishing this conversation…' : live.status.phase === 'error' ? failureCopy(live.status.failure).label : live.status.phase === 'out-of-minutes' ? live.status.label : live.reconnecting ? 'Reconnecting…' : !ready ? `Connecting to ${name}…` : live.tutorSpeaking ? `${name} is speaking` : live.thinking ? 'Thinking…' : live.micOpen ? 'Listening' : typing ? 'Ready for your message' : 'Ready when you are';
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
    // Guest recovery must keep this room and meter. A failed switch never
    // falls back to minting another grant while this session is outstanding.
    if (takeTypedDoor(live) === 'kept-the-room') { setTyping(true); setIssue(''); }
    else setIssue('This session cannot continue by typing. End the session or check its result.');
  };
  const changeInput = async (nextTyping = !typing) => {
    if (micPending) return;
    setMicPending(true);
    try {
      if (nextTyping) { if (await live.pauseMic()) setTyping(true); }
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
    const clean = { ...held.current, completed: false, finishedAt: [], live: { ...held.current.live!, outcome: 'interrupted' as const, contributions: [], pack: null } };
    await saveGuestPractice(clean); await live.leave(); onSafetyExit();
  })().catch(() => setIssue('Your session could not close yet. Try Close again.')); }} />
    {issue ? <Text accessibilityRole="alert" style={[type.small, { padding: 20 }]}>{issue}</Text> : null}
  </View>;
  return <RoomLevels micTrack={live.audioTracks.mic} tutorTrack={live.audioTracks.tutor} micOpen={live.micOpen} tutorSpeaking={live.tutorSpeaking} focused={active}>
    <View style={{ flex: 1, minHeight: 0 }}>
      <C2LiveRoom tutorName={name} description={`${firstPracticeScenario(guest.live!.brief).en}, ${guest.live!.brief.minutes === null ? 'at your pace' : `${guest.live!.brief.minutes} minutes`}`}
        state={state} caption={caption} turns={live.turns} tutorSpeaking={live.tutorSpeaking} partialTranscript={live.partialTranscript}
        typing={typing} ready={ready && !ending && !live.recap} modePending={micPending} active={active} embedded
        transcriptVisible={transcript} onTranscriptVisibility={setTranscript} draft={draft}
        onDraft={text => { setDraft(text); live.sendTyping(); }} onSend={send} canSend={!live.thinking && !live.tutorSpeaking && !ending}
        onModeChange={next => void changeInput(next)} onMic={() => void (live.micOpen ? live.pauseMic() : live.openMic())} micOpen={live.micOpen}
        onEnd={() => setConfirmEnd(true)} notice={issue || live.notice}
        top={<>{live.audioBlocked ? <PillButton label={`Listen to ${name}`} onPress={live.resumeAudio} /> : null}
          {safety.kind === 'redirect' ? <SafetyBanner surface={safety} onDismiss={live.dismissSafety} /> : null}</>}
        support={live.convo?.supportView && live.convo.supportView.kind !== 'none' ? <SupportBlock support={live.convo.supportView} /> : undefined}
        tools={<IconAction icon="hint" label="Give me a hint" disabled={live.thinking || live.tutorSpeaking} onPress={() => live.sendHelp()} />}
        footer={failed ? <>
          <Text accessibilityLiveRegion="polite" style={type.body}>{live.status.phase === 'error' || live.status.phase === 'out-of-minutes' ? live.status.message : ''}</Text>
          {canRecoverByTyping && <PillButton label="Continue by typing" onPress={recoverByTyping} />}
          {canRetryConnection && <PillButton label="Try connecting again" onPress={() => void live.start()} />}
          {!!live.sessionId && <IconAction icon="refresh" label="Check session result" onPress={() => void collect()} />}
          <IconAction icon="close" label="End session" onPress={() => setConfirmEnd(true)} />
        </> : ending || live.recap ? <PillButton label={saving ? 'Saving…' : 'Continue to my summary'} disabled={saving} onPress={() => void collect()} /> : undefined}
      />
      <Sheet visible={confirmEnd} title="End this practice?" onClose={() => setConfirmEnd(false)}>
        <Text style={type.body}>Your confirmed replies will be kept. Only a completed practice counts towards your streak.</Text>
        <PillButton label="Keep practising" onPress={() => setConfirmEnd(false)} />
        <IconAction icon="close" label="End practice" onPress={() => { setConfirmEnd(false); void end(); }} />
      </Sheet>
    </View>
  </RoomLevels>;
}
