import { tutorNameOf } from '../tutor/tutorName.ts';
import { c } from '../onboarding/boldRhythm.ts';
import { HomeArrival } from '../onboarding/HomeArrival.tsx';
import { NextTaskCard } from '../practice/NextTaskCard.tsx';
import { DayCount } from '../progress/DayCount.tsx';
/**
 * Today: the habit, the learner's next scene, what it lets them say, and where
 * they are.
 *
 * Rebuilt 2026-09-27 (notebook Phase 3, B1), redrawn for revamp B (F602), and
 * given the habit in come alive Phase 4 (F767). The page opens on a still
 * greeting ("Bonsoir, Name." or "Bonsoir.") and the hour's question, set as the
 * one working tab title. Under it, `game/TodayHero` reads the game layer on its
 * own: the flame and the run (to the Streak screen), today's goal ring in
 * measured minutes, the level chip, and the one nudge line while a run is
 * waiting on today. It draws nothing it could not read.
 *
 * Until storage answers, the rest draws still sand blocks shaped like the page
 * and nothing else, so no card is drawn before the lead it sits under. A
 * refresh keeps what is drawn until the new read lands (F768): only a read for
 * an account nothing was drawn for brings the sand back.
 *
 * Then the shared `NextTaskCard` leads with owned unfinished or usable practice,
 * scheduled authored review, the next scene on the scene brief with its place
 * drawing, or a genuine offline café task. It owns the live allowance read;
 * this screen does not decide a second lead.
 *
 * Under the lead, white: the lifetime day count in its pinned slot, then day
 * one's list of where the learner starts, one scene mark per can-do, the first
 * one next; after that, at most two plain sentences about the week with no
 * label over them, and nothing at all on a quiet week. Then today's three
 * quests (`game/QuestsCard`), today's phrase as a white card with a play disc
 * and its three actions (practise it, save, more phrases), and the friends
 * card.
 *
 * The four momentum tiles, the seven-dot rail, the expanding weekly details and
 * every rank name left this page. The level is a number from the game layer,
 * and what has been earned is My French's to draw; the content standing is
 * read here only to pitch the daily pool, and none of it is shown. All data is
 * re-read on focus with one clock.
 */

import { useCallback, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { levelFor, missionStates, totalXp } from '@luvani/core';

import { Columns, useLayoutClass, ScrollScreen, TabHeader } from '../layout.tsx';
import { HAIRLINE, paper, radius, space, type } from '../theme.ts';
import { Card, IconAction, Sheet, PillButton, ROW_WORDS, SceneMark, Skeleton } from '../components.tsx';
import { ProfileButton } from '../profile/ProfileButton.tsx';
import { StarterContinuation } from '../onboarding/StarterContinuation.tsx';
import { loadSavedStarter } from '../onboarding/savedStarter.ts';
import type { GuestPractice } from '../onboarding/guestModel.ts';
import { DailyCard } from '../daily/DailyCard.tsx';
import { todayItems } from '../daily/catalogue.ts';
import { useSocial } from '../friends/useSocial.ts';
import { usefulFriends } from '../home/activitySections.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { homeGreeting } from '../home/greeting.ts';
import { storyFrom } from '../progress/story.ts';
import { loadHistory } from '../progress/store.ts';
import { loadConversationPacks } from '../conversationPacks/store.ts';
import { homeMissionFrom, type HomeMission } from '../home/homeMission.ts';
import { loadActivity } from '../progress/activity.ts';
import { loadDeck } from '../review/store.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { loadScenarioProgress } from '../missions/progressStore.ts';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { firstNameOf } from '../tutor/dashboard.ts';
import { useHomeRefresh } from '../home/useHomeRefresh.ts';
import { refreshClears } from '../home/homeRefresh.ts';
import { TodayHero } from '../game/TodayHero.tsx';
import { QuestsCard } from '../game/QuestsCard.tsx';
import { loadSoundChecks } from '../soundcheck/store.ts';
import { loadPracticeHistory } from '../practice/historyStore.ts';
import { allConversations } from '../myfrench/recentConversations.ts';
import { reflectionFrom } from '../progress/reflection.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { STARTING_LABEL, startingPoint, weekLines, type StartingPoint } from '../home/todayView.ts';

export function HomeTab() {
  const [details, setDetails] = useState(false);
  const [interacted, setInteracted] = useState(false);
  useFocusEffect(useCallback(() => { setInteracted(false); }, []));
  useFocusEffect(useCallback(() => () => setDetails(false), []));
  const regular = useLayoutClass() === 'regular';
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
  const [starter, setStarter] = useState<GuestPractice | null>(null);
  const [hero, setHero] = useState<HomeMission | null>(null);
  const [readOwner, setReadOwner] = useState(() => scopeGeneration());
  const [readFailed, setReadFailed] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);
  // The account the last landed read drew for, so a refresh for the same
  // account keeps the page on screen instead of the sand blocks (F768).
  const drawnFor = useRef<number | null>(null);
  const [start, setStart] = useState<StartingPoint | null>(null);
  const [week, setWeek] = useState<readonly string[]>([]);
  const [daily, setDaily] = useState(() => todayItems(0, Date.now()));
  const { snapshot: social } = useSocial();
  const friendsActivity = usefulFriends(social);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const now = Date.now();
      // Bound to the account before any read, so a result from the previous
      // account is dropped rather than drawn for this one.
      const scope = scopeGeneration();
      setReadOwner(scope);
      // A refresh keeps what is drawn until the new read lands; only a read for
      // an account nothing was drawn for clears the page first.
      if (refreshClears(drawnFor.current, scope)) {
        setDaily(todayItems(0, now));
        setHero(null);
        setStarter(null);
        setStart(null);
        setWeek([]);
      }
      setReadFailed(false);
      void Promise.all([loadActivity({ strict: true }), loadDeck(), loadMissionCompletions(), loadScenarioProgress(), loadHistory(), loadConversationPacks(), loadSoundChecks({ strict: true }), loadPracticeHistory(), loadSavedStarter()])
        .then(([activity, deck, completions, records, history, packs, checks, events, savedStarter]) => {
          if (cancelled || scopeGeneration() !== scope) return;
          // The standing pitches the daily pool and nothing else; no name, no
          // rung and no number from it reaches the page.
          const standing = levelFor(totalXp(activity));
          setDaily(todayItems(standing.index, now));
          setStarter(savedStarter);
          // One projection of where every scene stands, handed to every rule
          // that draws from it, so the brief and the blocks under it agree.
          const progress = missionStates(missionCompletionsFrom(completions), deck, now);
          setHero(homeMissionFrom({ progress, records, levelIndex: standing.index, now }));
          setReadFailed(false);
          setStart(startingPoint(progress));
          const story = storyFrom({ sessions: history, activity, packs, completions, now });
          setWeek(weekLines({ story, reflection: reflectionFrom({ story, recent: allConversations({ packs, events }), checks, progress, now }) }));
          drawnFor.current = scope;
        })
        .catch(() => {
          if (cancelled || scopeGeneration() !== scope) return;
          // A failed read cannot identify the learner's next scene.
          setReadFailed(true);
        });
      return () => {
        cancelled = true;
      };
    }, [profile, revision, readAttempt]),
  );

  const unowned = readOwner !== scopeGeneration();

  return (
    // bottom="tab": the tab bar owns the bottom edge.
    <View style={{ flex: 1 }} onTouchStart={() => setInteracted(true)}
      {...(Platform.OS === 'web' ? { onPointerDownCapture: () => setInteracted(true), onKeyDownCapture: () => setInteracted(true) } : {})}>
    <ScrollScreen bottom="tab" ground={c.paper} topGap={8}>
      <HomeArrival tutorName={tutorNameOf(profile)} ready={!interacted && !unowned && !readFailed && start !== null} />
      <View>
        <View style={st.head}>
          <TabHeader title={greeting.title} purpose={greeting.subline} trailing={<ProfileButton />} />
        </View>

        {/* The habit first: it reads the game layer itself, and draws nothing
            it could not read rather than a nought. */}
        <TodayHero compact />
        {/* HomeLoading: the storage read has not answered, so still sand blocks
            shaped like the page, and nothing else. The brief is outside every
            other gate once it has: a first run meets it too. */}
        {!unowned && readFailed ? (
          <Card style={{ gap: space(3) }}>
            <Text style={[type.bodyStrong, { color: paper.ink }]}>Your next scene could not be loaded.</Text>
            <Text style={[type.body, { color: paper.inkSoft }]}>We could not check your saved work. Today's phrase is available on this phone while we try again.</Text>
            <PillButton label="Practise today's phrase" onPress={() => nav.navigate('DailyPractice', { id: daily.phrase.id })} />
            <IconAction layout="inline" icon="refresh" label="Try loading my scenes again" onPress={() => { setHero(null); setReadAttempt((n) => n + 1); }} />
          </Card>
        ) : hero === null || unowned ? (
          <Skeleton blocks={[{ height: 328, radius: radius.feature }, { height: 24, width: '60%', radius: radius.field }, { height: 68, radius: radius.tile }, { height: 132, radius: radius.card }]} />
        ) : (
          <>
            {starter !== null && profile.brain.stats.sessions === 0 ? (
              <StarterContinuation initial={starter} onTutor={() => nav.navigate('Tutor')} onPlans={() => nav.navigate('Wall', { entry: 'recap' })} />
            ) : <NextTaskCard vivid />}

            <DayCount />

            <IconAction layout="inline" icon="calendar" label="See your week" onPress={() => nav.navigate('WeekWrapped')} />
            <IconAction layout="inline" icon="forward" label="More for today" onPress={() => setDetails(true)} />
            <Sheet visible={details} title="Today" onClose={() => setDetails(false)}>
            {regular ? <Columns><TodayHero /><QuestsCard /></Columns> : <TodayHero />}
            {/* Day one names where the path begins, the first scene next; after
                that, the week in plain sentences, and nothing on a quiet week. */}
            {start !== null ? (
              <View style={st.block}>
                <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>{`${STARTING_LABEL}: ${start.level}`}</Text>
                <Card style={st.scenes}>
                  {start.canDos.map((line, index) => (
                    <View key={line} style={[st.scene, index > 0 && st.ruled]}>
                      <SceneMark state={index === 0 ? 'here' : 'ahead'} />
                      <Text style={[type.label, ROW_WORDS, { color: index === 0 ? paper.ink : paper.inkSoft }]}>{line}</Text>
                    </View>
                  ))}
                </Card>
              </View>
            ) : week.length > 0 && (
              <View style={st.block}>
                {week.map((line) => <Text key={line} style={[type.body, { color: paper.ink }]}>{line}</Text>)}
              </View>
            )}

            {!regular && <QuestsCard />}

            <DailyCard item={daily.phrase} variant="today" />

            {friendsActivity !== null && <Card style={{ marginTop: space(3), gap: space(2) }}><Text style={[type.small, { color: paper.inkSoft }]}>French with friends</Text><Text style={[type.body, { color: paper.ink }]}>{friendsActivity}</Text><IconAction layout="inline" icon="users" label="Open my circle" onPress={() => nav.navigate('Friends')} /></Card>}
            </Sheet>
          </>
        )}
      </View>
    </ScrollScreen>
    </View>
  );
}

const st = StyleSheet.create({
  // Keep the greeting aligned to the shared masthead.
  head: { position: 'relative', marginTop: space(2) },
  block: { marginTop: space(5), gap: space(3) },
  list: { marginTop: space(3) },
  // Day one's scenes: one white card, the rule between rows and never around them.
  scenes: { paddingVertical: space(1) },
  scene: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3) },
  ruled: { borderTopWidth: HAIRLINE, borderTopColor: paper.line },
});
