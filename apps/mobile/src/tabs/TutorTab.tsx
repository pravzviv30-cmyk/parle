/**
 * The Tutor landing page — a calm moment before a live conversation.
 *
 * The page is intentionally a dashboard, not an instruction manual. It offers
 * one direct spoken door, then the useful ways back into French: a situation
 * already under way, practical missions, or an open conversation. The decision
 * about those doors still lives in `tutor/gate.ts`; this component only gives
 * that model a warmer, more glanceable home.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { MISSIONS, missionStates, type MissionProgress } from '@luvani/core';

import { Card, GhostButton, Label, OutlineButton, PillButton } from '../components.tsx';
import { useLive } from '../app/LiveContext.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { SpeakBubbles } from '../illustrations.tsx';
import { ScrollScreen, TabHeader } from '../layout.tsx';
import { MissionDisc } from '../missions/MissionDisc.tsx';
import { loadMissionCompletions } from '../missions/store.ts';
import { missionCompletionsFrom, missionStatus, resumableMission } from '../missions/chooserView.ts';
import { settleIn, useReduceMotion } from '../motion.ts';
import { loadDeck } from '../review/store.ts';
import { paper, space, type } from '../theme.ts';
import { tutorGreeting, tutorGreetingSubline } from '../tutor/dashboard.ts';
import { TUTOR_INTRO_LINK, TUTOR_OFFLINE, tutorDoors, tutorGate } from '../tutor/gate.ts';
import { TutorIntro } from '../tutor/TutorIntro.tsx';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { VoiceOrb } from '../tutor/VoiceOrb.tsx';
import { markTutorIntroSeen } from '../tutor/store.ts';

export function TutorTab() {
  const focused = useIsFocused();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { live, recheck } = useLive();
  const { profile } = useProfile();
  const tutorName = tutorNameOf(profile);
  const reduced = useReduceMotion();
  const entry = useRef(new Animated.Value(0)).current;

  /** The explainer is available on request, never in front of a conversation. */
  const [showingIntro, setShowingIntro] = useState(false);
  const [resume, setResume] = useState<MissionProgress | null>(null);
  const [heldBack, setHeldBack] = useState<{ textMode: boolean } | null>(null);
  const [checking, setChecking] = useState(false);

  // The dashboard settles in when the tab is opened. The voice orb carries its
  // own slower breathing loop; this is only the page arriving, and it lands on
  // the final frame immediately for learners who reduce motion.
  useEffect(() => {
    if (!focused) return;
    entry.setValue(0);
    const animation = settleIn(entry, reduced);
    return () => animation?.stop();
  }, [entry, focused, reduced]);

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

  const open = (textMode: boolean) => {
    // A second tap while the connection check runs cannot open a second room.
    if (checking) return;
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
          void markTutorIntroSeen();
          setShowingIntro(false);
        }}
      />
    );
  }

  // `tutorDoors` owns the order, labels and single primary action. This screen
  // adds no competing rules about where a learner should go next.
  const doors = tutorDoors(
    resume === null
      ? null
      : {
          title: resume.mission.title,
          titleEn: resume.mission.titleEn,
          place: resume.mission.place,
          status: missionStatus(resume.state, resume.independence),
        },
  );

  const enter = (key: string) => {
    if (key === 'free') {
      open(false);
      return;
    }
    // The chooser makes a mission choice visible before a session spends any
    // time. A resume door therefore focuses its situation instead of skipping
    // this useful confirmation.
    nav.navigate('Missions', key === 'resume' && resume ? { focus: resume.mission.id } : undefined);
  };

  const entryStyle = {
    opacity: entry,
    transform: [{ translateY: entry.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  };

  return (
    <ScrollScreen bottom="tab">
      <Animated.View style={[st.scroll, entryStyle]}>
        <TabHeader title={tutorGreeting(profile.name)} purpose={`Speak naturally with ${tutorName}. Gentle guidance, zero judgement.`} />

        <Card style={st.speakCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Start a spoken conversation with ${tutorName}`}
            accessibilityHint="Opens a conversation when the connection is ready"
            disabled={checking}
            onPress={() => open(false)}
            style={({ pressed }) => [st.speakPressable, pressed && !checking && st.pressed]}
          >
            <VoiceOrb state={checking ? 'thinking' : 'ready'} size={116} announce={false} />
            <Text style={st.speakTitle}>{checking ? TUTOR_OFFLINE.checking : 'Tap to speak'}</Text>
            <Text style={st.speakSubline}>{tutorGreetingSubline(tutorName)}</Text>
          </Pressable>
        </Card>

        {checking && <Text accessibilityLiveRegion="polite" style={st.checking}>{TUTOR_OFFLINE.checking}</Text>}

        {!live && (
          <Card style={st.offline}>
            <Label>{TUTOR_OFFLINE.label}</Label>
            <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(2) }]}>{TUTOR_OFFLINE.headline}</Text>
            {heldBack !== null && (
              <>
                <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{TUTOR_OFFLINE.body}</Text>
                <View style={{ marginTop: space(3) }}>
                  <OutlineButton label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry} disabled={checking} onPress={() => open(heldBack.textMode)} />
                </View>
              </>
            )}
          </Card>
        )}

        <View style={st.sectionTitle}>
          <Label>Your next step</Label>
        </View>

        {/* Each dashboard card is still a gate-owned door. Keeping the map and
            the model fields together makes the friendly visual treatment unable
            to drift into a different order or a different promise. */}
        <View style={st.doors}>
          {doors.map((door) => (
            <Card key={door.key} style={[st.doorCard, door.key === 'resume' && st.resumeCard]}>
              <View style={st.doorHead}>
                {door.art.kind === 'place' && <MissionDisc place={door.art.place} size={56} />}
                {door.key === 'free' && <SpeakBubbles width={72} paused={!focused} />}
                <View style={st.doorWords}>
                  <Label>{door.key === 'resume' ? 'Resume' : door.key === 'missions' ? 'Guided practice missions' : 'Open conversation'}</Label>
                  <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(1) }]}>{door.label}</Text>
                  {door.title !== null && <Text style={[type.title, { color: paper.ink, marginTop: space(1) }]}>{door.title}</Text>}
                  <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{door.gloss}</Text>
                  {door.detail.map((line) => (
                    <Text key={line} style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{line}</Text>
                  ))}
                </View>
              </View>

              {door.art.kind === 'every-place' && (
                <View style={st.teaser}>
                  {MISSIONS.map((mission) => <MissionDisc key={mission.id} place={mission.place} size={38} />)}
                </View>
              )}

              <View style={st.doorAction}>
                {door.primary ? (
                  <PillButton label={door.action} onPress={() => enter(door.key)} disabled={checking} />
                ) : (
                  <OutlineButton label={door.action} onPress={() => enter(door.key)} disabled={checking} />
                )}
              </View>
            </Card>
          ))}
        </View>

        <View style={st.quiet}>
          <GhostButton label="Unable to speak right now?" disabled={checking} onPress={() => open(true)} />
          <GhostButton label={TUTOR_INTRO_LINK} disabled={checking} onPress={() => setShowingIntro(true)} />
        </View>
      </Animated.View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  scroll: { flexGrow: 1 },
  speakCard: { marginTop: space(5), padding: 0, overflow: 'hidden', backgroundColor: paper.card },
  speakPressable: { alignItems: 'center', paddingHorizontal: space(5), paddingVertical: space(5) },
  pressed: { opacity: 0.72 },
  speakTitle: { ...type.heading, color: paper.ink, marginTop: space(2), textAlign: 'center' },
  speakSubline: { ...type.small, color: paper.inkSoft, marginTop: space(1), textAlign: 'center' },
  checking: { ...type.small, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
  offline: { marginTop: space(4) },
  sectionTitle: { marginTop: space(6) },
  doors: { marginTop: space(2), gap: space(3) },
  doorCard: { padding: space(4) },
  resumeCard: { borderColor: paper.line },
  doorHead: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  doorWords: { flex: 1 },
  teaser: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(3) },
  doorAction: { marginTop: space(3) },
  quiet: { marginTop: 'auto', paddingTop: space(6), gap: space(1) },
});
