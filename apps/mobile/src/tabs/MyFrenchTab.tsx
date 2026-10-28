import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { DAILY_SCENARIOS, MISSIONS, missionStates, suggestedMission, phraseKeyOf, type ConversationPack, type DailyScenario, type MissionProgress, type ReviewCard } from '@luvani/core';

import { Ledger, LedgerRow, LOCK_BADGE_LABEL, OutlineButton, Press, Sheet } from '../components.tsx';
import { IconTile } from '../icons/IconTile.tsx';
import { Columns, ScrollScreen, TabHeader, TopInset } from '../layout.tsx';
import { ProfileButton } from '../profile/ProfileButton.tsx';
import { bType, frenchText, space } from '../theme.ts';
import { PinLight, useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { BButton } from '../today/TodayParts.tsx';
import { AbilityRow, BandStat, CollectionTile, DashedCell, EmptyJourneyCard, HelpCard, JourneyHead, JourneyList, LevelRow, ProgressSection, SoundRowView, StageTrack, TryCell, TwoUp, WeekRowView, YourFrenchSection } from '../journey/JourneyParts.tsx';
import { LivingBar } from '../motion/LivingBar.tsx';
import { storyFrom, hasStory, type WeekStory } from '../progress/story.ts';
import { loadHistory } from '../progress/store.ts';
import { reflectionFrom } from '../progress/reflection.ts';
import { earnedPostcards } from '../recap/evidence.ts';
import { LocalPracticeCard } from '../practice/LocalPracticeCard.tsx';
import { DayCount } from '../progress/DayCount.tsx';
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
import { useFeatureAccess } from '../access/useFeatureAccess.ts';
import type { LockedFeature } from '../access/featureAccess.ts';
import { useLive } from '../app/LiveContext.tsx';
import { loadConversationPacks, refreshConversationPacks } from '../conversationPacks/store.ts';
import { myFrenchFrom, type MyFrench } from '../myfrench/model.ts';
import { MY_FRENCH_RETRY, MY_FRENCH_UNREAD } from '../myfrench/copy.ts';
import { isFirstVisit, soundsMapFrom } from '../myfrench/notebook.ts';
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
import { goalOf } from '../onboarding/goalLine.ts';
import { goalRouteKey, goalRows } from '../goals/rows.ts';
import { ownedReadStatus } from './ownedRead.ts';
import { StreakSummaryCard } from '../game/StreakSummaryCard.tsx';
import { BadgeShelf } from '../game/BadgeShelf.tsx';
import { useGame, useLevel, useMinutesPractised, useStreak } from '../game/GameProvider.tsx';
import { rowTile } from '../game/progressView.ts';
import { TUTOR_OFFLINE, tutorGate } from '../tutor/gate.ts';
import {
  CAN_DO_HEADING,
  HELP_HEADING,
  JOURNEY_TITLE,
  PRACTISE,
  SEE_ALL,
  SOUNDS_HEADING,
  STAGE_HEADING,
  STAGE_INTRO,
  THEN_NOW_HEADING,
  THEN_NOW_SUBTITLE,
  WEEK_HEADING,
  YOU_ARE_HERE,
  canDoView,
  collectionTiles,
  emptyJourney,
  headerStats,
  helpView,
  isEmptyJourney,
  levelHeader,
  soundsView,
  stagesFrom,
  thenNowCard,
  yourFrenchView,
  weekView,
  progressRowsView,
  type JourneyRoute,
} from '../journey/journeyView.ts';

/**
 * Journey, built to direction B (B4, 2026-10-20, artboards B-Journey and the
 * Journey panel of B-Empty-States). The stage, the level and its XP, days in a
 * row, minutes practised and phrases saved; where the learner is on the five
 * stages; what they can do; then and now; the French they have used in
 * conversation; the help they needed, in words; their sounds; their week in
 * words; postcards and badges; and the doors to their phrases, conversations,
 * goals and saved scenes. Before the first conversation, the empty journey and
 * one start.
 *
 * Every decision is `journey/journeyView.ts`'s; this file is layout. Every read
 * is fenced to the account that made it. Lock badges come only from the
 * access seam, through the view model. This tab starts no audio.
 */
export function MyFrenchTab() {
  const t = useB();
  const st = useThemedStyles(makeStyles);
  const [badges, setBadges] = useState(false);
  // The band is brand blue under the clock in both themes, so the bar is light
  // while this tab is the one on screen (tabs stay mounted; the route's bar returns on blur).
  const focused = useIsFocused();
  useFocusEffect(useCallback(() => () => setBadges(false), []));
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { user, adapter } = useAuth();
  // The lock seam: re-renders on a standing change, opens the Wall on a locked teaser.
  const locks = useFeatureAccess(user?.id);
  const { recheck } = useLive();
  const { profile } = useProfile();
  const game = useGame();
  const run = useStreak();
  const xpLevel = useLevel();
  const minutes = useMinutesPractised();
  const [deck, setDeck] = useState<readonly ReviewCard[]>([]);
  const [missions, setMissions] = useState<readonly MissionProgress[]>([]);
  const [completions, setCompletions] = useState<readonly { id: string; at: number; rung: number }[]>([]);
  const [packs, setPacks] = useState<ConversationPack[]>([]);
  const [suggested, setSuggested] = useState<MissionProgress | null>(null);
  const [saved, setSaved] = useState<readonly DailyScenario[]>([]);
  // Pronunciation evidence. Only measured checks mark anything, and the pure
  // projections are the ones that know which those are.
  const [checks, setChecks] = useState<readonly SoundCheckEvidence[]>([]);
  const [history, setHistory] = useState<readonly HistoryItem[]>([]);
  const [story, setStory] = useState<WeekStory>({ sentences: [] });
  // 'loading' and 'unread' are facts of their own: neither is an empty account.
  const [status, setStatus] = useState<'loading' | 'ready' | 'unread'>('loading');
  const [readOwner, setReadOwner] = useState(() => scopeGeneration());
  const [readyOwner, setReadyOwner] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [hasWeek, setHasWeek] = useState(false);
  // The empty journey's one start, probed before it opens (F555).
  const [checking, setChecking] = useState(false);
  const [heldBack, setHeldBack] = useState(false);

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
      setStory({ sentences: [] });
      setHeldBack(false);
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
          const week = storyFrom({ sessions, activity, packs, completions, now: at });
          setDeck(cards);
          setPacks(packs);
          setStory(week);
          setHasWeek(hasStory(week));
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
  const firstVisit = isFirstVisit({ progress: missions, deck, checks, packs: packs.length });
  const journey = soundJourney(checks, now);
  const conversations = allConversations({ packs, events: history });
  // Counted once, for the header and for the rows alike.
  const kept = {
    phrases: new Set(deck.filter((card) => card.front.trim() !== '').map((card) => phraseKeyOf(card.front))).size,
    conversations: conversations.length,
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
  const empty = renderStatus === 'ready' && isEmptyJourney(firstVisit, completions);
  const owned = () => scopeGeneration() === currentScope;

  const stages = stagesFrom(missions);
  const level = levelHeader(xpLevel);
  const stats = headerStats({ daysInARow: run === null ? null : run.current, minutes, phrases: kept.phrases });
  const canDo = canDoView({ progress: missions, completions, now, access: locks.access });
  const thenNow = thenNowCard(completions, locks.access);
  const yourFrench = yourFrenchView({ deck, checks, progress: missions, completions, now, access: locks.access });
  const help = helpView({ completions, story, now, access: locks.access });
  const sounds = soundsView({ checks, now, hasJourney: journey !== null, access: locks.access });
  const progress = progressRowsView({ brain: profile.brain, deck, now, access: locks.access });
  const week = weekView(reflectionFrom({ story, recent: conversations, checks, progress: missions, now }), locks.access);
  const tiles = collectionTiles({ postcards: earnedPostcards(missions).length, badges: game.view?.badges.length ?? 0 });
  const start = emptyJourney(missions, goalOf(profile));

  /** Every door on the page, through the account fence. */
  const go = (route: JourneyRoute) => {
    if (!owned()) return;
    nav.navigate(route.screen, 'params' in route ? route.params : undefined);
  };

  /** The first scene, through the same probe and gate Speak's start uses. */
  const startFirst = () => {
    if (checking || !owned()) return;
    setChecking(true);
    void recheck().then((answered) => {
      if (!owned()) return;
      setChecking(false);
      const decision = tutorGate(answered);
      if (!decision.go) { setHeldBack(true); return; }
      setHeldBack(false);
      nav.navigate(decision.screen, { missionId: start.missionId, ...decision.params });
    }).catch(() => {
      if (!owned()) return;
      setChecking(false);
      setHeldBack(true);
    });
  };

  /** A locked section's one line (B-Journey): the heading keeps its badge, and this opens the Wall. */
  const teaser = (line: string, feature: LockedFeature) => (
    <Ledger>
      <LedgerRow title={line} accessibilityLabel={line} onPress={() => { if (owned()) locks.open(feature); }} />
    </Ledger>
  );

  // 2026-10-20 UI-008, artboard B-Journey: the brand band (radius 0 0 36 36,
  // padding 62 22 22, gap 16) runs full bleed under the status bar.
  // The light status bar is a sibling of the scroll that draws nothing, so the
  // ScrollScreen stays the one layout root and keeps its bounded height (2026-10-21).
  return (
    <>
    {focused ? <StatusBar style="light" /> : null}
    <ScrollScreen bottom="tab" padded={false} bleedTop>
      <View style={st.band}>
        <TopInset extra={space(2)} />
        <TabHeader title={JOURNEY_TITLE} flush ink={t.onBrand} trailing={<ProfileButton inverted />}
          eyebrow={renderStatus === 'ready' && !empty ? <Text style={[bType.bold14, { color: t.sun }]}>{stages.eyebrow}</Text> : undefined} />
        {level !== null && (
          <LevelRow title={level.title} xp={level.xp}
            bar={<LivingBar from={level.fraction} to={level.fraction} color={t.sun} track={t.violet2} height={space(2)} radius={space(1)} accessibilityLabel={level.barLabel} />} />
        )}
        {renderStatus === 'ready' && (
          <View style={st.stats}>
            {stats.map((stat) => <BandStat key={stat.key} value={stat.value} label={stat.label} />)}
          </View>
        )}
      </View>

      <View style={st.body}>
        {renderStatus === 'loading' && <Text style={[bType.line16, { color: t.muted }]}>Finding your French.</Text>}

        {/* A failed read is a row like every other door, not a button. */}
        {renderStatus === 'unread' && (
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
        )}

        {/* 2026-10-20 UI-008, artboard B-Empty-States: the butter card and its one 46pt start. */}
        {empty && (
          <EmptyJourneyCard eyebrow={start.picked} title={start.title} body={start.body}>
            <BButton label={start.start} height={46} ground={t.primary} ink={t.onPrimary} text={bType.bold15} hug disabled={checking} onPress={startFirst} />
            {heldBack && (
              <View style={st.stack}>
                <Text style={[bType.meta, { color: t.secondary }]}>{TUTOR_OFFLINE.body}</Text>
                <LocalPracticeCard />
                <OutlineButton label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry} disabled={checking} onPress={startFirst} />
              </View>
            )}
          </EmptyJourneyCard>
        )}

        {renderStatus === 'ready' && !empty && (
          <Columns>
            <View style={st.page}>
              {/* 2026-10-22: the learner's own French, first. Each part only with a saved record behind it.
                  Drawn by journey/JourneyParts' YourFrenchSection, where the open parts are drawn once
                  each (never in a .map, so the one highlighter stays one). */}
              <YourFrenchSection view={yourFrench} onOpen={go} onTeaser={(f) => { if (owned()) locks.open(f); }} />

              {/* 2026-10-28 LEARN-013: what is getting easier and what needs another go, from stored evidence only. */}
              {progress !== null && <ProgressSection view={progress} onOpen={go} onTeaser={(f) => { if (owned()) locks.open(f); }} />}

              <View style={st.stack}>
                <JourneyHead title={STAGE_HEADING} locked={false} subtitle={STAGE_INTRO} />
                <StageTrack steps={stages.steps} fill={stages.fill} moveUp={stages.moveUp} hereWord={YOU_ARE_HERE} />
              </View>

              {(canDo.rows.length > 0 || canDo.teaser !== null) && (
                <View style={st.stack}>
                  <JourneyHead title={CAN_DO_HEADING} locked={canDo.locked} />
                  {canDo.teaser !== null ? teaser(canDo.teaser, canDo.feature) : <JourneyList>
                    {canDo.rows.map((row, i) => (
                      <AbilityRow key={row.missionId} title={row.title} mark={row.mark} line={row.line} accessibilityLabel={row.accessibilityLabel} last={i === canDo.rows.length - 1} />
                    ))}
                  </JourneyList>}
                </View>
              )}

              {thenNow !== null && (
                <View style={st.stack}>
                  <JourneyHead title={THEN_NOW_HEADING} locked={thenNow.locked} subtitle={thenNow.teaser !== null ? undefined : THEN_NOW_SUBTITLE}
                    link={thenNow.teaser !== null ? undefined : { label: SEE_ALL, accessibilityLabel: `${SEE_ALL}, ${THEN_NOW_HEADING}`, onPress: () => go(thenNow.route) }} />
                  {thenNow.teaser !== null ? teaser(thenNow.teaser, thenNow.feature) : (
                    <Press haptic="light" onPress={() => go(thenNow.route)} style={st.card}
                      accessibilityLabel={`${THEN_NOW_HEADING}, ${thenNow.scene}. ${thenNow.first.label}, ${thenNow.first.help}.${thenNow.best === null ? '' : ` ${thenNow.best.label}, ${thenNow.best.help}.`}`}>
                      <Text {...frenchText} style={[bType.bold16, { color: t.text }]}>{thenNow.scene}</Text>
                      <TwoUp>
                        <TryCell tone="first" size="card" label={thenNow.first.label} help={thenNow.first.help} />
                        {thenNow.best !== null
                          ? <TryCell tone="best" size="card" label={thenNow.best.label} help={thenNow.best.help} />
                          : thenNow.hint !== null ? <DashedCell line={thenNow.hint} /> : null}
                      </TwoUp>
                    </Press>
                  )}
                </View>
              )}

            </View>

            <View style={st.page}>
              {help !== null && (
                <HelpCard heading={HELP_HEADING} line={help.line} locked={help.locked}
                  onPress={help.teaser !== null ? () => { if (owned()) locks.open(help.feature); } : undefined}
                  accessibilityLabel={help.teaser !== null ? `${HELP_HEADING}, ${LOCK_BADGE_LABEL}. ${help.line}` : undefined} />
              )}

              {sounds !== null && (
                <View style={st.stack}>
                  <JourneyHead title={SOUNDS_HEADING} locked={sounds.locked} />
                  {sounds.teaser !== null ? teaser(sounds.teaser, sounds.feature) : <JourneyList>
                    {sounds.rows.map((row, i) => (
                      <SoundRowView key={row.key} ipa={row.ipa} example={row.example} line={row.line} tile={row.tile} last={i === sounds.rows.length - 1}
                        practise={i === sounds.rows.length - 1 ? { label: PRACTISE, accessibilityLabel: `${PRACTISE} your sounds`, onPress: () => go(sounds.practise) } : null} />
                    ))}
                  </JourneyList>}
                </View>
              )}

              {week !== null && (
                <View style={st.stack}>
                  <JourneyHead title={WEEK_HEADING} locked={week.locked} />
                  {week.teaser !== null ? teaser(week.teaser, week.feature) : <JourneyList>
                    {week.rows.map((row, i) => (
                      <WeekRowView key={row.key} label={row.label} line={row.line} dot={row.dot} last={i === week.rows.length - 1}
                        onPress={row.route === null ? () => nav.navigate('WeekWrapped') : () => go(row.route!)} />
                    ))}
                  </JourneyList>}
                </View>
              )}

              <View style={st.tiles}>
                {tiles.map((tile) => (
                  <CollectionTile key={tile.key} kind={tile.key} title={tile.title} line={tile.line}
                    onPress={() => ('sheet' in tile.route ? setBadges(true) : go(tile.route))} />
                ))}
              </View>

              {(rows.length > 0 || hasWeek) && (
                <Ledger>
                  {hasWeek && <LedgerRow glyph={<IconTile ground="skeleton" name="book" size={ROW_TILE} />} title="Your week in French" accessibilityLabel="Your week in French, a few moments from the last seven days" gloss="A few moments from the last seven days" onPress={() => nav.navigate('WeekWrapped')} />}
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
              )}
            </View>
          </Columns>
        )}

        {/* The weekly day line reads its own record, whatever else is drawn. */}
        {renderStatus !== 'ready' && <DayCount weekly />}
      </View>

      {/* The badge shelf and the streak card are not rebuilt for dark yet, so their sheet stays light. */}
      <PinLight>
        <Sheet visible={badges} title="Badges" onClose={() => setBadges(false)}>
          <View style={st.stack}>
            <BadgeShelf />
            <StreakSummaryCard><DayCount weekly /></StreakSummaryCard>
          </View>
        </Sheet>
      </PinLight>
    </ScrollScreen>
    </>
  );
}

/** A ledger row's tile: a little under the touch floor, the row itself being the target. */
const ROW_TILE = space(10);

// 2026-10-20 UI-008, artboard B-Journey: the band, the body (padding 24 22,
// gap 28) and the white cards, from `useB()` so they follow light and dark.
const makeStyles = (t: B) =>
  StyleSheet.create({
    // M3: a blue card keeps the brand blue in both themes (as Today's week card),
    // its words onBrand, onBrandSoft and sun.
    // The band's own 22 all round; its top is the status bar's, through TopInset.
    band: { backgroundColor: t.brand, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, padding: 22, paddingTop: 0, gap: space(4) },
    stats: { flexDirection: 'row', gap: space(2) },
    // The blocks are the scroll's own children (F383): no wrapper that can grow.
    // The air above the tab bar is the frame's (F340).
    body: { paddingTop: space(6), paddingHorizontal: 22, gap: space(7) },
    page: { gap: space(7) },
    stack: { gap: space(3) },
    card: { backgroundColor: t.card, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
    tiles: { flexDirection: 'row', gap: 10 },
  });
