/**
 * The chooser: six situations, one of them already picked.
 *
 * A stack screen, reached from three doors, because the same surface is needed
 * by a first run, by Home's mission card and by the Tutor tab. A first run
 * opens straight onto it, which is why the way out has to work even when there
 * is nothing behind this screen to go back to.
 *
 * Every rule on this page lives in `chooserView.ts`: which mission is first,
 * which one carries the solid pill, what each card says underneath, and whether
 * the promise line is on screen at all. What is left here is layout, which is
 * the only thing a file with no renderer behind it should be holding.
 *
 * Six cards need six pictures, or they are six identical rectangles with
 * different words on them. Four of the drawings are new and two already
 * existed, and none of them moves: the motion vocabulary is one loop per
 * screen, and six loops at the moment somebody is trying to choose is six
 * things pulling at the eye.
 */

import { useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../nav/types.ts';
import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { missionStates, type MissionProgress } from '@parle/core';
import { paper, space, type, radius, HAIRLINE, HIT } from '../theme.ts';
import { Card, ChevronLeft, GhostButton, PillButton } from '../components.tsx';
import { loadMissionCompletions } from './store.ts';
import { loadDeck } from '../review/store.ts';
import { loadActivity } from '../progress/activity.ts';
import { chooserView, hasSpokenBefore, missionCompletionsFrom, type ChooserCard } from './chooserView.ts';
import { MissionArt } from './MissionArt.tsx';
import { trackProductEvent } from '../analytics/track.ts';

export function MissionsScreen() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const nav = useNavigation<{
    goBack: () => void;
    canGoBack: () => boolean;
    navigate: (screen: string, params?: object) => void;
  }>();

  const [progress, setProgress] = useState<readonly MissionProgress[] | null>(null);
  const route = useRoute<RouteProp<RootStackParamList, 'Missions'>>();
  const [spokenBefore, setSpokenBefore] = useState(true);

  // Re-read on every return: a mission finished in the last ten minutes should
  // be reading as finished by the time the learner comes back to choose again.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([loadMissionCompletions(), loadDeck(), loadActivity()]).then(
        ([completions, deck, activity]) => {
          if (cancelled) return;
          setProgress(missionStates(missionCompletionsFrom(completions), deck, Date.now()));
          setSpokenBefore(hasSpokenBefore(activity));
        },
      );
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // A first run opens ON this screen, so there is nothing behind it to go back
  // to. Falling through to the tabs is the difference between a way out and a
  // dead end on the very first screen after signing up.
  const leave = () => {
    if (nav.canGoBack()) nav.goBack();
    else nav.navigate('Tabs');
  };

  const open = (card: ChooserCard) => {
    void trackProductEvent({ name: 'mission_started', properties: { missionId: card.mission.id, entry: 'chooser' } });
    nav.navigate(card.route.screen, card.route.params);
  };

  // Nothing has come back from the disk yet. The catalogue is fixed, so this is
  // one frame at most and drawing a spinner for it would flash.
  // `focus` is the mission a door on the previous screen already named. It
  // outranks the screen's own suggestion, so what was offered is what opens.
  const focus = route.params?.focus ?? null;
  const view = chooserView({ progress: progress ?? missionStates([], [], Date.now()), spokenBefore, focus });
  const [first, ...rest] = view.cards;

  return (
    <View style={[st.root, { paddingTop: insets.top + space(3) }]}>
      <View style={st.headerRow}>
        <Pressable onPress={leave} accessibilityRole="button" accessibilityLabel="Back" style={st.back}>
          <ChevronLeft />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        <Text style={st.headline}>{view.headline}</Text>
        <Text style={st.sub}>{view.sub}</Text>
        {view.promise !== null && <Text style={st.promise}>{view.promise}</Text>}
        {view.microphoneNotice !== null && <Text style={st.microphoneNotice}>{view.microphoneNotice}</Text>}

        {first && (
          <Card style={{ marginTop: space(6) }}>
            <View style={st.heroArt}>
              <MissionArt place={first.mission.place} width={200} paused={!focused} />
            </View>
            <Text style={st.heroTitle}>{first.mission.title}</Text>
            <Text style={st.heroSub}>{first.mission.titleEn}</Text>
            <Text style={st.goal}>{first.mission.goalEn}</Text>
            <Text style={st.status}>{first.status}</Text>
            <View style={{ marginTop: space(4) }}>
              <PillButton label="Start this one" onPress={() => open(first)} />
            </View>
          </Card>
        )}

        <View style={st.rows}>
          {rest.map((card) => (
            <Pressable
              key={card.id}
              onPress={() => open(card)}
              accessibilityRole="button"
              accessibilityLabel={`${card.mission.titleEn}. ${card.status}`}
              style={({ pressed }) => [st.row, pressed && { backgroundColor: paper.groundDeep }]}
            >
              <View style={st.rowArt}>
                <MissionArt place={card.mission.place} width={72} paused />
              </View>
              <View style={st.rowText}>
                <Text style={[type.bodyStrong, { color: paper.ink }]}>{card.mission.title}</Text>
                <Text style={[type.body, { color: paper.inkSoft }]}>{card.mission.titleEn}</Text>
                <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{card.status}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={st.footer}>
          <GhostButton label={view.talkFreely} onPress={() => nav.navigate('Convo')} />
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  back: { minHeight: HIT, minWidth: HIT, alignItems: 'flex-start', justifyContent: 'center' },
  scroll: { flexGrow: 1, paddingTop: space(2), paddingBottom: space(6) },
  headline: { ...type.display, color: paper.ink },
  sub: { ...type.body, color: paper.inkSoft, marginTop: space(2) },
  promise: { ...type.bodyStrong, color: paper.ink, marginTop: space(4) },
  microphoneNotice: { ...type.small, color: paper.inkSoft, marginTop: space(2) },
  heroArt: { alignItems: 'center', marginBottom: space(3) },
  heroTitle: { ...type.title, color: paper.ink },
  heroSub: { ...type.body, color: paper.inkSoft, marginTop: space(0.5) },
  goal: { ...type.body, color: paper.ink, marginTop: space(3) },
  status: { ...type.small, color: paper.inkSoft, marginTop: space(2) },
  rows: { marginTop: space(5), gap: space(3) },
  row: {
    minHeight: HIT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(4),
    backgroundColor: paper.card,
    borderRadius: radius.card,
    borderWidth: HAIRLINE,
    borderColor: paper.lineOnCard,
    padding: space(3),
  },
  rowArt: { alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  footer: { marginTop: space(6) },
});
