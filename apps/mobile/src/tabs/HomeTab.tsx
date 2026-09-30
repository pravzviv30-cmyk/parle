/**
 * Today: the learner's next scene, what it lets them say, and where they are.
 *
 * Rebuilt 2026-09-27 (notebook Phase 3, B1), and redrawn for revamp B (F602).
 * The page opens on a still greeting ("Bonsoir, Name." or "Bonsoir.") and the
 * hour's question, set as the one working tab title. Until storage answers it
 * draws still sand blocks shaped like the page and nothing else, so no card is
 * drawn before the lead it sits under.
 *
 * Then exactly one colour card leads, and `home/nextAction.ts` chooses which:
 * the blue scene brief for the next scene on the CEFR spine (meta line, French
 * title, English, the can-do as a sentence, one line to say, a white "Start
 * speaking" and a quiet "Type instead"), the blue recall card when phrases are
 * due on the day's scene, or the sun plans card when the free trial's minutes
 * are used. That last one needs the plan, read through the same billing call
 * Speak makes; a plan nobody could read never leads.
 *
 * Under the lead, white: day one lists where the learner starts, one scene
 * mark per can-do, the first one next. After that, at most two plain sentences
 * about the week with no label over them, and nothing at all on a quiet week.
 * Where the lifetime count will go (F609) there is a slot and no number. Then
 * the review row when the recall card is not the lead, today's phrase as a
 * white card with a play disc and "Practise it", the friends card, and the way
 * into the daily collection.
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
import { HAIRLINE, onColour, paper, radius, space, textOn, type } from '../theme.ts';
import { Card, ColourCard, GhostButton, Ledger, LedgerRow, PillButton, ROW_WORDS, SceneMark, Skeleton } from '../components.tsx';
import { useLive } from '../app/LiveContext.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { fetchBillingStatus } from '../purchases/client.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
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
import { PLANS_LEAD, dueLine, homeActionFor } from '../home/nextAction.ts';
import { useHomeRefresh } from '../home/useHomeRefresh.ts';
import { loadSoundChecks } from '../soundcheck/store.ts';
import { loadPracticeHistory } from '../practice/historyStore.ts';
import { allConversations } from '../myfrench/recentConversations.ts';
import { reflectionFrom } from '../progress/reflection.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { STARTING_LABEL, startingPoint, weekLines, type StartingPoint } from '../home/todayView.ts';

export function HomeTab() {
  // A bottom tab stays mounted after its first visit, so the midnight and
  // foreground refresh listens to whether this tab is the one on top.
  const focused = useIsFocused();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { profile } = useProfile();
  const { live } = useLive();
  const { user } = useAuth();

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
  /** The plan as the server answered it, or null when it has not or could not. */
  const [billing, setBilling] = useState<BillingStatus | null>(null);
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

  // The plan, on its own read, the way Speak reads it (TutorTab), so the used
  // trial can lead the page. Signed out or offline there is no read at all, and
  // a status the server would not give stays null, which never leads with plans.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (!live || user === null) return;
      void fetchBillingStatus(user.id)
        .then((status) => {
          if (cancelled) return;
          setBilling(status);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [live, user]),
  );

  // Which one colour card leads is the rule's, never the screen's. Null only
  // while the storage read has not answered.
  const lead = hero === null ? null : homeActionFor(hero, due.length, billing);

  return (
    // bottom="tab": the tab bar owns the bottom edge.
    <ScrollScreen bottom="tab">
      <View>
        <View style={st.head}>
          <TabHeader title={greeting.title} purpose={greeting.subline} trailing={<ProfileButton />} />
        </View>

        {/* HomeLoading: the storage read has not answered, so still sand blocks
            shaped like the page, and nothing else. The brief is outside every
            other gate once it has: a first run meets it too. */}
        {hero === null ? (
          <Skeleton blocks={[{ height: 328, radius: radius.feature }, { height: 24, width: '60%', radius: radius.field }, { height: 68, radius: radius.tile }, { height: 132, radius: radius.card }]} />
        ) : (
          <>
            {lead === 'plans' ? (
              <ColourCard ground="sun">
                <Text accessibilityRole="header" style={[type.frenchLg, { color: textOn.sun }]}>{PLANS_LEAD.title}</Text>
                <Text style={[type.body, { color: textOn.sun }]}>{PLANS_LEAD.body}</Text>
                <Text style={[type.small, { color: onColour.sun }]}>{PLANS_LEAD.keeps}</Text>
                <PillButton label={PLANS_LEAD.action} onPress={() => nav.navigate('Wall', { entry: 'refused' })} />
              </ColourCard>
            ) : lead === 'review' ? (
              <ColourCard ground="blue">
                <Text style={[type.small, { color: onColour.blue }]}>A little French to bring back</Text>
                <Text accessibilityRole="header" style={[type.frenchLg, { color: textOn.blue }]}>{due.length === 1 ? 'One phrase is ready.' : `${due.length} phrases are ready.`}</Text>
                <Text style={[type.body, { color: onColour.blue }]}>Try recalling a few phrases from your own collection. A short review is enough.</Text>
                <PillButton tone="white" label="Practise recall" onPress={() => nav.navigate('Review')} />
                <GhostButton label="I’d rather speak" color={paper.onInk} onPress={() => nav.navigate('Tutor')} />
              </ColourCard>
            ) : (
              <MissionHero hero={hero} />
            )}

            {/* F609: the lifetime count lands here, "12 days of French so far". Home draws no weekly day count (founder, 29 Sept). */}

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

            {/* The recall door as a white row, unless the recall card already leads. */}
            {lead !== 'review' && due.length > 0 && (
              <Ledger style={st.list}>
                <LedgerRow title={dueLine(due.length)} gloss="A short review is enough." onPress={() => nav.navigate('Review')} />
              </Ledger>
            )}

            {/* Today's phrase, the tutor's audio first, with no picture. */}
            <DailyCard item={daily.phrase} variant="today" />

            {friendsActivity !== null && <Card style={{ marginTop: space(3), gap: space(2) }}><Text style={[type.small, { color: paper.inkSoft }]}>French with friends</Text><Text style={[type.body, { color: paper.ink }]}>{friendsActivity}</Text><GhostButton label="Open my circle" onPress={() => nav.navigate('Friends')} /></Card>}
            <GhostButton label="Explore my daily collection" onPress={() => nav.navigate('DailyLibrary')} />
          </>
        )}
      </View>
    </ScrollScreen>
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
