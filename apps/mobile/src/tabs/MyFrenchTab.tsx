import { storyFrom, hasStory } from '../progress/story.ts';
import { loadHistory } from '../progress/store.ts';
import { earnedPostcards } from '../recap/evidence.ts';
import { LocalPracticeCard } from '../practice/LocalPracticeCard.tsx';
import { DayCount } from '../progress/DayCount.tsx';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { DAILY_SCENARIOS, MISSIONS, isEarned, missionStates, suggestedMission, phraseKeyOf, type ConversationPack, type DailyScenario, type MissionProgress, type ReviewCard } from '@luvani/core';
import { ColourCard, Ledger, LedgerRow, PillButton } from '../components.tsx';
import { IconTile } from '../icons/IconTile.tsx';
import { ScrollScreen, TabHeader } from '../layout.tsx';
import { ProfileButton } from '../profile/ProfileButton.tsx';
import { onColour, paper, space, type } from '../theme.ts';
import { loadDeck } from '../review/store.ts';
import { loadTopics } from '../topics/store.ts';
import { loadActivity } from '../progress/activity.ts';
import { evidenceFrom } from '../progress/evidence.ts';
import { savedSituations } from '../bookmarks/view.ts';
import { loadBookmarks } from '../bookmarks/store.ts';
import { buildPhrasebook } from '../phrases/phrasebook.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { trackProductEvent } from '../analytics/track.ts';
import { useAuth } from '../auth/useAuth.tsx';
import { loadConversationPacks, refreshConversationPacks } from '../conversationPacks/store.ts';
import { myFrenchFrom, type MyFrench } from '../myfrench/model.ts';
import { MY_FRENCH_RETRY, MY_FRENCH_UNREAD, MY_FRENCH_PURPOSE, MY_FRENCH_TITLE } from '../myfrench/copy.ts';
import { isFirstVisit, levelPathFrom, soundsMapFrom } from '../myfrench/notebook.ts';
import { LevelCard } from '../myfrench/LevelCard.tsx';
import { progressRows } from '../myfrench/progressRows.ts';
import { allConversations, type HistoryItem } from '../myfrench/recentConversations.ts';
import { loadPracticeHistory } from '../practice/historyStore.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { legacyMarkItems } from '../practice/history.ts';
import { loadPackMarks } from '../conversationPacks/marks.ts';
import { loadSoundChecks } from '../soundcheck/store.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import { soundJourney } from '../soundcheck/journey.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { goalRouteKey, goalRows } from '../goals/rows.ts';
import { abilityProof } from '../myfrench/abilityProof.ts';
import { ownedReadStatus } from './ownedRead.ts';
import { LevelXpCard } from '../game/LevelXpCard.tsx';
import { StreakSummaryCard } from '../game/StreakSummaryCard.tsx';
import { CountsGrid } from '../game/CountsGrid.tsx';
import { BadgeShelf } from '../game/BadgeShelf.tsx';
import { useStreak } from '../game/GameProvider.tsx';
import { progressShowsGame, rowTile } from '../game/progressView.ts';
import { PostcardShelf } from '../progress/PostcardShelf.tsx';

/**
 * Evidence-based level and saved-material doors; this tab starts no audio.
 *
 * Come alive Phase 4 (F769): the tab leads with the numbered level and its XP,
 * the streak and this week (holding the pinned weekly day line), four counts
 * and the badges, each read from its own record by the game layer, and drawn
 * only once there is practice to show. Then the CEFR level card, the one pill;
 * the earned postcards as a shelf; and the ledger rows, each led by its tile.
 */
export function MyFrenchTab() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { user, adapter } = useAuth();
  const { profile } = useProfile();
  const [deck, setDeck] = useState<readonly ReviewCard[]>([]);
  const [missions, setMissions] = useState<readonly MissionProgress[]>([]);
  const [completions, setCompletions] = useState<readonly { id: string; at: number; rung: number }[]>([]);
  const [packs, setPacks] = useState<ConversationPack[]>([]);
  const [suggested, setSuggested] = useState<MissionProgress | null>(null);
  const [saved, setSaved] = useState<readonly DailyScenario[]>([]);
  // Pronunciation evidence. Only measured checks mark anything, and the pure
  // projections below are the ones that know which those are.
  const [checks, setChecks] = useState<readonly SoundCheckEvidence[]>([]);
  const [history, setHistory] = useState<readonly HistoryItem[]>([]);
  // 'loading' and 'unread' are facts of their own: neither is an empty account.
  const [status, setStatus] = useState<'loading' | 'ready' | 'unread'>('loading');
  const [readOwner, setReadOwner] = useState(() => scopeGeneration());
  const [readyOwner, setReadyOwner] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [hasWeek, setHasWeek] = useState(false);
  const run = useStreak();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // Bound to the account before any read.
      const scope = scopeGeneration();
      const sameAccount = (): boolean => !cancelled && scopeGeneration() === scope;
      setReadOwner(scope);
      setReadyOwner(null);
      setStatus('loading');
      setMissions([]);
      setCompletions([]);
      setDeck([]);
      setPacks([]);
      setSaved([]);
      setChecks([]);
      setHistory([]);
      void Promise.all([
        loadMissionCompletions(),
        loadDeck(),
        loadTopics(),
        loadActivity({ strict: true }),
        loadBookmarks(),
        loadSoundChecks({ strict: true }),
        loadHistory(),
        loadConversationPacks(),
        loadPracticeHistory(),
        loadPackMarks(),
      ]).then(
        ([completions, cards, topics, activity, bookmarks, soundChecks, sessions, packs, events, marks]) => {
          if (!sameAccount()) return;
          const at = Date.now();
          const nextMissions = missionStates(missionCompletionsFrom(completions), cards, at);
          setDeck(cards);
          setPacks(packs);
          setHasWeek(hasStory(storyFrom({ sessions, activity, packs, completions, now: at })));
          setMissions(nextMissions);
          setCompletions(completions);
          setSuggested(suggestedMission(nextMissions));
          setSaved(savedSituations(bookmarks, DAILY_SCENARIOS));
          setChecks(soundChecks);
          setHistory([...events, ...legacyMarkItems(marks)]);
          setReadyOwner(scope);
          setStatus('ready');
          // The two numbers the product event has always carried, still never drawn.
          const nextEvidence = evidenceFrom({ missions: nextMissions, book: buildPhrasebook(cards, topics, at), activity });
          void trackProductEvent({
            name: 'my_french_opened',
            properties: { situationsDone: nextEvidence.situations, linesKept: nextEvidence.lines },
          });
        },
        () => {
          // Any failed evidence read leaves the whole account view unread.
          if (sameAccount()) setStatus('unread');
        },
      );
      setHasWeek(false);
      if (user) {
        void refreshConversationPacks(user, adapter).then((result) => {
          if (sameAccount() && result.ok) setPacks(result.packs);
        });
      }
      return () => {
        cancelled = true;
      };
    }, [user, adapter, attempt]),
  );

  const now = Date.now();
  const model: MyFrench = myFrenchFrom({ deck, missions, saved, packs, suggested, now });
  const path = levelPathFrom(missions);
  const proof = abilityProof(missions, completions, now);
  const hasFinish = missions.some((mission) => mission.timesFinished > 0);
  const hasEarned = missions.some(isEarned);
  const firstVisit = isFirstVisit({ progress: missions, deck, checks, packs: packs.length });
  const journey = soundJourney(checks, now);
  // Counted once, for the rows and for the counts grid alike.
  const kept = {
    phrases: new Set(deck.filter((card) => card.front.trim() !== '').map((card) => phraseKeyOf(card.front))).size,
    conversations: allConversations({ packs, events: history }).length,
  };
  const rows = progressRows({
    phrases: kept.phrases,
    sounds: soundsMapFrom(checks, now).show,
    conversations: kept.conversations,
    goals: goalRows(profile.learnerGoals, MISSIONS),
    saved: model.saved,
  });
  const currentScope = scopeGeneration();
  const renderStatus = ownedReadStatus(status, readOwner, readyOwner, currentScope);
  const showsGame = progressShowsGame(firstVisit, run === null ? null : run.lifetimeDays);
  // The weekly day line reads its own record: inside the streak card when the
  // game cards are drawn, and on its own when they are not (loading, a failed
  // evidence read, a first visit), so it never depends on them.
  const gameCards = renderStatus === 'ready' && showsGame;
  const postcards = earnedPostcards(missions);

  return (
    <ScrollScreen bottom="tab">
      <View style={st.head}>
        <TabHeader title={MY_FRENCH_TITLE} purpose={MY_FRENCH_PURPOSE} trailing={<ProfileButton />} />
      </View>
      {renderStatus === 'loading' && <Text style={[type.body, { color: paper.inkSoft, marginTop: space(4) }]}>Finding your French.</Text>}

      {/* A failed read is a row like every other door, not a button. */}
      {renderStatus === 'unread' && (
        <View style={st.block}>
          <Ledger>
            <LedgerRow
              glyph={<IconTile ground="skeleton" name="book" size={ROW_TILE} />}
              label={MY_FRENCH_RETRY}
              title={MY_FRENCH_UNREAD}
              accessibilityLabel={`${MY_FRENCH_UNREAD} ${MY_FRENCH_RETRY}`}
              onPress={() => {
                setStatus('loading');
                setAttempt((n) => n + 1);
              }}
            />
          </Ledger>
        </View>
      )}

      {gameCards && (
        <View style={st.group}>
          <LevelXpCard />
          <StreakSummaryCard><DayCount weekly /></StreakSummaryCard>
          <CountsGrid phrases={kept.phrases} conversations={kept.conversations} />
          <BadgeShelf />
        </View>
      )}

      {renderStatus === 'ready' && (
        <View style={st.group}>
          {proof !== null && <ColourCard ground="mint" style={{ gap: space(2) }}>
            <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>You can {proof.mission.canDoEn.toLowerCase()}</Text>
            <Text style={[type.body, { color: onColour.mint }]}>{proof.mission.titleEn}. {new Date(proof.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
            <Text style={[type.small, { color: onColour.mint }]}>You finished this scene independently. A later practice with help does not take it away.</Text>
            <PillButton label="See this scene" onPress={() => nav.navigate('Missions', { focus: proof.mission.id })} />
          </ColourCard>}
          {proof !== null && <Ledger><LedgerRow title="Your scene path" gloss="See the beginner scenes" accessibilityLabel="Your scene path. See the beginner scenes" onPress={() => nav.navigate('Missions')} /></Ledger>}
          {proof === null && hasFinish && <Text style={[type.body, { color: paper.inkSoft }]}>You have practised a scene with support. An independent finish adds a can-do here.</Text>}
          {!firstVisit && proof === null && <LevelCard path={path} hasFinish={hasFinish} hasEarned={hasEarned} onPress={() => nav.navigate('Missions')} />}
        </View>
      )}

      {renderStatus === 'ready' && firstVisit && (
        <View style={st.group}><Text accessibilityRole="header" style={type.heading}>Your first useful phrase</Text><LocalPracticeCard /></View>
      )}

      {!gameCards && <DayCount weekly />}

      {renderStatus === 'ready' && (hasWeek || earnedPostcards(missions).length > 0) && <View style={st.group}>
        {postcards.length > 0 && <PostcardShelf postcards={postcards} onOpen={() => nav.navigate('Postcards')} />}
        {hasWeek && <Ledger><LedgerRow glyph={<IconTile ground="skeleton" name="book" size={ROW_TILE} />} title="Your week in French" accessibilityLabel="Your week in French, a few moments from the last seven days" gloss="A few moments from the last seven days" onPress={() => nav.navigate('WeekWrapped')} /></Ledger>}
      </View>}
      {renderStatus === 'ready' && rows.length > 0 && (
        <View style={st.group}>
          <Ledger>
            {rows.map((row) => (
              <LedgerRow
                key={row.id}
                glyph={<IconTile ground="skeleton" name={rowTile(row.kind)} size={ROW_TILE} />}
                title={row.title}
                gloss={row.detail}
                accessibilityLabel={`${row.title}. ${row.detail}`}
                onPress={() => {
                  if (row.kind === 'phrases') nav.navigate('Phrasebook');
                  else if (row.kind === 'sounds') nav.navigate(journey !== null ? 'SoundJourney' : 'SoundCheck', journey === null ? { missionId: suggested?.mission.id } : undefined);
                  else if (row.kind === 'conversations') nav.navigate('Conversations');
                  else if (row.kind === 'goal') nav.navigate('GoalStep', { key: goalRouteKey(row.title) });
                  else nav.navigate('Convo', { seedTopic: row.seedTopic });
                }}
              />
            ))}
          </Ledger>
        </View>
      )}
    </ScrollScreen>
  );
}

/** A ledger row's tile: a little under the touch floor, the row itself being the target. */
const ROW_TILE = space(10);

const st = StyleSheet.create({
  // The blocks are the scroll's own children (F383): no wrapper that can grow.
  head: { position: 'relative' },
  block: { marginTop: space(4) },
  group: { marginTop: space(5), gap: space(3) },
  level: { ...type.body, color: paper.ink },
  line: { ...type.small, color: paper.inkSoft },
  firstVisit: { ...type.body, color: paper.inkSoft, marginTop: space(4) },
});
