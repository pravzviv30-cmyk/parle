/**
 * The live session driver.
 *
 * Everything pedagogical happens in the agent; this screen connects, opens the
 * microphone, and renders what it is told. Note what is deliberately absent
 * compared to the mock: no silence timer (the agent runs the rescue), no grading,
 * no mic-press handler (the learner just talks), and option cards are read-along
 * support rather than buttons — saying it aloud is the product.
 */

import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import type { Lesson, Rung, SessionSummary } from '@parle/core';
import { paper, space, type, HIT } from './theme.ts';
import { Card, PillButton, GhostButton } from './components.tsx';
import { SessionView } from './SessionView.tsx';
import { useLiveSession } from './live/useLiveSession.ts';
import { CONNECTING_TICK_MS, connectingTick, connectingView } from './live/connectingView.ts';
import { LiveErrorView } from './live/LiveErrorView.tsx';
import { connectionLine } from './live/connectionLine.ts';
import { takeTypedDoor, typedDoorFor } from './live/typedDoor.ts';
import { useProfile } from './app/ProfileContext.tsx';
import { isUnderAgeStop } from './profile/age.ts';
import { withAgeStop } from './profile/store.ts';
import { safetySurface, stoppedBySafety } from './tutor/safetyView.ts';
import { waitingView } from './tutor/waitingView.ts';
import { SafetyBanner, SafetyStopView } from './tutor/SafetyStopView.tsx';
import { Paywall } from './purchases/Paywall.tsx';

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
  const { profile, update } = useProfile();
  const live = useLiveSession(userId, lesson.id, startRung, textMode ? { mode: 'lesson-text' } : undefined);

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
  const typing = textMode || live.voiceless;

  /**
   * The quiet door, which the lesson now has on the same terms as the
   * conversation. It goes quiet in the room that is already open; the cold
   * rebuild is kept for the session that never had one.
   */
  const goQuiet = () => {
    if (takeTypedDoor(live) === 'needs-a-new-session') onRetryAsText();
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
    if (live.summary && !stopped) onFinish(live.summary);
  }, [live.summary, onFinish, stopped]);

  const leaveNow = () => {
    void live.leave().finally(onExit);
  };

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
    return (
      <View style={st.center}>
        <ActivityIndicator color={paper.inkSoft} />
        <Text
          accessibilityLiveRegion="polite"
          style={[type.small, { color: paper.inkSoft, marginTop: space(3), textAlign: 'center' }]}
        >
          {connecting.headline}
        </Text>
        <View style={{ marginTop: space(6) }}>
          <GhostButton label={connecting.leaveLabel} onPress={leaveNow} />
        </View>
      </View>
    );
  }

  if (live.status.phase === 'out-of-minutes') {
    return (
      <View style={st.center}>
        <Text style={[type.title, { color: paper.ink, textAlign: 'center' }]}>Out of minutes</Text>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(3), textAlign: 'center' }]}>
          {live.status.message}
        </Text>
        <Paywall userId={userId} />
        <View style={{ marginTop: space(6) }}>
          <PillButton label="Back" onPress={onExit} />
        </View>
      </View>
    );
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
        message={live.status.message}
        diagnostics={live.diagnostics}
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
    const waiting = waitingView({ waitingForTutor: live.waitingForTutor, safety });
    return (
      <View style={st.center}>
        {waiting.banner ? (
          <View style={st.waitingBanner}>
            <SafetyBanner surface={waiting.banner} onDismiss={live.dismissSafety} />
          </View>
        ) : null}
        <ActivityIndicator color={paper.inkSoft} />
        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(3) }]}>{waiting.headline}</Text>
        <View style={{ marginTop: space(6) }}>
          <GhostButton label={waiting.leaveLabel} onPress={leaveNow} />
        </View>
      </View>
    );
  }

  return (
    <View style={st.root}>
      {live.audioBlocked && (
        // The browser wants a gesture before it will play the tutor. One calm
        // white card, gone the moment it is tapped.
        <Pressable
          onPress={live.resumeAudio}
          accessibilityRole="button"
          accessibilityLabel="Tap to listen"
          style={({ pressed }) => [st.listen, pressed && { opacity: 0.85 }]}
        >
          <Card style={{ alignItems: 'center' }}>
            <Text style={[type.bodyStrong, { color: paper.ink }]}>Tap to listen</Text>
          </Card>
        </Pressable>
      )}
      <View style={st.topRow}>
        {/* Transient trouble from the agent (a voice hiccup), which clears
            itself, or a connection being rebuilt, which does not and must not
            be given a timer. One line at a time: live/connectionLine.ts. */}
        <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.inkSoft, flex: 1 }]}>
          {connectionLine({ reconnecting: live.reconnecting, notice: live.notice }).text ?? ''}
        </Text>
        {/* Metered minutes must always have a door. */}
        <Pressable
          onPress={leaveNow}
          accessibilityRole="button"
          accessibilityLabel="Leave the lesson"
          style={({ pressed }) => [st.leave, pressed && { opacity: 0.6 }]}
        >
          <Text style={[type.bodyStrong, { color: paper.inkSoft }]}>Leave</Text>
        </Pressable>
      </View>
      {/* The tutor steered away and said why. It stays until the learner puts
          it away, unlike the notice above it, which is a hiccup on a timer. */}
      {safety.kind === 'redirect' ? (
        <View style={st.banner}>
          <SafetyBanner surface={safety} onDismiss={live.dismissSafety} />
        </View>
      ) : null}
      <SessionView
        lessonTitle={lesson.title}
        cefr={lesson.cefr}
        prompt={live.prompt}
        listening={!live.tutorSpeaking}
        flash={live.feedback?.message ?? null}
        transcript={live.lastTranscript}
        onHelp={live.sendHelp}
        // Replays come from the agent in the premium voice, and only while the
        // learner holds the floor — a replay must not talk over the tutor.
        onHearLine={!live.tutorSpeaking && !typing ? live.sendHear : undefined}
        // Saying it aloud is still the product, and the cards are still
        // read-along support while the learner has a voice to use. But a
        // carriage full of strangers is not a reason to finish a lesson having
        // said nothing: a tap is an answer, graded like any other, and counted
        // as an utterance nobody heard rather than one that went well.
        onOptionPress={live.sendChoice}
        onType={typing ? live.sendSay : undefined}
        // Typing is presence, and the typed lesson is the one surface that
        // never sent it: the agent counted the silence and rescued a learner
        // who was mid-sentence. Throttled inside the hook.
        onTyping={typing ? live.sendTyping : undefined}
      />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground },
  center: { flex: 1, backgroundColor: paper.ground, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(8) },
  listen: { minHeight: HIT, paddingHorizontal: space(5), paddingTop: space(3) },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(5), paddingTop: space(2) },
  banner: { paddingHorizontal: space(5), paddingTop: space(2) },
  // The waiting screen centres its children, so the banner has to be told to
  // take the width: a safety sentence shrink-wrapped to its longest word is
  // unreadable, and this one is the whole reason the branch draws anything.
  waitingBanner: { alignSelf: 'stretch', marginBottom: space(3) },
  leave: { minHeight: HIT, justifyContent: 'center', paddingLeft: space(3) },
});
