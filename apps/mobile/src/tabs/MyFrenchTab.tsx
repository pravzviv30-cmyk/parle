import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { missionStates, type MissionProgress } from '@parle/core';

import { Card, Label, OutlineButton, PillButton, Stat } from '../components.tsx';
import { paper, radius, signal, space, type, HAIRLINE, HIT } from '../theme.ts';
import { loadDeck } from '../review/store.ts';
import { loadTopics } from '../topics/store.ts';
import { buildPhrasebook, type Phrasebook } from '../phrases/phrasebook.ts';
import { PhrasebookScreen } from '../phrases/PhrasebookScreen.tsx';
import { loadMissionCompletions } from '../missions/store.ts';
import { missionCompletionsFrom, missionStatus } from '../missions/chooserView.ts';
import { MissionArt } from '../missions/MissionArt.tsx';
import { loadSoundChecks } from '../soundcheck/store.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import { trackProductEvent } from '../analytics/track.ts';
import { hasStamps, isStamped, stampLabel, stampsFrom } from '../progress/passport.ts';

/** The stamp mark, at TodayRow's size, because it is TodayRow's mark. */
const MARK = 10;

function latestCheck(missionId: string, checks: readonly SoundCheckEvidence[]): SoundCheckEvidence | null {
  return checks
    .filter((item) => item.missionId === missionId)
    .sort((a, b) => b.at - a.at)[0] ?? null;
}

function checkLine(check: SoundCheckEvidence | null): string | null {
  if (!check) return null;
  if (check.kind === 'assessed-focus') return check.focus ?? 'One sound is ready to revisit';
  if (check.kind === 'assessed-clear') return 'No single sound needed calling out';
  if (check.kind === 'self-guided') return 'Last line was practised without assessment';
  return 'Last check did not return enough evidence';
}

/**
 * Durable, personal evidence replaces the placeholder social leaderboard.
 *
 * The marks down the situations list are the passport, and every judgement in
 * them is made in `progress/passport.ts`. This file asks `isStamped` and picks a
 * style; it never asks what rung anybody reached. That is the whole reason the
 * module exists, and a ternary on `independence` here would be a second ladder
 * one screen away from the first.
 */
export function MyFrenchTab() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const [missions, setMissions] = useState<readonly MissionProgress[]>([]);
  const [checks, setChecks] = useState<readonly SoundCheckEvidence[]>([]);
  const [book, setBook] = useState<Phrasebook>({ groups: [], count: 0, topics: 0 });
  const [showingPhrases, setShowingPhrases] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([loadMissionCompletions(), loadDeck(), loadTopics(), loadSoundChecks()]).then(
        ([completions, deck, topics, soundChecks]) => {
          if (cancelled) return;
          const now = Date.now();
          const nextMissions = missionStates(missionCompletionsFrom(completions), deck, now);
          const nextBook = buildPhrasebook(deck, topics, now);
          setMissions(nextMissions);
          setBook(nextBook);
          setChecks(soundChecks);
          void trackProductEvent({
            name: 'my_french_opened',
            properties: {
              situationsDone: nextMissions.filter((item) => item.timesFinished > 0).length,
              linesKept: nextBook.count,
            },
          });
        },
      );
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (showingPhrases) return <PhrasebookScreen book={book} onDone={() => setShowingPhrases(false)} />;

  const finished = missions.filter((item) => item.timesFinished > 0).length;
  const independent = missions.filter((item) => item.independence === 'on-your-own').length;

  // Keyed rather than indexed: `stampsFrom` answers in the order it was given,
  // and a lookup by id stays right the first time somebody filters this list.
  const stamps = stampsFrom(missions);
  const stampByMission = new Map(stamps.map((stamp) => [stamp.missionId, stamp]));
  // Nothing is drawn until one has been earned. A rail of empty marks is a
  // quota, which is the thing progress/today.ts refuses to render.
  const showStamps = hasStamps(stamps);

  return (
    <View style={[st.root, { paddingTop: insets.top + space(4) }]}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        <Text style={st.title}>My French</Text>
        <Text style={st.sub}>The situations you have handled and the lines you have made yours.</Text>

        <View style={st.stats}>
          <Stat value={String(finished)} label="Situations done" />
          <Stat value={String(independent)} label="On your own" />
          <Stat value={String(book.count)} label="Phrases kept" />
        </View>

        {book.count > 0 && (
          <Card style={{ marginTop: space(6) }}>
            <Label>Your notebook</Label>
            <Text style={[type.title, { color: paper.ink, marginTop: space(2) }]}>What you can say now</Text>
            <Text style={[type.body, { color: paper.inkSoft, marginTop: space(1) }]}>
              {book.count} {book.count === 1 ? 'line' : 'lines'} from your own conversations and practice.
            </Text>
            <View style={{ marginTop: space(4) }}>
              <OutlineButton label="Open my phrases" onPress={() => setShowingPhrases(true)} />
            </View>
          </Card>
        )}

        <View style={st.section}>
          <Label color={paper.inkFaint}>Your situations</Label>
          {missions.map((item) => {
            const check = latestCheck(item.mission.id, checks);
            const stamp = stampByMission.get(item.mission.id);
            return (
              <View key={item.mission.id} style={st.mission}>
                <View style={st.art}>
                  <MissionArt place={item.mission.place} width={74} paused />
                </View>
                {showStamps && stamp && (
                  <View
                    style={[st.stampMark, isStamped(stamp) ? st.stampEarned : st.stampNotYet]}
                    accessibilityRole="image"
                    accessibilityLabel={stampLabel(stamp)}
                  />
                )}
                <View style={st.words}>
                  <Text style={[type.bodyStrong, { color: paper.ink }]}>{item.mission.title}</Text>
                  <Text style={[type.small, { color: paper.inkSoft }]}>{item.mission.titleEn}</Text>
                  <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>
                    {missionStatus(item.state, item.independence)}
                  </Text>
                  {checkLine(check) && <Text style={[type.small, st.check]}>{checkLine(check)}</Text>}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.timesFinished > 0 ? `Sound check for ${item.mission.titleEn}` : `Start ${item.mission.titleEn}`}
                  onPress={() =>
                    item.timesFinished > 0
                      ? nav.navigate('SoundCheck', { missionId: item.mission.id })
                      : (void trackProductEvent({
                          name: 'mission_started',
                          properties: { missionId: item.mission.id, entry: 'my-french' },
                        }), nav.navigate('Convo', { missionId: item.mission.id }))
                  }
                  style={({ pressed }) => [st.smallAction, pressed && { opacity: 0.6 }]}
                >
                  <Text style={[type.button, { color: paper.ink }]}>{item.timesFinished > 0 ? 'Check' : 'Start'}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        <View style={{ marginTop: space(6) }}>
          <PillButton label="Choose another situation" onPress={() => nav.navigate('Missions')} />
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  scroll: { paddingBottom: space(7) },
  title: { ...type.display, color: paper.ink },
  sub: { ...type.body, color: paper.inkSoft, marginTop: space(2) },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space(4), marginTop: space(6) },
  section: { marginTop: space(7), gap: space(3) },
  mission: {
    minHeight: HIT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(3),
    backgroundColor: paper.card,
    borderRadius: radius.card,
    borderWidth: HAIRLINE,
    borderColor: paper.lineOnCard,
  },
  art: { width: 78, alignItems: 'center' },
  // TodayRow's two marks, the same size and the same grammar: filled means the
  // learner produced French, and a hairline is not a colour, because a thing
  // that has not happened is not a state worth signalling.
  stampMark: { width: MARK, height: MARK, borderRadius: MARK / 2 },
  stampEarned: { backgroundColor: signal.good },
  stampNotYet: { borderWidth: HAIRLINE + 0.4, borderColor: paper.line },
  words: { flex: 1 },
  check: { color: paper.ink, marginTop: space(1.5) },
  smallAction: { minWidth: HIT, minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
});
