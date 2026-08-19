/**
 * The live session driver.
 *
 * Everything pedagogical happens in the agent; this screen connects, opens the
 * microphone, and renders what it is told. Note what is deliberately absent
 * compared to the mock: no silence timer (the agent runs the rescue), no grading,
 * no mic-press handler (the learner just talks), and option cards are read-along
 * support rather than buttons — saying it aloud is the product.
 */

import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import type { Lesson, Rung, SessionSummary } from '@parle/core';
import { paper, space, type, HIT } from './theme.ts';
import { Card, Label, PillButton, GhostButton } from './components.tsx';
import { SessionView } from './SessionView.tsx';
import { useLiveSession } from './live/useLiveSession.ts';
import { LiveErrorView } from './live/LiveErrorView.tsx';

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
  /** Reopen this lesson typed. Absent means the caller cannot offer that. */
  onRetryAsText?: () => void;
}) {
  const live = useLiveSession(userId, lesson.id, startRung, textMode ? { mode: 'lesson-text' } : undefined);

  // Connect on mount. The hook tears the room down on unmount.
  useEffect(() => {
    void live.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (live.summary) onFinish(live.summary);
  }, [live.summary, onFinish]);

  const leaveNow = () => {
    void live.leave().finally(onExit);
  };

  if (live.status.phase === 'connecting' || live.status.phase === 'idle') {
    return (
      <View style={st.center}>
        <ActivityIndicator color={paper.inkSoft} />
        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(3) }]}>Reaching the server…</Text>
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
        <View style={{ marginTop: space(6) }}>
          <PillButton label="Back" onPress={onExit} />
        </View>
      </View>
    );
  }

  if (live.status.phase === 'error') {
    // A learner whose microphone was refused is exactly the learner who needs
    // the typed route, and the four failures that carry canType are the ones
    // where typing is a real way out. This used to be the conversation's
    // privilege alone.
    return (
      <LiveErrorView
        failure={live.status.failure}
        message={live.status.message}
        diagnostics={live.diagnostics}
        onBack={onExit}
        onType={textMode ? undefined : () => onRetryAsText?.()}
      />
    );
  }

  if (!live.prompt) {
    // The room is open and the tutor has not spoken yet. This used to be a bare
    // spinner with no words and no way out, which is what a down agent looked
    // like — forever. The hook's watchdog now ends this state either way, and
    // there is a door while it lasts.
    return (
      <View style={st.center}>
        <ActivityIndicator color={paper.inkSoft} />
        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(3) }]}>
          {live.waitingForTutor ? 'Waiting for your tutor…' : 'One moment…'}
        </Text>
        <View style={{ marginTop: space(6) }}>
          <GhostButton label="Leave" onPress={leaveNow} />
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
            <Label>Tap to listen</Label>
          </Card>
        </Pressable>
      )}
      <View style={st.topRow}>
        {/* Transient trouble from the agent (a voice hiccup). The session is
            still live; this clears itself. */}
        <Text style={[type.small, { color: paper.inkSoft, flex: 1 }]}>{live.notice ?? ''}</Text>
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
        onHearLine={!live.tutorSpeaking && !textMode ? live.sendHear : undefined}
        // Saying it aloud is still the product, and the cards are still
        // read-along support while the learner has a voice to use. But a
        // carriage full of strangers is not a reason to finish a lesson having
        // said nothing: a tap is an answer, graded like any other, and counted
        // as an utterance nobody heard rather than one that went well.
        onOptionPress={live.sendChoice}
        onType={textMode ? live.sendSay : undefined}
      />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground },
  center: { flex: 1, backgroundColor: paper.ground, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(8) },
  listen: { minHeight: HIT, paddingHorizontal: space(5), paddingTop: space(3) },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(5), paddingTop: space(2) },
  leave: { minHeight: HIT, justifyContent: 'center', paddingLeft: space(3) },
});
