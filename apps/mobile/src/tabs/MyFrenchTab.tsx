import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { DAILY_SCENARIOS, MISSIONS, missionStates, suggestedMission, phraseKeyOf, type ConversationPack, type DailyScenario, type MissionProgress, type ReviewCard } from '@luvani/core';

import { Card, CheckGlyph, Chip, ColourCard, IconAction, Ledger, LedgerRow, LOCK_BADGE_LABEL, LockBadge, OutlineButton, PillButton, Sheet, StatRow, StatTile } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { IconTile } from '../icons/IconTile.tsx';
import { Columns, ScrollScreen, TabHeader } from '../layout.tsx';
import { ProfileButton } from '../profile/ProfileButton.tsx';
import { HIT, colour, decorative, frenchText, paper, space, textOn, type } from '../theme.ts';
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
import { goalRouteKey, goalRows } from '../goals/rows.ts';
import { ownedReadStatus } from './ownedRead.ts';
import { StreakSummaryCard } from '../game/StreakSummaryCard.tsx';
import { BadgeShelf } from '../game/BadgeShelf.tsx';
import { useGame, useLevel, useMinutesPractised, useStreak } from '../game/GameProvider.tsx';
import { rowTile } from '../game/progressView.ts';
import { tutorNameOf } from '../tutor/tutorName.ts';
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
  USED_HEADING,
  WEEK_HEADING,
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
  usedView,
  weekView,
  type JourneyRoute,
  type Segment,
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
  const [badges, setBadges] = useState(false);
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
  const used = usedView({ deck, tutorName: tutorNameOf(profile), now, access: locks.access });
  const help = helpView({ completions, story, now, access: locks.access });
  const sounds = soundsView({ checks, now, hasJourney: journey !== null, access: locks.access });
  const week = weekView(reflectionFrom({ story, recent: conversations, checks, progress: missions, now }), locks.access);
  const tiles = collectionTiles({ postcards: earnedPostcards(missions).length, badges: game.view?.badges.length ?? 0 });
  const start = emptyJourney(missions);

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
      const decision = tutorGate(answered, false);
      if (!decision.go) { setHeldBack(true); return; }
      setHeldBack(false);
      nav.navigate(decision.screen, { missionId: start.missionId, ...decision.params });
    }).catch(() => {
      if (!owned()) return;
      setChecking(false);
      setHeldBack(true);
    });
  };

  const sectionTitle = (title: string, locked: boolean) => (
    <View style={st.titleRow}>
      <Text accessibilityRole="header" style={[type.heading, st.grow, { color: paper.ink }]}>{title}</Text>
      {locked && <LockBadge />}
    </View>
  );

  /** A locked section's one line (B-Journey): the heading keeps its badge, and this opens the Wall. */
  const teaser = (line: string, feature: LockedFeature) => (
    <Ledger>
      <LedgerRow title={line} accessibilityLabel={line} onPress={() => { if (owned()) locks.open(feature); }} />
    </Ledger>
  );

  const words = (segments: readonly Segment[], color: string) => (
    <Text style={[type.small, { color }]}>
      {segments.map((s, i) => s.fr ? <Text key={i} {...frenchText}>{s.text}</Text> : s.text)}
    </Text>
  );

  return (
    <ScrollScreen bottom="tab">
      <ColourCard ground="blue" style={st.head}>
        <TabHeader title={JOURNEY_TITLE} ink={textOn.blue} trailing={<ProfileButton />}>
          {renderStatus === 'ready' && !empty && <Text style={[type.eyebrow, { color: colour.sun }]}>{stages.eyebrow}</Text>}
        </TabHeader>
        {/* The level is XP from practice, on its own white card so it never
            reads as progress through the stages below (B4 review). */}
        {level !== null && (
          <Card style={st.levelRow}>
            <View style={st.levelChip}><Text style={[type.label, { color: paper.ink }]}>{level.title}</Text></View>
            <LivingBar from={level.fraction} to={level.fraction} color={colour.blue} track={paper.line} accessibilityLabel={level.barLabel} style={st.grow} />
            <Text style={[type.small, { color: paper.inkSoft }]} {...decorative}>{level.xp}</Text>
          </Card>
        )}
        {renderStatus === 'ready' && (
          <StatRow>
            {stats.map((stat) => <StatTile key={stat.key} compact value={stat.value} label={stat.label} />)}
          </StatRow>
        )}
      </ColourCard>

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

      {empty && (
        <Card style={[st.stack, st.block]}>
          <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>{start.title}</Text>
          <Text style={[type.body, { color: paper.inkSoft }]}>{start.body}</Text>
          <PillButton label={start.start} disabled={checking} onPress={startFirst} />
          {heldBack && (
            <View style={st.stack}>
              <Text style={[type.small, { color: paper.inkSoft }]}>{TUTOR_OFFLINE.body}</Text>
              <LocalPracticeCard />
              <OutlineButton label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry} disabled={checking} onPress={startFirst} />
            </View>
          )}
        </Card>
      )}

      {renderStatus === 'ready' && !empty && (
        <View style={st.block}>
          <Columns>
            <View style={st.page}>
              <View style={st.stack}>
                <View>
                  <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>{STAGE_HEADING}</Text>
                  <Text style={[type.small, { color: paper.inkSoft }]}>{STAGE_INTRO}</Text>
                </View>
                <Card style={st.stack}>
                  <View style={st.stages}>
                    {stages.steps.map((step) => (
                      <View key={step.label} style={st.stage} accessible accessibilityLabel={step.accessibilityLabel}>
                        <View style={[st.stageDisc, step.state === 'ahead' ? st.stageAhead : { backgroundColor: colour.blue }]}>
                          {step.state === 'done'
                            ? <CheckGlyph size={18} color={paper.onInk} />
                            : <Text style={[type.label, { color: step.state === 'here' ? paper.onInk : paper.inkSoft }]}>{step.number}</Text>}
                        </View>
                        <Text style={[type.small, { color: step.state === 'ahead' ? paper.inkSoft : paper.ink }]}>{step.label}</Text>
                        {/* 2026-10-20, sim nits: the current stage carries a flag glyph; its words span the row below. */}
                        {step.state === 'here' && <View {...decorative}><Icon name="flag" size={16} color={colour.blue} /></View>}
                      </View>
                    ))}
                  </View>
                  {/* Said already by the stage's own label, so heard once. */}
                  <View {...decorative} style={st.hereRow}>
                    <Chip variant="meta" tone="lavender" leading={<Icon name="flag" size={16} color={colour.blue} />} label={stages.hereLine} />
                  </View>
                  {stages.moveUp !== null && <Text style={[type.small, { color: paper.inkSoft }]}>{stages.moveUp}</Text>}
                </Card>
              </View>

              {(canDo.rows.length > 0 || canDo.teaser !== null) && (
                <View style={st.stack}>
                  {sectionTitle(CAN_DO_HEADING, canDo.locked)}
                  {canDo.teaser !== null ? teaser(canDo.teaser, canDo.feature) : <Card style={st.stack}>
                    {canDo.rows.map((row) => (
                      <View key={row.missionId} style={st.canDo} accessible accessibilityLabel={row.accessibilityLabel}>
                        <View {...decorative} style={[st.mark, row.mark === 'earned' ? { backgroundColor: colour.mint } : row.mark === 'helped' ? { borderWidth: 3, borderColor: colour.sun } : { borderWidth: 3, borderColor: colour.ring }]}>
                          {row.mark === 'earned' ? <CheckGlyph size={16} color={paper.ink} /> : null}
                        </View>
                        <View style={st.grow}>
                          <Text style={[type.bodyStrong, { color: paper.ink }]}>{row.title}</Text>
                          {words(row.line, row.mark === 'earned' ? colour.mintWords : paper.inkSoft)}
                        </View>
                      </View>
                    ))}
                  </Card>}
                </View>
              )}

              {thenNow !== null && (
                <View style={st.stack}>
                  {sectionTitle(THEN_NOW_HEADING, thenNow.locked)}
                  {thenNow.teaser !== null ? teaser(thenNow.teaser, thenNow.feature) : <>
                  <Text style={[type.small, { color: paper.inkSoft }]}>{THEN_NOW_SUBTITLE}</Text>
                  <ColourCard ground="pastel.lavender" onPress={() => go(thenNow.route)}
                    accessibilityLabel={`${THEN_NOW_HEADING}, ${thenNow.scene}. ${thenNow.first.label}, ${thenNow.first.help}.${thenNow.best === null ? '' : ` ${thenNow.best.label}, ${thenNow.best.help}.`}`}>
                    <Text {...frenchText} style={[type.bodyStrong, { color: paper.ink }]}>{thenNow.scene}</Text>
                    <View style={st.cells}>
                      <View style={[st.cell, { backgroundColor: paper.card }]}>
                        <Text style={[type.small, { color: paper.inkSoft }]}>{thenNow.first.label}</Text>
                        <Text style={[type.bodyStrong, { color: paper.ink }]}>{thenNow.first.help}</Text>
                      </View>
                      {thenNow.best !== null && (
                        <View style={[st.cell, { backgroundColor: colour.mintWash }]}>
                          <Text style={[type.small, { color: colour.mintWords }]}>{thenNow.best.label}</Text>
                          <Text style={[type.bodyStrong, { color: paper.ink }]}>{thenNow.best.help}</Text>
                        </View>
                      )}
                    </View>
                  </ColourCard>
                  <IconAction layout="inline" icon="forward" label={SEE_ALL} accessibilityLabel={`${SEE_ALL}, ${THEN_NOW_HEADING}`} onPress={() => go(thenNow.route)} />
                  </>}
                </View>
              )}

              {used !== null && (
                <View style={st.stack}>
                  {sectionTitle(USED_HEADING, used.locked)}
                  {used.teaser !== null ? teaser(used.teaser, used.feature) : <>
                  <Text style={[type.small, { color: paper.inkSoft }]}>{used.subtitle}</Text>
                  <Card style={st.stack}>
                    <View style={st.chips}>
                      {used.phrases.map((fr) => <Chip key={fr} variant="meta" tone="lavender" lang="fr" label={fr} />)}
                    </View>
                    {used.transferLine !== null && <Text style={[type.small, { color: paper.inkSoft }]}>{used.transferLine}</Text>}
                  </Card>
                  </>}
                </View>
              )}
            </View>

            <View style={st.page}>
              {help !== null && (
                <ColourCard ground="mint"
                  onPress={help.teaser !== null ? () => { if (owned()) locks.open(help.feature); } : undefined}
                  accessibilityLabel={help.teaser !== null ? `${HELP_HEADING}, ${LOCK_BADGE_LABEL}. ${help.line}` : undefined}>
                  <View style={st.titleRow}>
                    <Text accessibilityRole="header" style={[type.label, st.grow, { color: textOn.mint }]}>{HELP_HEADING}</Text>
                    {help.locked && <LockBadge ground="card" said />}
                  </View>
                  <Text style={[type.bodyStrong, { color: textOn.mint }]}>{help.line}</Text>
                </ColourCard>
              )}

              {sounds !== null && (
                <View style={st.stack}>
                  {sectionTitle(SOUNDS_HEADING, sounds.locked)}
                  {sounds.teaser !== null ? teaser(sounds.teaser, sounds.feature) : <Card style={st.stack}>
                    {sounds.rows.map((row) => (
                      <View key={row.key} style={st.canDo}>
                        {row.ipa !== null && <View style={st.sound} {...decorative}><Text style={[type.label, { color: paper.ink }]}>{row.ipa}</Text></View>}
                        <View style={st.grow}>
                          {row.example !== null && <Text style={[type.bodyStrong, { color: paper.ink }]}>As in “<Text {...frenchText}>{row.example}</Text>”</Text>}
                          <Text style={[type.small, { color: paper.inkSoft }]}>{row.line}</Text>
                        </View>
                      </View>
                    ))}
                    <PillButton variant="secondary" compact label={PRACTISE} accessibilityLabel={`${PRACTISE} your sounds`} onPress={() => go(sounds.practise)} />
                  </Card>}
                </View>
              )}

              {week !== null && (
                <View style={st.stack}>
                  {sectionTitle(WEEK_HEADING, week.locked)}
                  {week.teaser !== null ? teaser(week.teaser, week.feature) : <Ledger>
                    {week.rows.map((row) => (
                      <LedgerRow key={row.key} label={row.label} title={row.line} accessibilityLabel={`${row.label}. ${row.line}`}
                        onPress={row.route === null ? () => nav.navigate('WeekWrapped') : () => go(row.route!)} />
                    ))}
                  </Ledger>}
                </View>
              )}

              <View style={st.tiles}>
                {tiles.map((tile) => (
                  <ColourCard key={tile.key} ground={tile.key === 'postcards' ? 'pastel.peach' : 'pastel.lavender'} style={st.tile}
                    accessibilityLabel={`${tile.title}, ${tile.line}`}
                    onPress={() => ('sheet' in tile.route ? setBadges(true) : go(tile.route))}>
                    <Text style={[type.bodyStrong, { color: paper.ink }]}>{tile.title}</Text>
                    <Text style={[type.small, { color: paper.inkSoft }]}>{tile.line}</Text>
                  </ColourCard>
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
        </View>
      )}

      {/* The weekly day line reads its own record, whatever else is drawn. */}
      {renderStatus !== 'ready' && <DayCount weekly />}

      <Sheet visible={badges} title="Badges" onClose={() => setBadges(false)}>
        <View style={st.stack}>
          <BadgeShelf />
          <StreakSummaryCard><DayCount weekly /></StreakSummaryCard>
        </View>
      </Sheet>
    </ScrollScreen>
  );
}

/** A ledger row's tile: a little under the touch floor, the row itself being the target. */
const ROW_TILE = space(10);

const st = StyleSheet.create({
  // The blocks are the scroll's own children (F383): no wrapper that can grow.
  head: { gap: space(4) },
  block: { marginTop: space(6) },
  page: { gap: space(7) },
  stack: { gap: space(3) },
  grow: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space(2), minHeight: HIT },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: space(2.5), paddingVertical: space(3) },
  levelChip: { backgroundColor: colour.sun, borderRadius: space(3), paddingHorizontal: space(2.5), paddingVertical: space(1.5) },
  stages: { flexDirection: 'row', justifyContent: 'space-between', gap: space(1) },
  stage: { flex: 1, minWidth: 0, alignItems: 'center', gap: space(1.5), minHeight: HIT },
  stageDisc: { width: space(10), height: space(10), borderRadius: space(5), alignItems: 'center', justifyContent: 'center' },
  hereRow: { flexDirection: 'row', flexWrap: 'wrap' },
  stageAhead: { backgroundColor: paper.card, borderWidth: 2, borderColor: colour.ring },
  canDo: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3), minHeight: HIT },
  mark: { width: space(7), height: space(7), borderRadius: space(3.5), alignItems: 'center', justifyContent: 'center' },
  sound: { width: HIT, height: HIT, borderRadius: space(3.5), backgroundColor: colour.mintWash, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  cells: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  cell: { flex: 1, minWidth: space(30), borderRadius: space(3.5), padding: space(2.5), gap: space(0.5) },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2.5) },
  tile: { flex: 1, minWidth: space(36), gap: space(2), padding: space(4) },
});
