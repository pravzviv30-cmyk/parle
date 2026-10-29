import { tutorNameOf } from '../tutor/tutorName.ts';
import { c } from '../onboarding/boldRhythm.ts';
import { HomeArrival } from '../onboarding/HomeArrival.tsx';
import { NextTaskCard } from '../practice/NextTaskCard.tsx';
/**
 * Today, drawn to B-Today (2026-10-20, B5; rebuilt to the artboard in light
 * and dark, 2026-10-20 UI-008): the greeting, the stats row, the learner's
 * next scene on the yellow card, today's three quests, one fix to try,
 * today's phrase, Coming up, and the week in French, 22pt apart.
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
 * Then the shared `NextTaskCard` leads with the next scene on the yellow card
 * (its "Uses" chip only when the last conversation really meets it), the plans
 * card when the trial's minutes are used, or a genuine offline café task. The
 * blue "Your next practice" and review leads left Today with UI-008: a sitting
 * to finish is Practice's "Pick up where you stopped". No minute count or
 * allowance figure is drawn here.
 *
 * Under the lead: today's three quests (`game/QuestsCard`); one fix to try
 * from the newest conversation, English first, attempt first, behind the
 * trial's lock through the one access seam; today's phrase on the lavender
 * card; Coming up, from the latest life event the tutor remembers (hidden with
 * none, and for this app session after Not now); and the week in French when
 * the week has evidence, with the way into the weekly recap. "Where you're
 * starting" and the friends card left with UI-008 (the artboard draws
 * neither): the stages live on Journey, and friends on their own screen.
 *
 * The four momentum tiles, the seven-dot rail, the "More for today" sheet and
 * every rank name left this page. What has been earned is My French's to
 * draw; the content standing is read here only to pitch the daily pool. All
 * data is re-read on focus with one clock.
 */

import { useCallback, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { memoryPaused } from '@luvani/brain/profile';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { levelFor, missionStates, totalXp, type DrillExercise, type ReviewCard } from '@luvani/core';

import { Columns, ScrollScreen, TabHeader } from '../layout.tsx';
import { HIT, bType, decorative, radius, space, type } from '../theme.ts';
import { Card, IconAction, LockBadge, PillButton, Skeleton } from '../components.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { BButton, BMic, ComingUpCard, OutlineLock, WeekCard } from '../today/TodayParts.tsx';
import { visibleFacts } from '../profile/memory.ts';
import { ProfileButton } from '../profile/ProfileButton.tsx';
import { StarterContinuation } from '../onboarding/StarterContinuation.tsx';
import { loadSavedStarter } from '../onboarding/savedStarter.ts';
import type { GuestPractice } from '../onboarding/guestModel.ts';
import { DailyCard } from '../daily/DailyCard.tsx';
import { todayItems } from '../daily/catalogue.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { goalOf } from '../onboarding/goalLine.ts';
import { useAuth } from '../auth/useAuth.tsx';
import { useFeatureAccess } from '../access/useFeatureAccess.ts';
import { lockSaid, tapThrough } from '../access/featureAccess.ts';
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
import { TODAY_COPY, TODAY_ROUTES, comingUp, dismissComingUp, oneFix, startingPoint, weekInFrench, type StartingPoint } from '../home/todayView.ts';
import type { ConversationPack } from '@luvani/core';

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
  const t = useB();
  const st = useThemedStyles(makeStyles);

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
  const [fixFrom, setFixFrom] = useState<{ replay: Replay | null; deck: readonly ReviewCard[]; bank: readonly DrillExercise[]; packs: readonly ConversationPack[]; now: number } | null>(null);
  // Not now hides the event for this app session only (todayView keeps it in
  // memory); this re-draws the page once it is hidden.
  const [, setHidden] = useState(0);
  const [daily, setDaily] = useState(() => todayItems(0, Date.now()));

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
          setHero(homeMissionFrom({ progress, records, levelIndex: standing.index, goal: goalOf(profile), now }));
          setReadFailed(false);
          setStart(startingPoint(progress));
          const packs = withMarks(fetched, marks);
          setFixFrom({ replay: madeFromConversations({ packs: fetched, marks, deck, checks, bank, now })?.replay ?? null, deck, bank, packs: fetched, now });
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
  // The latest life event the tutor remembers, unless memory is paused.
  const event = comingUp({ facts: visibleFacts(profile), paused: memoryPaused(profile.brain), tutorName, access: locks.access, now: Date.now() });

  const three = <QuestsCard />;
  const fixCard = fix !== null && (
    <View style={st.fix}>
      <View style={st.fixHead}>
        <Text accessibilityRole="header" style={[bType.eyebrow, st.grow, { color: t.mintWords }]}>{TODAY_COPY.fix}</Text>
        {fix.locked && <LockBadge feature="fixes" said />}
      </View>
      <View style={st.ask}>
        <Text style={[bType.note, { color: t.muted }]}>{TODAY_COPY.fixAsk}</Text>
        <Text style={[bType.bold20, { color: t.text }]}>{fix.english}</Text>
      </View>
      <View style={st.after}>
        <View {...decorative}><OutlineLock size={18} color={t.muted} /></View>
        <Text style={[bType.note, st.grow, { color: t.muted }]}>{fix.after}</Text>
      </View>
      <BButton
        label={TODAY_COPY.fixAction}
        accessibilityLabel={fix.locked ? lockSaid(TODAY_COPY.fixAction, 'fixes', true) : undefined}
        height={50}
        ground={t.primary}
        ink={t.onPrimary}
        text={bType.bold17}
        icon={<BMic size={18} color={t.onPrimary} />}
        onPress={() => tapThrough(locks.access, fix.feature, locks.open, () => nav.navigate(fix.route.screen, fix.route.params))}
      />
    </View>
  );

  return (
    // bottom="tab": the tab bar owns the bottom edge.
    <View style={{ flex: 1 }} onTouchStart={() => setInteracted(true)}
      {...(Platform.OS === 'web' ? { onPointerDownCapture: () => setInteracted(true), onKeyDownCapture: () => setInteracted(true) } : {})}>
    <ScrollScreen bottom="tab" ground={c.paper} topGap={8}>
      <HomeArrival tutorName={tutorNameOf(profile)} ready={!interacted && !unowned && !readFailed && start !== null} />
      <View style={st.page}>
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
            <Text style={[type.bodyStrong, { color: t.text }]}>Your next scene could not be loaded.</Text>
            <Text style={[type.body, { color: t.muted }]}>We could not check your saved work. Today's phrase is available on this phone while we try again.</Text>
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

            {fixCard ? <Columns>{three}{fixCard}</Columns> : three}

            <DailyCard item={daily.phrase} variant="today" />

            {event !== null && (
              <ComingUpCard
                view={event}
                onRehearse={() => tapThrough(locks.access, event.feature, locks.open, () => nav.navigate(event.route.screen, event.route.params))}
                onNotNow={() => { dismissComingUp(event.key); setHidden((n) => n + 1); }}
              />
            )}

            {week !== null && (
              <WeekCard eyebrow={TODAY_COPY.week} sentence={week} link={TODAY_COPY.seeWeek} onLink={() => nav.navigate(TODAY_ROUTES.week)} />
            )}
          </View>
        )}
      </View>
    </ScrollScreen>
    </View>
  );
}

const makeStyles = (t: B) =>
  StyleSheet.create({
    // The artboard's 22pt rhythm between every block; the shared header keeps
    // its own 20pt foot, so it is pulled back to the same 22.
    head: { position: 'relative', marginBottom: -space(5) },
    page: { gap: 22 },
    grow: { flex: 1, minWidth: 0 },
    // One fix to try: the white card with the 2pt mint edge (radius 26, padding 18).
    fix: { gap: space(3), backgroundColor: t.card, borderRadius: 26, padding: 18, borderWidth: 2, borderColor: t.mint },
    fixHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space(2) },
    ask: { gap: space(1) },
    // The locked note: the inset panel with the outline lock.
    after: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: HIT, backgroundColor: t.inset, borderRadius: 14, paddingVertical: 10, paddingHorizontal: space(3) },
  });
