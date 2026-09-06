/**
 * The Tutor landing page — a calm moment before a live conversation.
 *
 * The page is a dashboard, not an instruction manual. It opens on the tutor,
 * offers the circle, and then the four ways back into French: a scene already
 * under way, the guided situations, the scripted lesson, or an open
 * conversation. Which doors those are, what they say and which of them carry a
 * pill is `tutor/gate.ts`; the
 * header and the two lines under it are `tutor/dashboard.ts`. This file draws
 * them and decides nothing, which is the only way a screen in this workspace
 * can be checked at all: there is no renderer here.
 *
 * The founder's screenshot took two marks off the resume card, a line off the
 * open conversation and the button out from beside the drawing. Each of those
 * removals is named in `TutorTab.test.ts`, so putting one back fails by name.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { CAFE_LESSON, MISSIONS, missionStates, type MissionProgress } from '@luvani/core';

import { ArrowRight, Card, GhostButton, HelpGlyph, Label, OutlineButton, PillButton } from '../components.tsx';
import { useLive } from '../app/LiveContext.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { EveningIn } from '../illustrations.tsx';
import { ScrollScreen, TabHeader } from '../layout.tsx';
import { MissionDisc } from '../missions/MissionDisc.tsx';
import { loadMissionCompletions } from '../missions/store.ts';
import { MICROPHONE_NOTICE, missionCompletionsFrom, resumableMission } from '../missions/chooserView.ts';
import { loadScenarioProgress, type ScenarioRecord } from '../missions/progressStore.ts';
import { minutesRemaining } from '../missions/resume.ts';
import { settleIn, useReduceMotion } from '../motion.ts';
import { loadDeck } from '../review/store.ts';
import { HIT, paper, space, type } from '../theme.ts';
import { TUTOR_ORB_SUBLINE, TUTOR_PURPOSE, tutorHeading } from '../tutor/dashboard.ts';
import {
  TUTOR_INTRO_LINK,
  TUTOR_LESSON_QUIET_LINK,
  TUTOR_OFFLINE,
  lessonStart,
  minutesRemainingLine,
  scenarioCountLine,
  tutorDoors,
  tutorGate,
} from '../tutor/gate.ts';
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
  /** Where the learner left each scene, which is what the minutes line reads. */
  const [records, setRecords] = useState<readonly ScenarioRecord[]>([]);
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
      void Promise.all([loadMissionCompletions(), loadDeck(), loadScenarioProgress()]).then(
        ([completions, deck, scenes]) => {
          if (cancelled) return;
          setRecords(scenes);
          // The records decide which scene comes back, not only how long is left
          // of it: a learner who walked out of the market half way through meant
          // the market, whatever the deck says is due.
          setResume(resumableMission(missionStates(missionCompletionsFrom(completions), deck, Date.now()), scenes));
        },
      );
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

  /**
   * The scripted lesson, probed the same way and refused by nothing.
   *
   * Same guard as `open` above: one probe in flight, one lesson. What differs
   * is the answer it is allowed to give. `tutorGate` can hold a learner back
   * from a conversation because there is no conversation without a server; the
   * lesson falls back to the mock session, so `lessonStart` opens either way
   * and the learner lands on the live lesson or the honest demo of it. `go` is
   * passed twice so a probe that ever threw still lets go of the flag instead
   * of retiring the tab.
   */
  const openLesson = (textMode: boolean) => {
    if (checking) return;
    setChecking(true);
    const go = () => {
      setChecking(false);
      const start = lessonStart(textMode);
      nav.navigate(start.screen, start.params);
    };
    void recheck().then(go, go);
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

  // `tutorDoors` owns the order, the words and which doors carry a pill. This
  // screen adds no competing rules about where a learner should go next.
  //
  // What is left of a scene is measured from the learner's own pace, in
  // `missions/resume.ts`. It is null until they have actually left one part way
  // through, and null for a scene they have finished since, and the card says
  // nothing rather than guessing in both cases. `beatsTotal` comes from the
  // catalogue here and is never stored, so a mission that gains a beat cannot
  // leave a stale total behind on a phone.
  const doors = tutorDoors(
    resume === null
      ? null
      : {
          title: resume.mission.title,
          goalEn: resume.mission.goalEn,
          place: resume.mission.place,
          minutesRemaining: minutesRemaining(
            records.find((record) => record.missionId === resume.mission.id) ?? null,
            resume.mission.beatIds.length,
            resume.lastFinishedAt,
          ),
        },
    MISSIONS.length,
    CAFE_LESSON.title,
  );

  const enter = (key: string) => {
    if (key === 'free') {
      open(false);
      return;
    }
    if (key === 'lesson') {
      openLesson(false);
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
        <TabHeader title={tutorHeading(tutorName)} purpose={TUTOR_PURPOSE} />

        <Card style={st.speakCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Start a spoken conversation with ${tutorName}`}
            accessibilityHint="Opens a conversation when the connection is ready"
            disabled={checking}
            onPress={() => open(false)}
            style={({ pressed }) => [st.speakPressable, pressed && !checking && st.pressed]}
          >
            {/* The card says the words here, so the orb says none: its own
                caption would land on top of the two lines below it, which is
                exactly what it did until F415. */}
            <VoiceOrb state={checking ? 'thinking' : 'ready'} size={116} announce={false} withCaption={false} />
            <Text style={st.speakTitle}>{checking ? TUTOR_OFFLINE.checking : 'Tap to speak'}</Text>
            <Text style={st.speakSubline}>{TUTOR_ORB_SUBLINE}</Text>
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

        {/* Each card is still a gate-owned door, drawn in the order the model
            gives. Keeping the map and the model fields together makes the
            friendly visual treatment unable to drift into a different order or
            a different promise. */}
        <View style={st.doors}>
          {doors.map((door) => (
            <Card key={door.key} style={st.doorCard}>
              {door.key === 'resume' && (
                <>
                  <Label>{door.label}</Label>
                  <View style={st.resumeHead}>
                    {door.art.kind === 'place' && <MissionDisc place={door.art.place} size={56} />}
                    <View style={st.doorWords}>
                      {door.title !== null && <Text style={[type.title, { color: paper.ink }]}>{door.title}</Text>}
                      <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{door.gloss}</Text>
                      {door.minutesRemaining !== null && (
                        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{minutesRemainingLine(door.minutesRemaining)}</Text>
                      )}
                    </View>
                  </View>
                  <View style={st.doorAction}>
                    <PillButton label={door.action} onPress={() => enter(door.key)} disabled={checking} />
                  </View>
                </>
              )}

              {door.key === 'missions' && (
                <>
                  <View style={st.headRow}>
                    <View style={st.headWords}>
                      <Label>{door.label}</Label>
                    </View>
                    {door.count !== null && (
                      <Text style={[type.small, { color: paper.inkSoft, textAlign: 'right' }]}>{scenarioCountLine(door.count)}</Text>
                    )}
                  </View>
                  <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{door.gloss}</Text>
                  <View style={st.rows}>
                    {MISSIONS.map((mission) => (
                      <Pressable
                        key={mission.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${mission.titleEn}. ${mission.goalEn}`}
                        disabled={checking}
                        onPress={() => nav.navigate('Missions', { focus: mission.id })}
                        style={({ pressed }) => [st.row, pressed && !checking && st.pressed]}
                      >
                        <MissionDisc place={mission.place} size={48} />
                        <View style={st.rowWords}>
                          <Text style={[type.bodyStrong, { color: paper.ink }]}>{mission.titleEn}</Text>
                          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{mission.goalEn}</Text>
                        </View>
                        <ArrowRight />
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              {door.key === 'lesson' && (
                <>
                  <Label>{door.label}</Label>
                  <View style={st.resumeHead}>
                    {door.art.kind === 'place' && <MissionDisc place={door.art.place} size={56} />}
                    <View style={st.doorWords}>
                      {door.title !== null && <Text style={[type.title, { color: paper.ink }]}>{door.title}</Text>}
                      <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{door.gloss}</Text>
                    </View>
                  </View>
                  <View style={st.doorAction}>
                    <OutlineButton label={door.action} onPress={() => enter(door.key)} disabled={checking} />
                  </View>
                  {/* The lesson's own quiet way in, because it is the one live
                      screen that offers no typed door until something breaks.
                      The footer's control keeps pointing at the conversation. */}
                  <View style={st.lessonQuiet}>
                    <GhostButton label={TUTOR_LESSON_QUIET_LINK} disabled={checking} onPress={() => openLesson(true)} />
                  </View>
                </>
              )}

              {door.key === 'free' && (
                <>
                  <Label>{door.label}</Label>
                  {door.title !== null && <Text style={[type.title, { color: paper.ink, marginTop: space(1) }]}>{door.title}</Text>}
                  <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{door.gloss}</Text>
                  <View style={st.scene}>
                    <EveningIn width={176} paused={!focused} />
                  </View>
                  <View style={st.doorAction}>
                    <PillButton label={door.action} onPress={() => enter(door.key)} disabled={checking} />
                  </View>
                </>
              )}
            </Card>
          ))}
        </View>

        <View style={st.quiet}>
          <GhostButton label="Unable to speak right now?" disabled={checking} onPress={() => open(true)} />
          <View style={st.introRow}>
            <HelpGlyph />
            <GhostButton label={TUTOR_INTRO_LINK} disabled={checking} onPress={() => setShowingIntro(true)} />
          </View>
          <Text style={st.notice}>{MICROPHONE_NOTICE}</Text>
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
  doors: { marginTop: space(6), gap: space(3) },
  doorCard: { padding: space(4) },
  // The disc and the words sit on one row, and the words take what is left, so
  // a long title wraps instead of pushing the card sideways at large text.
  resumeHead: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(2) },
  doorWords: { flex: 1 },
  headRow: { flexDirection: 'row', alignItems: 'baseline', gap: space(2) },
  headWords: { flex: 1 },
  rows: { marginTop: space(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: HIT, paddingVertical: space(2) },
  rowWords: { flex: 1 },
  scene: { alignItems: 'center', marginTop: space(3) },
  doorAction: { marginTop: space(4) },
  lessonQuiet: { marginTop: space(1), alignItems: 'center' },
  quiet: { marginTop: 'auto', paddingTop: space(6), gap: space(1) },
  introRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(2) },
  notice: { ...type.small, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
});
