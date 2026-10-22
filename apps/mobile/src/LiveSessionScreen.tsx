import { sessionSettlementCopy } from '@luvani/core';
/**
 * The live session driver.
 *
 * Everything pedagogical happens in the agent; this screen connects, opens the
 * microphone, and renders what it is told. Note what is deliberately absent
 * compared to the mock: no silence timer (the agent runs the rescue), no grading,
 * no mic-press handler (the learner just talks), and option cards are read-along
 * support rather than buttons — saying it aloud is the product.
 *
 * Four things can be the whole window here, and the route has no system chrome
 * above or below it. The three status branches sit on the still frame from
 * `layout.tsx`, which pays the notch and the home indicator once. The live scene
 * is `SessionView`, which is already on the frame, so it is handed what belongs
 * above its header rather than being wrapped in a second one. See
 * `live/safeArea.test.ts`.
 */

import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useIsFocused, usePreventRemove } from '@react-navigation/native';
import type { Lesson, Rung, SessionSummary } from '@luvani/core';
import { space, type, HIT } from './theme.ts';
import { Card, GhostButton } from './components.tsx';
import { ConfirmSheet, Screen } from './layout.tsx';
import { SupportBlock } from './SessionView.tsx';
import { C2LiveRoom } from './live/C2LiveRoom.tsx';
import { IconAction } from './components.tsx';
import { rungLabel } from './tutor/rungLabel.ts';
import { useLiveSession } from './live/useLiveSession.ts';
import { CONNECTING_TICK_MS, connectingTick, connectingView } from './live/connectingView.ts';
import { RoomWait } from './live/RoomWait.tsx';
import { CONNECTING_TITLE, connectingBody } from './live/connectingView.ts';
import { waitingNote } from './tutor/waitingView.ts';
import { LiveErrorView } from './live/LiveErrorView.tsx';
import { connectionLine } from './live/connectionLine.ts';
import { leaveConfirmCopy } from './live/leaveConfirm.ts';
import { takeTypedDoor, typedDoorFor } from './live/typedDoor.ts';
import { useProfile } from './app/ProfileContext.tsx';
import { tutorNameOf } from './tutor/tutorName.ts';
import { tutorVoiceOf } from './tutor/tutorVoice.ts';
import { isUnderAgeStop } from './profile/age.ts';
import { withAgeStop } from './profile/store.ts';
import { safetySurface, stoppedBySafety } from './tutor/safetyView.ts';
import { waitingView } from './tutor/waitingView.ts';
import { SafetyBanner, SafetyStopView } from './tutor/SafetyStopView.tsx';
import { OutOfMinutesView } from './live/OutOfMinutesView.tsx';
import { RoomLevels } from './live/RoomLevels.tsx';
import { useB, useThemedStyles, type B } from './main/bTheme.tsx';
import { sessionFinishedEvent } from './analytics/sessionFinished.ts';
import { trackProductEvent } from './analytics/track.ts';

export function LiveSessionScreen({
  lesson,
  userId,
  startRung,
  onFinish,
  onExit,
  textMode = false,
  onRetryAsText,
}: {
  lesson: Lesson;
  userId: string;
  /** Where the ladder opens. The agent stays authoritative; this is a request. */
  startRung?: Rung;
  onFinish: (s: SessionSummary) => void;
  onExit: () => void;
  /** Open with the voice pipeline dark: the lesson is read and typed, never spoken. */
  textMode?: boolean;
  /**
   * Reopen this lesson typed, from cold.
   *
   * Required, because it is the fallback and a fallback nobody passed is a
   * button that does nothing. It is only reached when the room is already gone:
   * with a room open the quiet door is taken in place, and this whole rebuild,
   * with its second token and its second grant, never happens.
   */
  onRetryAsText: () => void;
}) {
  const t = useB();
  const st = useThemedStyles(makeSt);
  const { profile, update } = useProfile();
  // Who this learner chose. The waiting line is the one place this screen names
  // the tutor, and naming the wrong person there is the first thing a learner
  // who picked a woman's voice would read.
  const tutorName = tutorNameOf(profile);
  // The voice rides every start, the default included, so the picker on Profile
  // and the agent's own fallback can never mean two different people by
  // "unchosen". See live/useLiveSession.ts for why it is not a conditional.
  const live = useLiveSession(userId, lesson.id, startRung, {
    ...(textMode ? { mode: 'lesson-text' as const } : {}),
    tutorVoice: tutorVoiceOf(profile),
  });

  // The leave gate. `confirming` shows the sheet; `leaving` is raised once the
  // learner commits, which drops the guard and lets the exit run from an effect
  // rather than inline, where the guard would prevent its own pop.
  const [confirming, setConfirming] = useState(false);
  const [typingOpen, setTypingOpen] = useState(false);
  const [transcriptVisible, setTranscriptVisible] = useState(true);
  const [draft, setDraft] = useState('');
  const [modePending, setModePending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leaveCopy = leaveConfirmCopy('lesson');

  // Connect on mount. The hook tears the room down on unmount.
  useEffect(() => {
    void live.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The learner is typing: the lesson opened that way, or the room went quiet
   * around them. `voiceless` is the room's own answer and is the only thing
   * that knows about the second case.
   */
  const typing = textMode || live.voiceless || typingOpen;
  /**
   * Whether this lesson is the screen in front of the learner. The Speak
   * circle's level ring is measured (live/RoomLevels) only while it is, and
   * the app is active.
   */
  const roomFocused = useIsFocused();

  /**
   * The quiet door, which the lesson now has on the same terms as the
   * conversation. It goes quiet in the room that is already open; the cold
   * rebuild is kept for the session that never had one.
   */
  const goQuiet = () => {
    if (takeTypedDoor(live) === 'needs-a-new-session') onRetryAsText();
  };
  const changeInput = async (nextTyping: boolean) => {
    if (modePending) return;
    setModePending(true);
    try {
      if (nextTyping) { if (await live.pauseMic()) setTypingOpen(true); }
      else if (!textMode && await live.openMic()) setTypingOpen(false);
    } finally { setModePending(false); }
  };
  const sendDraft = async () => {
    if (!draft.trim() || live.tutorSpeaking || live.thinking || live.reconnecting) return false;
    const sent = await live.sendSay(draft.trim());
    if (sent) setDraft(current => current === draft ? '' : current);
    return sent;
  };
  // How long the connect has been running, for the copy that grows with it.
  // The interval exists only while the connecting branch is the whole screen
  // and is cleared the moment the room opens or the screen goes away, so
  // nothing ticks behind a live session. `connectingTick` returns the number
  // already held while the stage is unchanged, so React bails out of the render
  // and a twenty five second wait costs two of them. See live/connectingView.ts.
  const [connectingMs, setConnectingMs] = useState(0);
  // Read off `phase` rather than spelled out twice: the stop surface has to be
  // returned above every status branch, and safetyView.test.ts proves that by
  // finding the first mention of the connecting phase in the file. A hook that
  // spells the branch's own condition out up here moves that mark and makes the
  // ordering test read a line that is not a branch.
  const phase = live.status.phase;
  const awaitingRoom = phase === 'connecting' || phase === 'idle';
  useEffect(() => {
    if (!awaitingRoom) return;
    // A fresh attempt gets a fresh clock. The conversation reconnects when the
    // learner takes the quiet door, and without this the second attempt opened
    // on the first one's oldest sentence.
    setConnectingMs(0);
    const from = Date.now();
    const tick = setInterval(() => setConnectingMs((prev) => connectingTick(prev, Date.now() - from)), CONNECTING_TICK_MS);
    return () => clearInterval(tick);
  }, [awaitingRoom]);

  // A stopped session leaves nothing behind here either, and the two quiet
  // modes are no exception: a disclosure typed into a lesson is the same
  // disclosure. See tutor/safetyView.ts.
  const safety = safetySurface(live.safety);
  const stopped = stoppedBySafety(live.safety);

  // The one stop that outlives its session. A disclosure typed into a lesson is
  // the same disclosure, so this screen writes it down exactly as the
  // conversation does, and the navigator reads it back on the next launch.
  const ageStopWrittenRef = useRef(false);
  useEffect(() => {
    if (ageStopWrittenRef.current || !isUnderAgeStop(live.safety)) return;
    ageStopWrittenRef.current = true;
    update(withAgeStop(profile));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.safety]);

  useEffect(() => {
    // `onFinish` is what puts SummaryScreen on the screen, so withholding it is
    // what keeps a card counting up what went well away from a stop.
    if (live.summary && !stopped && live.settlement === null) onFinish(live.summary);
  }, [live.summary, live.settlement, onFinish, stopped]);

  // One content-free beta event per finished lesson (analytics/sessionFinished.ts).
  // A safety stop is not a finished lesson and reports nothing.
  const reportedRef = useRef(false);
  useEffect(() => {
    if (!live.summary || stopped || reportedRef.current) return;
    reportedRef.current = true;
    void trackProductEvent(sessionFinishedEvent({ kind: 'lesson', voice: !(textMode || live.voiceless), turns: live.summary.turnsCompleted,
      rescues: live.summary.rescues, unassistedRate: live.summary.unassistedRate, replyLatencyMs: live.replyLatencyMs() }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.summary, stopped]);

  const leaveNow = () => {
    void live.leave().finally(onExit);
  };

  // In the room only on the branch that renders the live scene, above every
  // early return below. That is the one place leaving costs metered minutes, so
  // it is the one place a swipe or a hardware back is caught and asked first.
  const inRoom =
    safety.kind !== 'stop' &&
    phase !== 'connecting' &&
    phase !== 'idle' &&
    live.status.phase !== 'out-of-minutes' &&
    live.status.phase !== 'error' &&
    live.prompt != null;

  // Android's hardware back and iOS's edge swipe both go through here, so
  // neither can pop the room without meeting the same sheet the header opens.
  usePreventRemove(inRoom && !leaving, () => setConfirming(true));

  // The exit runs from the effect, not from the sheet's confirm: with the guard
  // still up an inline pop would be prevented. Raising `leaving` lowers the
  // guard first, and this then runs the real teardown.
  useEffect(() => {
    if (leaving) leaveNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  // First, and before every status screen. A stop is normally followed by the
  // agent leaving the room, which the hook reads as a dropped connection, and
  // an error screen must not take the words off the screen a moment after they
  // arrived.
  if (safety.kind === 'stop') {
    return <SafetyStopView surface={safety} onClose={leaveNow} />;
  }

  if (live.status.phase === 'connecting' || live.status.phase === 'idle') {
    // One sentence for up to twenty five seconds, and no way out of the branch
    // that returns above every control this screen owns. Both halves are the
    // view model's now. Leaving mid-connect is safe: `leave()` takes the
    // session number with it, so the attempt still waiting on a token stands
    // down and gives back the room it was about to open. See
    // live/startOwnership.ts.
    const connecting = connectingView(connectingMs);
    return <RoomWait state="connecting" title={CONNECTING_TITLE} body={connectingBody(tutorName)} stage={connecting.headline} leaveLabel={connecting.leaveLabel} onLeave={leaveNow} />;
  }

  if (live.status.phase === 'out-of-minutes') {
    // The session has ended, so this is not the live scene F444 keeps still.
    // The page can be taller than a small phone at a large text size, so it
    // scrolls in its own file, as the safety stop does.
    return <OutOfMinutesView label={live.status.label} message={live.status.message} userId={userId} onExit={onExit} />;
  }

  if (live.status.phase === 'error') {
    // A learner whose microphone was refused is exactly the learner who needs
    // the typed route, and the four failures that carry canType are the ones
    // where typing is a real way out. Which those are, and whether the offer is
    // real, is `typedDoorFor` rather than a condition each screen writes out.
    //
    // Back leaves the room. A blocking failure with a typed door keeps the room
    // open on purpose so that door has somewhere to go.
    return (
      <LiveErrorView
        failure={live.status.failure}
        turns={live.turns}
        tutorName={tutorName}
        transcriptVisible={transcriptVisible}
        onTranscriptVisibility={setTranscriptVisible}
        message={live.status.message}
        diagnostics={live.diagnostics}
        settlementMessage={live.settlement ? sessionSettlementCopy(live.settlement) : null}
        typedRestartLabel="Start a typed lesson"
        restartAsText={live.settlement !== null}
        retryBlocked={live.settlement?.kind === 'pending' || live.settlement?.kind === 'reconciliation'}
        onBack={leaveNow}
        onType={typedDoorFor(live.status.failure, { typing }) ? goQuiet : null}
      />
    );
  }

  if (!live.prompt) {
    // The room is open and the tutor has not spoken yet. This used to be a bare
    // spinner with no words and no way out, which is what a down agent looked
    // like — forever. The hook's watchdog now ends this state either way, and
    // there is a door while it lasts.
    //
    // Same early return as the conversation's, and it had the same hole: the
    // redirect banner is below it, so a redirect the tutor published before its
    // first line was never drawn at all. The view model carries it now. See
    // tutor/waitingView.ts.
    const waiting = waitingView({ waitingForTutor: live.waitingForTutor, safety, tutorName });
    return <RoomWait title={waiting.headline} body={waitingNote(tutorName)} leaveLabel={waiting.leaveLabel} onLeave={leaveNow}
      banner={waiting.banner ? <SafetyBanner surface={waiting.banner} onDismiss={live.dismissSafety} /> : undefined} />;
  }

  const prompt = live.prompt;
  const caption = connectionLine({ reconnecting: live.reconnecting, notice: live.notice }).text
    ?? (live.thinking ? 'Thinking…' : live.tutorSpeaking ? `${tutorName} is speaking` : typing ? 'Typing, microphone paused' : live.micOpen ? 'Listening' : 'Microphone paused');
  return <RoomLevels micTrack={live.audioTracks.mic} tutorTrack={live.audioTracks.tutor} micOpen={live.micOpen} tutorSpeaking={live.tutorSpeaking} focused={roomFocused}>
    <View style={st.root}>
      <C2LiveRoom tutorName={tutorName} description={lesson.title} state={live.reconnecting ? 'connecting' : live.thinking ? 'thinking' : live.tutorSpeaking ? 'speaking' : live.micOpen ? 'listening' : 'ready'}
        caption={caption} turns={live.turns} tutorSpeaking={live.tutorSpeaking} partialTranscript={live.partialTranscript}
        typing={typing} startedWithSpeech={!textMode} ready={!live.reconnecting} modePending={modePending} active={roomFocused}
        transcriptVisible={transcriptVisible} onTranscriptVisibility={setTranscriptVisible} draft={draft}
        onDraft={text => { setDraft(text); live.sendTyping(); }} onSend={sendDraft} canSend={!live.tutorSpeaking && !live.thinking}
        onModeChange={next => void changeInput(next)} onMic={() => void (live.micOpen ? live.pauseMic() : live.openMic())} micOpen={live.micOpen}
        onEnd={() => setConfirming(true)} notice={live.feedback?.message}
        top={<>{live.audioBlocked ? <IconAction icon="speaker" label={`Listen to ${tutorName}`} onPress={live.resumeAudio} /> : null}
          {safety.kind === 'redirect' ? <SafetyBanner surface={safety} onDismiss={live.dismissSafety} /> : null}
          <Text style={[type.small, { color: t.muted, textAlign: 'center' }]}>{rungLabel(prompt.directive.rung, tutorName)}, {prompt.position} of {prompt.total}</Text></>}
        support={prompt.support.kind !== 'none' ? <SupportBlock support={prompt.support} onOptionPress={live.sendChoice}
          onHearLine={!live.tutorSpeaking && !typing ? () => live.sendHear() : undefined} /> : undefined}
        tools={<><IconAction icon="hint" label="Help me out" disabled={live.tutorSpeaking || live.thinking} onPress={live.sendHelp} />
          {prompt.turn.note ? <Text style={[type.small, { color: t.text }]}>{prompt.turn.note}</Text> : null}</>}
      />
      <ConfirmSheet visible={confirming} title={leaveCopy.title} body={leaveCopy.body} confirmLabel={leaveCopy.leave} cancelLabel={leaveCopy.stay}
        onConfirm={() => { setConfirming(false); setLeaving(true); }} onCancel={() => setConfirming(false)} />
    </View>
  </RoomLevels>;
}

function makeSt(t: B) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: t.ground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(8) },
  // Both are drawn in the frame's header slot, which pays the horizontal pad,
  // so neither repeats it. See `aboveTheScene`.
  listen: { minHeight: HIT, paddingTop: space(3) },
  // The centring root shrink-wraps its children, so the card is told to take
  // the width: a store offer sized to its longest word is not an offer.
  banner: { paddingTop: space(2) },
  // The waiting screen centres its children, so the banner has to be told to
  // take the width: a safety sentence shrink-wrapped to its longest word is
  // unreadable, and this one is the whole reason the branch draws anything.
  waitingBanner: { alignSelf: 'stretch', marginBottom: space(3) },
});
}
