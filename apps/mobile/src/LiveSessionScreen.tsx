/**
 * The live session driver.
 *
 * Everything pedagogical happens in the agent; this screen connects, opens the
 * microphone, and renders what it is told. Note what is deliberately absent
 * compared to the mock: no silence timer (the agent runs the rescue), no grading,
 * no mic-press handler (the learner just talks), and option plaques are read-along
 * support rather than buttons — saying it aloud is the product.
 */

import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import type { Lesson, Rung, SessionSummary } from '@parle/core';
import { enamel, space, type, radius, HIT } from './theme.ts';
import { LabeledTag, Plaque } from './components.tsx';
import { SessionView } from './SessionView.tsx';
import { useLiveSession } from './live/useLiveSession.ts';

export function LiveSessionScreen({
  lesson,
  userId,
  startRung,
  onFinish,
  onExit,
}: {
  lesson: Lesson;
  userId: string;
  /** Where the ladder opens. The agent stays authoritative; this is a request. */
  startRung?: Rung;
  onFinish: (s: SessionSummary) => void;
  onExit: () => void;
}) {
  const live = useLiveSession(userId, lesson.id, startRung);

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
        <ActivityIndicator color={enamel.whiteMuted} />
        <Text style={[type.small, { color: enamel.whiteMuted, marginTop: space(3) }]}>Connexion au serveur…</Text>
        <Text style={[type.small, { color: enamel.whiteFaint, marginTop: space(0.5) }]}>Reaching the server</Text>
      </View>
    );
  }

  if (live.status.phase === 'out-of-minutes') {
    return (
      <View style={st.center}>
        <LabeledTag fr="TERMINUS" en="You are out of minutes" color={enamel.whiteFaint} />
        <Text style={[type.plaqueSmall, { color: enamel.white, marginTop: space(3), textAlign: 'center' }]}>
          {live.status.message}
        </Text>
        <Pressable onPress={onExit} accessibilityRole="button" style={({ pressed }) => [st.exit, pressed && { opacity: 0.8 }]}>
          <Text style={[type.tag, { color: enamel.white }]}>RETOUR · BACK</Text>
        </Pressable>
      </View>
    );
  }

  if (live.status.phase === 'error') {
    return (
      <View style={st.center}>
        <LabeledTag fr="PERTURBATION" en="Connection problem" color={enamel.whiteFaint} />
        <Text style={[type.body, { color: enamel.whiteMuted, marginTop: space(3), textAlign: 'center' }]}>
          {live.status.message}
        </Text>
        <Pressable onPress={onExit} accessibilityRole="button" style={({ pressed }) => [st.exit, pressed && { opacity: 0.8 }]}>
          <Text style={[type.tag, { color: enamel.white }]}>RETOUR · BACK</Text>
        </Pressable>
      </View>
    );
  }

  if (!live.prompt) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={enamel.whiteMuted} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {live.audioBlocked && (
        // The browser wants a gesture before it will play the tutor. One calm
        // white notice, gone the moment it is tapped.
        <Pressable
          onPress={live.resumeAudio}
          accessibilityRole="button"
          style={({ pressed }) => [st.listen, pressed && { opacity: 0.85 }]}
        >
          <Plaque tone="white">
            <LabeledTag fr="TOUCHEZ POUR ÉCOUTER" en="Tap to hear your tutor" color="rgba(15,59,44,0.6)" />
          </Plaque>
        </Pressable>
      )}
      <View style={st.topRow}>
        {/* Transient trouble from the agent (a voice hiccup). The session is
            still live; this clears itself. */}
        <Text style={[type.small, { color: enamel.whiteMuted, flex: 1 }]}>{live.notice ?? ''}</Text>
        {/* Metered minutes must always have a door. */}
        <Pressable
          onPress={leaveNow}
          accessibilityRole="button"
          accessibilityLabel="Leave the lesson"
          style={({ pressed }) => [st.leave, pressed && { opacity: 0.6 }]}
        >
          <Text style={[type.tag, { color: enamel.whiteMuted }]}>SORTIE · LEAVE</Text>
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
        onHearLine={!live.tutorSpeaking ? live.sendHear : undefined}
      />
    </View>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, backgroundColor: enamel.ground, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(8) },
  listen: { minHeight: HIT, paddingHorizontal: space(5), paddingTop: space(3) },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(5), paddingTop: space(2) },
  leave: { minHeight: HIT, justifyContent: 'center', paddingLeft: space(3) },
  exit: {
    marginTop: space(6),
    minHeight: HIT,
    paddingHorizontal: space(6),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: enamel.white,
    borderRadius: radius.plaque,
  },
});
