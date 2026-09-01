/**
 * Tutor — three doors, and no manual in front of them.
 *
 * What was here before: a four-page explainer that every learner had to read
 * once before the tab would show them anything, and then a single invitation to
 * "talk about anything". Both are gone from the critical path. The explainer is
 * a link now, and "anything" is the last of three doors rather than the only
 * one, because a beginner asked to say anything says nothing.
 *
 * The doors themselves are decided in `tutor/gate.ts`, where a test can read
 * them: which ones exist, in what order, and which single one carries the solid
 * pill. Continue only appears when there is something to continue.
 *
 * Both routes into a conversation are still always offered, spoken and typed.
 * The typed one in particular used to sit behind a gate a learner who cannot
 * speak could never pass, which is precisely backwards.
 */

import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { missionStates, type MissionProgress } from '@luvani/core';
import { paper, space, type, radius, HAIRLINE, HIT } from '../theme.ts';
import { PillButton, GhostButton, OutlineButton, Card, Label } from '../components.tsx';
import { SpeakBubbles } from '../illustrations.tsx';
import { useLive } from '../app/LiveContext.tsx';
import { TutorIntro } from '../tutor/TutorIntro.tsx';
import { TUTOR_INTRO_LINK, TUTOR_OFFLINE, tutorDoors, tutorGate } from '../tutor/gate.ts';
import { markTutorIntroSeen } from '../tutor/store.ts';
import { TUTOR_NAME } from '../tutor/tutorName.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { missionCompletionsFrom, resumableMission } from '../missions/chooserView.ts';
import { loadDeck } from '../review/store.ts';

export function TutorTab() {
  // A bottom tab stays mounted after its first visit, so a looping scene here
  // keeps animating behind whatever the learner is actually doing. The scene
  // cannot ask for itself — useIsFocused throws outside a NavigationContainer,
  // and several scenes render above the navigator — so the tab passes it down.
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { live, recheck } = useLive();

  /** The explainer, on request. It no longer decides anything. */
  const [showingIntro, setShowingIntro] = useState(false);

  const [resume, setResume] = useState<MissionProgress | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([loadMissionCompletions(), loadDeck()]).then(([completions, deck]) => {
        if (cancelled) return;
        setResume(resumableMission(missionStates(missionCompletionsFrom(completions), deck, Date.now())));
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // The start that was asked for and did not happen, route included. The Demo
  // mode card is already on the screen saying why; this is what turns it from a
  // note into an answer, with the way forward attached. It holds the attempt
  // rather than a flag because Check again has to be the SAME start: a learner
  // who tapped the quiet door and is retrying from a train must not be dropped
  // into a voice session for waiting.
  const [heldBack, setHeldBack] = useState<{ textMode: boolean } | null>(null);
  const [checking, setChecking] = useState(false);

  const open = (textMode: boolean) => {
    // Probe again at the moment of starting, so a server that came up after
    // launch is used and one that just died is not. The answer decides: this
    // used to navigate either way, which walked a learner the app had just told
    // "Demo mode" into a live screen whose only control is Back.
    if (checking) return; // One probe in flight is enough; two would open two rooms.
    setChecking(true);
    void recheck().then((answered) => {
      setChecking(false);
      const decision = tutorGate(answered, textMode);
      if (!decision.go) {
        setHeldBack(decision.heldBack);
        return;
      }
      setHeldBack(null);
      nav.navigate(decision.screen, decision.params);
    });
  };

  if (showingIntro) {
    return (
      <TutorIntro
        onDone={() => {
          // Still remembered, because the flag is what "has read this" means.
          // Nothing gates on it any more.
          void markTutorIntroSeen();
          setShowingIntro(false);
        }}
      />
    );
  }

  const doors = tutorDoors(resume === null ? null : { title: resume.mission.title });

  const enter = (key: string) => {
    if (key === 'free') {
      open(false);
      return;
    }
    // Both mission doors open the chooser. Continuing a mission still goes
    // through it rather than starting the room straight away, because the
    // chooser is where a learner can see they are about to spend minutes.
    //
    // The Continue door carries the mission it named, so the screen leads with
    // that one. Without it the door glossed itself with one title and the
    // screen offered whichever mission `suggestedMission` preferred, which for
    // anyone with a phrase falling due was a different mission entirely.
    nav.navigate('Missions', key === 'resume' && resume ? { focus: resume.mission.id } : undefined);
  };

  return (
    <View style={[st.root, { paddingTop: insets.top + space(4) }]}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        <View style={st.hero}>
          <SpeakBubbles width={150} paused={!focused} />
        </View>

        <Text style={st.headline}>Ready to talk?</Text>
        <Text style={st.subline}>{`${TUTOR_NAME} remembers you. Pick a situation, or just start talking.`}</Text>

        {!live && (
          <Card style={{ marginTop: space(5) }}>
            <Label>{TUTOR_OFFLINE.label}</Label>
            <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(2) }]}>{TUTOR_OFFLINE.headline}</Text>
            {heldBack !== null && (
              <>
                <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{TUTOR_OFFLINE.body}</Text>
                <View style={{ marginTop: space(3) }}>
                  {/* Secondary on purpose: the pill below is still this
                      screen's one primary action, and this is the door back to
                      it rather than a second front door. It retries the route
                      the learner picked, not the one this tab prefers. */}
                  <OutlineButton
                    label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry}
                    disabled={checking}
                    onPress={() => open(heldBack.textMode)}
                  />
                </View>
              </>
            )}
          </Card>
        )}

        <View style={st.doors}>
          {doors.map((door) =>
            door.primary ? (
              <View key={door.key}>
                <PillButton label={door.label} onPress={() => enter(door.key)} disabled={checking} />
                <Text style={st.doorGloss}>{door.gloss}</Text>
              </View>
            ) : (
              <Pressable
                key={door.key}
                onPress={() => enter(door.key)}
                accessibilityRole="button"
                accessibilityLabel={`${door.label}. ${door.gloss}`}
                style={({ pressed }) => [st.door, pressed && { backgroundColor: paper.groundDeep }]}
              >
                <Text style={[type.bodyStrong, { color: paper.ink }]}>{door.label}</Text>
                <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{door.gloss}</Text>
              </Pressable>
            ),
          )}
        </View>

        <View style={st.quiet}>
          <GhostButton label="Unable to speak right now?" onPress={() => open(true)} />
          <GhostButton label={TUTOR_INTRO_LINK} onPress={() => setShowingIntro(true)} />
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  scroll: { flexGrow: 1, paddingTop: space(4), paddingBottom: space(3) },
  hero: { alignItems: 'center', marginBottom: space(3) },
  headline: { ...type.display, color: paper.ink, textAlign: 'center' },
  subline: { ...type.body, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
  doors: { marginTop: space(6), gap: space(3) },
  doorGloss: { ...type.small, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
  door: {
    minHeight: HIT,
    justifyContent: 'center',
    backgroundColor: paper.card,
    borderRadius: radius.card,
    borderWidth: HAIRLINE,
    borderColor: paper.lineOnCard,
    paddingVertical: space(3),
    paddingHorizontal: space(4),
  },
  quiet: { marginTop: 'auto', paddingTop: space(6), gap: space(1) },
});
