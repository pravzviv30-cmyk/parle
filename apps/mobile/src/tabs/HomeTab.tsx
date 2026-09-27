/**
 * Today: the learner's next scene, what it lets them say, and where they are.
 *
 * Rebuilt 2026-09-27 (notebook Phase 3, B1). The page opens on a still
 * greeting ("Bonsoir, Name." or "Bonsoir.") and the hour's question, then leads
 * with a SceneBrief for the next scene on the CEFR spine: level, French title,
 * "You'll be able to" and the can-do, two or three lines, the minutes, the
 * tutor, one Start and a quiet "Type instead". Start goes straight into that
 * scene; the chooser is Speak's.
 *
 * Under the brief, day one shows "Where you're starting" (A0 and the first
 * three can-dos). After that, two plain sentences about the week, and nothing
 * at all on a quiet week. Then today's phrase, audio first, with no picture.
 *
 * The four momentum tiles, the seven-dot rail, the expanding weekly details and
 * every rank name left this page. The level and what has been earned are
 * My French's to draw; the XP standing is read here only to pitch the daily
 * pool, and none of it is shown. All data is re-read on focus with one clock.
 */

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { levelFor, missionStates, totalXp, type ReviewCard } from '@luvani/core';

import { ScrollScreen, TabHeader } from '../layout.tsx';
import { space, paper, type } from '../theme.ts';
import { Card, GhostButton, Label, PillButton } from '../components.tsx';
import { ProfileButton } from '../profile/ProfileButton.tsx';
import { DailyCard } from '../daily/DailyCard.tsx';
import { todayItems } from '../daily/catalogue.ts';
import { useSocial } from '../friends/useSocial.ts';
import { usefulFriends } from '../home/activitySections.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { homeGreeting } from '../home/greeting.ts';
import { MissionHero } from '../home/MissionHero.tsx';
import { storyFrom } from '../progress/story.ts';
import { loadHistory } from '../progress/store.ts';
import { loadConversationPacks } from '../conversationPacks/store.ts';
import { fallbackHero, homeMissionFrom, type HomeMission } from '../home/homeMission.ts';
import { loadActivity } from '../progress/activity.ts';
import { loadDeck } from '../review/store.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { loadScenarioProgress } from '../missions/progressStore.ts';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { firstNameOf } from '../tutor/dashboard.ts';
import { homeActionFor } from '../home/nextAction.ts';
import { useHomeRefresh } from '../home/useHomeRefresh.ts';
import { loadSoundChecks } from '../soundcheck/store.ts';
import { loadPracticeHistory } from '../practice/historyStore.ts';
import { allConversations } from '../myfrench/recentConversations.ts';
import { reflectionFrom } from '../progress/reflection.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { STARTING_LABEL, WEEK_LABEL, startingPoint, weekLines, type StartingPoint } from '../home/todayView.ts';

export function HomeTab() {
  // A bottom tab stays mounted after its first visit, so the midnight and
  // foreground refresh listens to whether this tab is the one on top.
  const focused = useIsFocused();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { profile } = useProfile();

  // One name rule for the whole app. A learner who skipped the question is
  // greeted by the word alone, never by "you" and never with a bare comma.
  const firstName = firstNameOf(profile.name);
  const revision = useHomeRefresh(focused);
  const greeting = homeGreeting(firstName, Date.now());

  // Null here means the storage read has not answered yet.
  const [hero, setHero] = useState<HomeMission | null>(null);
  const [start, setStart] = useState<StartingPoint | null>(null);
  const [week, setWeek] = useState<readonly string[]>([]);
  const [daily, setDaily] = useState(() => todayItems(0, Date.now()));
  const [due, setDue] = useState<ReviewCard[]>([]);
  const { snapshot: social } = useSocial();
  const friendsActivity = usefulFriends(social);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const now = Date.now();
      // Bound to the account before any read, so a result from the previous
      // account is dropped rather than drawn for this one.
      const scope = scopeGeneration();
      void Promise.all([loadActivity(), loadDeck(), loadMissionCompletions(), loadScenarioProgress(), loadHistory(), loadConversationPacks(), loadSoundChecks(), loadPracticeHistory()])
        .then(([activity, deck, completions, records, history, packs, checks, events]) => {
          if (cancelled || scopeGeneration() !== scope) return;
          // The standing pitches the daily pool and nothing else; no name, no
          // rung and no number from it reaches the page.
          const standing = levelFor(totalXp(activity));
          setDaily(todayItems(standing.index, now));
          setDue(deck.filter(card => card.due <= now && card.kind !== 'phoneme'));
          // One projection of where every scene stands, handed to every rule
          // that draws from it, so the brief and the blocks under it agree.
          const progress = missionStates(missionCompletionsFrom(completions), deck, now);
          setHero(homeMissionFrom({ progress, records, levelIndex: standing.index, now }));
          setStart(startingPoint(progress));
          const story = storyFrom({ sessions: history, activity, packs, completions, now });
          setWeek(weekLines({ story, reflection: reflectionFrom({ story, recent: allConversations({ packs, events }), checks, progress, now }) }));
        })
        .catch(() => {
          if (cancelled) return;
          // The brief survives, on the first scene of the spine, which is true
          // for every learner and so claims nothing about the one who could
          // not be read. Day one and the week are withheld rather than guessed.
          setHero(fallbackHero());
        });
      return () => {
        cancelled = true;
      };
    }, [profile, revision]),
  );

  return (
    // bottom="tab": the tab bar owns the bottom edge.
    <ScrollScreen bottom="tab">
      <View>
        <View style={st.head}>
          <TabHeader title={greeting.title} purpose={greeting.subline} trailing={<ProfileButton />} />
        </View>

        {/* The brief is outside every other gate: a first run meets it too.
            Null only means the storage read has not answered. */}
        {hero !== null && (homeActionFor(hero, due.length) === 'review' ?
          <Card style={{ gap: space(3) }}><Label>A little French to bring back</Label><Text style={[type.frenchLg, { color: paper.ink }]}>{due.length === 1 ? 'One phrase is ready.' : `${due.length} phrases are ready.`}</Text><Text style={[type.body, { color: paper.inkSoft }]}>Try recalling a few phrases from your own collection. A short review is enough.</Text><PillButton label="Practise recall" onPress={() => nav.navigate('Review')} /><GhostButton label="I’d rather speak" onPress={() => nav.navigate('Tutor')} /></Card>
          : <MissionHero hero={hero} />)}

        {/* Day one names where the path begins; after that, the week in two
            plain sentences, and nothing on a quiet week. */}
        {start !== null ? (
          <View style={st.block}>
            <Label>{STARTING_LABEL}</Label>
            <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>{start.level}</Text>
            {start.canDos.map((line) => <Text key={line} style={[type.body, { color: paper.ink }]}>{line}</Text>)}
          </View>
        ) : week.length > 0 && (
          <View style={st.block}>
            <Label>{WEEK_LABEL}</Label>
            {week.map((line) => <Text key={line} style={[type.body, { color: paper.ink }]}>{line}</Text>)}
          </View>
        )}

        {/* Today's phrase, the tutor's audio first, with no picture. */}
        <DailyCard item={daily.phrase} />

        {friendsActivity !== null && <Card style={{ marginTop: space(3), gap: space(2) }}><Label>French with friends</Label><Text style={[type.body, { color: paper.ink }]}>{friendsActivity}</Text><GhostButton label="Open my circle" onPress={() => nav.navigate('Friends')} /></Card>}
        <GhostButton label="Explore my daily collection" onPress={() => nav.navigate('DailyLibrary')} />
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  // Keep the greeting aligned to the shared masthead.
  head: { position: 'relative', marginTop: space(2) },
  block: { marginTop: space(5), gap: space(2) },
});
