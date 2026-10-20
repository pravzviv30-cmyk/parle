import { tutorNameOf } from '../tutor/tutorName.ts';
import { c } from '../onboarding/boldRhythm.ts';
import { HomeArrival } from '../onboarding/HomeArrival.tsx';
import { NextTaskCard } from '../practice/NextTaskCard.tsx';
/**
 * Today, drawn to B-Today (2026-10-20, B5): the greeting, the stats row, the
 * learner's next scene on the yellow card, today's three quests, one fix to
 * try, today's phrase, and the week in French.
 *
 * The page opens on a still "Bonjour, Name." (or "Bonjour.") with the avatar.
 * Under it, `game/TodayHero` reads the game layer on its own and draws the
 * stats row: the streak, today's goal ring in measured minutes, and the level
 * with its XP. It draws nothing it could not read.
 *
 * Until storage answers, the rest draws still sand blocks shaped like the page
 * and nothing else, so no card is drawn before the lead it sits under. A
 * refresh keeps what is drawn until the new read lands (F768): only a read for
 * an account nothing was drawn for brings the sand back.
 *
 * Then the shared `NextTaskCard` leads with owned unfinished or usable practice,
 * scheduled authored review a free learner may take, the next scene on the
 * yellow card with its place drawing and the "Builds on" chip when the last
 * conversation really meets it, or a genuine offline café task. It owns the
 * live allowance read; this screen does not decide a second lead, and no
 * minute count or allowance figure is drawn here.
 *
 * Under the lead: on day one, where the learner starts; then today's three
 * quests (`game/QuestsCard`); one fix to try from the newest conversation,
 * English first, opening the drill without the answer, behind the trial's lock
 * through the one access seam; today's phrase on the lavender card; the week in
 * French when the week has evidence, with the way into the weekly recap; and
 * the friends card when there is something to act on. "Coming up" is not drawn
 * until Phase C stores the event (founder, 2026-10-20).
 *
 * The four momentum tiles, the seven-dot rail, the "More for today" sheet and
 * every rank name left this page. What has been earned is My French's to
 * draw; the content standing is read here only to pitch the daily pool. All
 * data is re-read on focus with one clock.
 */

import { useCallback, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { levelFor, missionStates, totalXp, type DrillExercise, type ReviewCard } from '@luvani/core';

import { Columns, ScrollScreen, TabHeader } from '../layout.tsx';
import { HAIRLINE, HIT, colour, decorative, onColour, paper, radius, space, type } from '../theme.ts';
import { Card, ColourCard, IconAction, LOCK_BADGE_LABEL, LockBadge, MicGlyph, PillButton, ROW_WORDS, SceneMark, Skeleton } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { ProfileButton } from '../profile/ProfileButton.tsx';
import { StarterContinuation } from '../onboarding/StarterContinuation.tsx';
import { loadSavedStarter } from '../onboarding/savedStarter.ts';
import type { GuestPractice } from '../onboarding/guestModel.ts';
import { DailyCard } from '../daily/DailyCard.tsx';
import { todayItems } from '../daily/catalogue.ts';
import { useSocial } from '../friends/useSocial.ts';
import { usefulFriends } from '../home/activitySections.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { useFeatureAccess } from '../access/useFeatureAccess.ts';
import { tapThrough } from '../access/featureAccess.ts';
import { homeGreeting } from '../home/greeting.ts';
import { loadConversationPacks } from '../conversationPacks/store.ts';
import { loadPackMarks, withMarks } from '../conversationPacks/marks.ts';
import { homeMissionFrom, type HomeMission } from '../home/homeMission.ts';
import { loadActivity } from '../progress/activity.ts';
import { loadDeck } from '../review/store.ts';
import { loadDrillBank } from '../drill/store.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { loadScenarioProgress } from '../missions/progressStore.ts';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { firstNameOf } from '../tutor/dashboard.ts';
import { useHomeRefresh } from '../home/useHomeRefresh.ts';
import { refreshClears } from '../home/homeRefresh.ts';
import { TodayHero } from '../game/TodayHero.tsx';
import { QuestsCard } from '../game/QuestsCard.tsx';
import { loadSoundChecks } from '../soundcheck/store.ts';
import { madeFromConversations, type Replay } from '../practice/madeFrom.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { STARTING_LABEL, TODAY_COPY, TODAY_ROUTES, oneFix, startingPoint, weekInFrench, type StartingPoint } from '../home/todayView.ts';

export function HomeTab() {
  const [interacted, setInteracted] = useState(false);
  useFocusEffect(useCallback(() => { setInteracted(false); }, []));
  // A bottom tab stays mounted after its first visit, so the midnight and
  // foreground refresh listens to whether this tab is the one on top.
  const focused = useIsFocused();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { profile } = useProfile();
  const { user } = useAuth();
  const locks = useFeatureAccess(user?.id);
  const tutorName = tutorNameOf(profile);

  // One name rule for the whole app. A learner who skipped the question is
  // greeted by the word alone, never by "you" and never with a bare comma.
  const firstName = firstNameOf(profile.name);
  const revision = useHomeRefresh(focused);
  const greeting = homeGreeting(firstName);

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
  const [week, setWeek] = useState<string | null>(null);
  const [fixFrom, setFixFrom] = useState<{ replay: Replay | null; deck: readonly ReviewCard[]; bank: readonly DrillExercise[]; now: number } | null>(null);
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
        setWeek(null);
        setFixFrom(null);
      }
      setReadFailed(false);
      void Promise.all([loadActivity({ strict: true }), loadDeck(), loadMissionCompletions(), loadScenarioProgress(), loadConversationPacks(), loadSoundChecks({ strict: true }), loadSavedStarter(), loadDrillBank(), loadPackMarks()])
        .then(([activity, deck, completions, records, fetched, checks, savedStarter, bank, marks]) => {
          if (cancelled || scopeGeneration() !== scope) return;
          // The standing pitches the daily pool and nothing else; no name, no
          // rung and no number from it reaches the page.
          const standing = levelFor(totalXp(activity));
          setDaily(todayItems(standing.index, now));
          setStarter(savedStarter);
          // One projection of where every scene stands, handed to every rule
          // that draws from it, so the lead and the blocks under it agree.
          const progress = missionStates(missionCompletionsFrom(completions), deck, now);
          setHero(homeMissionFrom({ progress, records, levelIndex: standing.index, now }));
          setReadFailed(false);
          setStart(startingPoint(progress));
          const packs = withMarks(fetched, marks);
          setFixFrom({ replay: madeFromConversations({ packs: fetched, marks, deck, checks, bank, now })?.replay ?? null, deck, bank, now });
          setWeek(weekInFrench({ packs, deck, now }));
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
  // Asked at draw time, so the lock follows the plan the moment it changes.
  const fix = fixFrom === null ? null : oneFix({ ...fixFrom, tutorName, access: locks.access });

  const three = <QuestsCard />;
  const fixCard = fix !== null && (
    <Card style={st.fix}>
      <View style={st.fixHead}>
        <Text accessibilityRole="header" style={[type.eyebrow, ROW_WORDS, { color: paper.ink }]}>{TODAY_COPY.fix}</Text>
        {fix.locked && <LockBadge said />}
      </View>
      <View style={st.ask}>
        <Text style={[type.small, { color: paper.inkSoft }]}>{TODAY_COPY.fixAsk}</Text>
        <Text style={[type.bodyStrong, { color: paper.ink }]}>{fix.english}</Text>
      </View>
      <View style={st.after}>
        <View {...decorative}><Icon name="lock" size={18} color={paper.inkSoft} /></View>
        <Text style={[type.small, ROW_WORDS, { color: paper.inkSoft }]}>{fix.after}</Text>
      </View>
      <PillButton
        label={TODAY_COPY.fixAction}
        accessibilityLabel={fix.locked ? `${TODAY_COPY.fixAction}, ${LOCK_BADGE_LABEL}` : undefined}
        icon={<MicGlyph size={20} color={paper.onInk} />}
        onPress={() => tapThrough(locks.access, fix.feature, locks.open, () => nav.navigate(fix.route.screen, fix.route.params))}
      />
    </Card>
  );

  return (
    // bottom="tab": the tab bar owns the bottom edge.
    <View style={{ flex: 1 }} onTouchStart={() => setInteracted(true)}
      {...(Platform.OS === 'web' ? { onPointerDownCapture: () => setInteracted(true), onKeyDownCapture: () => setInteracted(true) } : {})}>
    <ScrollScreen bottom="tab" ground={c.paper} topGap={8}>
      <HomeArrival tutorName={tutorNameOf(profile)} ready={!interacted && !unowned && !readFailed && start !== null} />
      <View>
        <View style={st.head}>
          <TabHeader title={greeting.title} trailing={<ProfileButton />} />
        </View>

        {/* The habit first: it reads the game layer itself, and draws nothing
            it could not read rather than a nought. */}
        <TodayHero />
        {/* HomeLoading: the storage read has not answered, so still sand blocks
            shaped like the page, and nothing else. */}
        {!unowned && readFailed ? (
          <Card style={{ gap: space(3) }}>
            <Text style={[type.bodyStrong, { color: paper.ink }]}>Your next scene could not be loaded.</Text>
            <Text style={[type.body, { color: paper.inkSoft }]}>We could not check your saved work. Today's phrase is available on this phone while we try again.</Text>
            <PillButton label="Practise today's phrase" onPress={() => nav.navigate('DailyPractice', { id: daily.phrase.id })} />
            <IconAction layout="inline" icon="refresh" label="Try loading my scenes again" onPress={() => { setHero(null); setReadAttempt((n) => n + 1); }} />
          </Card>
        ) : hero === null || unowned ? (
          <Skeleton blocks={[{ height: 262, radius: radius.feature }, { height: 196, radius: radius.card }, { height: 220, radius: radius.card }, { height: 168, radius: radius.feature }]} />
        ) : (
          <View style={st.page}>
            {starter !== null && profile.brain.stats.sessions === 0 ? (
              <StarterContinuation initial={starter} onTutor={() => nav.navigate('Tutor')} onPlans={() => nav.navigate('Wall', { entry: 'recap' })} />
            ) : <NextTaskCard vivid />}

            {/* Day one names where the path begins, the first scene next. */}
            {start !== null && (
              <View style={st.block}>
                <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>{STARTING_LABEL}</Text>
                <Card style={st.scenes}>
                  {start.canDos.map((line, index) => (
                    <View key={line} style={[st.scene, index > 0 && st.ruled]}>
                      <SceneMark state={index === 0 ? 'here' : 'ahead'} />
                      <Text style={[type.label, ROW_WORDS, { color: index === 0 ? paper.ink : paper.inkSoft }]}>{line}</Text>
                    </View>
                  ))}
                </Card>
              </View>
            )}

            {fixCard ? <Columns>{three}{fixCard}</Columns> : three}

            <DailyCard item={daily.phrase} variant="today" />

            {week !== null && (
              <ColourCard ground="blue" style={st.week}>
                <Text style={[type.eyebrow, { color: onColour.blue }]}>{TODAY_COPY.week}</Text>
                <Text style={[type.heading, { color: paper.onInk }]}>{week}</Text>
                <IconAction layout="inline" ground="blue" icon="calendar" label={TODAY_COPY.seeWeek} onPress={() => nav.navigate(TODAY_ROUTES.week)} />
              </ColourCard>
            )}

            {friendsActivity !== null && <Card style={{ gap: space(2) }}><Text style={[type.small, { color: paper.inkSoft }]}>French with friends</Text><Text style={[type.body, { color: paper.ink }]}>{friendsActivity}</Text><IconAction layout="inline" icon="users" label="Open my circle" onPress={() => nav.navigate('Friends')} /></Card>}
          </View>
        )}
      </View>
    </ScrollScreen>
    </View>
  );
}

const st = StyleSheet.create({
  // Keep the greeting aligned to the shared masthead.
  head: { position: 'relative', marginTop: space(2) },
  page: { gap: space(4) },
  block: { gap: space(3) },
  // Day one's scenes: one white card, the rule between rows and never around them.
  scenes: { paddingVertical: space(1) },
  scene: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3) },
  ruled: { borderTopWidth: HAIRLINE, borderTopColor: paper.line },
  // One fix to try: the white card with the mint edge from the artboard.
  fix: { gap: space(3), borderWidth: 2, borderColor: colour.mint },
  fixHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(2) },
  ask: { gap: space(1), backgroundColor: paper.inset, borderRadius: radius.field, padding: space(3) },
  after: { flexDirection: 'row', alignItems: 'center', gap: space(2), minHeight: HIT },
  week: { gap: space(2) },
});
