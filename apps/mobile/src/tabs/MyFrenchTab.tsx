import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { missionStates, suggestedMission, type MissionProgress } from '@luvani/core';

import { Card, GhostButton, Label, OutlineButton, PillButton } from '../components.tsx';
import { ScrollScreen, TabHeader } from '../layout.tsx';
import { paper, radius, signal, space, type, HAIRLINE, HIT } from '../theme.ts';
import { loadDeck } from '../review/store.ts';
import { loadTopics } from '../topics/store.ts';
import { buildPhrasebook, hasPhrases, type Phrasebook } from '../phrases/phrasebook.ts';
import { NEXT_SITUATION, situationAction, startLabel } from '../progress/portfolio.ts';
import { PhrasebookScreen } from '../phrases/PhrasebookScreen.tsx';
import { loadMissionCompletions } from '../missions/store.ts';
import { missionCompletionsFrom, missionStatus } from '../missions/chooserView.ts';
import { MissionArt } from '../missions/MissionArt.tsx';
import { loadSoundChecks } from '../soundcheck/store.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import { trackProductEvent } from '../analytics/track.ts';
import { hasStamps, isStamped, stampLabel, stampsFrom } from '../progress/passport.ts';
import { hasStory, storyFrom, type WeekStory } from '../progress/story.ts';
import { loadHistory } from '../progress/store.ts';

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
 *
 * The week's account above the passport works the same way and for the same
 * reason. `progress/story.ts` reads the whole history, narrows it to seven local
 * days and writes every word; this file passes the history in, asks `hasStory`
 * and draws the sentences in the order they came back. There is no conditional
 * here about what the week contained, because a second opinion about a week is
 * how two screens end up telling a learner two different things about it.
 *
 * It is drawn here, in a tab somebody opened, and nowhere else. That is the
 * on-demand half of "read on demand, never pushed"; the other half is held from
 * the far side, where nothing under `reminders/` may import `progress/` at all.
 */
export function MyFrenchTab() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const [missions, setMissions] = useState<readonly MissionProgress[]>([]);
  const [checks, setChecks] = useState<readonly SoundCheckEvidence[]>([]);
  const [book, setBook] = useState<Phrasebook>({ groups: [], count: 0, topics: 0 });
  const [showingPhrases, setShowingPhrases] = useState(false);
  // null is "not read yet", which draws the same as a quiet week and is not the
  // same claim. The empty story is story.ts's to make, not this screen's.
  const [story, setStory] = useState<WeekStory | null>(null);
  // The next situation to walk into, from core, exactly as Home reads it. This
  // screen draws it and never decides which one; null draws nothing.
  const [next, setNext] = useState<MissionProgress | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([
        loadMissionCompletions(),
        loadDeck(),
        loadTopics(),
        loadSoundChecks(),
        loadHistory(),
      ]).then(
        ([completions, deck, topics, soundChecks, history]) => {
          if (cancelled) return;
          const now = Date.now();
          const nextMissions = missionStates(missionCompletionsFrom(completions), deck, now);
          const nextBook = buildPhrasebook(deck, topics, now);
          setMissions(nextMissions);
          setBook(nextBook);
          setChecks(soundChecks);
          setNext(suggestedMission(nextMissions));
          // The whole history, unnarrowed. Which seven days count is story.ts's
          // decision and filtering here would walk straight past it.
          setStory(storyFrom(history, now));
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

  // Keyed rather than indexed: `stampsFrom` answers in the order it was given,
  // and a lookup by id stays right the first time somebody filters this list.
  const stamps = stampsFrom(missions);
  const stampByMission = new Map(stamps.map((stamp) => [stamp.missionId, stamp]));
  // Nothing is drawn until one has been earned. A rail of empty marks is a
  // quota, which is the thing progress/today.ts refuses to render.
  const showStamps = hasStamps(stamps);

  return (
    <ScrollScreen bottom="tab">
      <View style={st.scroll}>
        <TabHeader
          title="My French"
          purpose="The situations you have handled and the lines you have made yours."
        />

        {hasPhrases(book) && (
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

        {story !== null && hasStory(story) && (
          <View style={st.week} accessibilityRole="summary">
            <Label>Your week</Label>
            {story.sentences.map((sentence) => (
              <Text key={sentence} style={[type.body, { color: paper.ink }]}>
                {sentence}
              </Text>
            ))}
          </View>
        )}

        <View style={st.section}>
          <Label>Your situations</Label>
          {missions.map((item) => {
            const check = latestCheck(item.mission.id, checks);
            const stamp = stampByMission.get(item.mission.id);
            // The verb, the label and the screen-reader sentence come from
            // portfolio.ts. The row branches on kind and spells none of it.
            const action = situationAction(item);
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
                <GhostButton
                  label={action.label}
                  color={paper.ink}
                  accessibilityLabel={action.accessibilityLabel}
                  onPress={() =>
                    action.kind === 'refine'
                      ? nav.navigate('SoundCheck', { missionId: item.mission.id })
                      : (void trackProductEvent({
                          name: 'mission_started',
                          properties: { missionId: item.mission.id, entry: 'my-french' },
                        }), nav.navigate('Convo', { missionId: item.mission.id }))
                  }
                />
              </View>
            );
          })}
        </View>

        {next !== null && (
          <View style={st.nextSituation}>
            <Card>
              <Label>{NEXT_SITUATION.label}</Label>
              <Text style={[type.title, { color: paper.ink, marginTop: space(2) }]}>{next.mission.title}</Text>
              <Text style={[type.body, { color: paper.inkSoft, marginTop: space(0.5) }]}>{next.mission.titleEn}</Text>
              <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>
                {missionStatus(next.state, next.independence)}
              </Text>
              <View style={{ marginTop: space(4) }}>
                {/* The tab's one primary. The learner hears which situation it
                    opens from startLabel, since the title is a line above it. */}
                <PillButton
                  label={NEXT_SITUATION.action}
                  accessibilityLabel={startLabel(next.mission.titleEn)}
                  onPress={() => {
                    void trackProductEvent({
                      name: 'mission_started',
                      properties: { missionId: next.mission.id, entry: 'my-french' },
                    });
                    nav.navigate('Convo', { missionId: next.mission.id });
                  }}
                />
              </View>
            </Card>
          </View>
        )}

        {/* Always reachable, outside the next gate: a learner with no suggestion
            can still choose. The quiet door, not a second primary. */}
        <View style={{ marginTop: space(6) }}>
          <GhostButton
            label="Choose another situation"
            color={paper.ink}
            onPress={() => nav.navigate('Missions')}
          />
        </View>
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  scroll: { flexGrow: 1 },
  // The next situation, closing the screen. A top margin to lift it off the
  // list; no bottom padding, because the frame owns the bottom edge (F340).
  nextSituation: { marginTop: space(7) },
  // A week's account, at the head of the page of stamps rather than under it.
  // Sentences, so they are set in ink at body size: 4.5 is the floor for
  // something a learner reads, and the softer inks are below it.
  week: { marginTop: space(7), gap: space(2) },
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
});
