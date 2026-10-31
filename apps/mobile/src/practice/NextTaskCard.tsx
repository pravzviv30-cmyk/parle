import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { levelFor, missionStates, totalXp } from '@luvani/core';
import { Card, ColourCard, FrenchBlock, IconAction, PillButton } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { useAuth } from '../auth/useAuth.tsx';
import { fetchBillingStatus } from '../purchases/client.ts';
import type { HomeBilling } from '../home/nextAction.ts';
import { PLANS_LEAD, plansLeadBody } from '../home/nextAction.ts';
import { afterHeld, heldWords, leadRowArt, leadStop, sceneRowState, nextTaskKind, offersPlans, sceneOrExplore, starterTutorOpen, todayLead, type TodayLead } from './nextTask.ts';
import { BArt } from '../art/BArt.tsx';
import { RouteRow } from '../home/RoutePath.tsx';
import { useSceneStart } from '../home/useSceneStart.ts';
import { useB } from '../main/bTheme.tsx';
import { DAILY_ITEMS } from '../daily/catalogue.ts';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { localPracticeFor, offlineOffer } from './localPractice.ts';
import { StarterContinuation } from '../onboarding/StarterContinuation.tsx';
import type { GuestPractice } from '../onboarding/guestModel.ts';
import { recoverPracticeCompletion } from './completion.ts';
import { loadPackMarks, withMarks } from '../conversationPacks/marks.ts';
import { useLive } from '../app/LiveContext.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { goalOf } from '../onboarding/goalLine.ts';
import { startAtOf } from '../profile/practicePreferences.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { loadDeck } from '../review/store.ts';
import { offeredReview, reviewOffer, type ReviewOffer } from '../review/freeTier.ts';
import { useFeatureLocks } from '../purchases/useFeatureLocks.ts';
import { loadDrillBank } from '../drill/store.ts';
import { loadConversationPacks } from '../conversationPacks/store.ts';
import { loadPracticeSession } from './sessionStore.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { loadScenarioProgress } from '../missions/progressStore.ts';
import { loadActivity } from '../progress/activity.ts';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { recommendation } from './recommendation.ts';
import { resumableOf } from './opening.ts';
import { practiceCard, type PracticeCard } from './practiceCard.ts';
import { practiceRouteParams } from './practiceRoute.ts';
import { homeMissionFrom, type HomeMission } from '../home/homeMission.ts';
import { MissionHero } from '../home/MissionHero.tsx';
import { buildsOn, sceneRowLine } from '../home/todayView.ts';
import { LocalPracticeCard } from './LocalPracticeCard.tsx';
import { TUTOR_OFFLINE } from '../tutor/gate.ts';
import { DEMO_REPLY_ID } from '../onboarding/tutorLines.ts';

/** Where Today places the lead (UI-015): the hero card's body, or one row on Today's path. */
export type LeadPlacement = 'hero' | 'row';

/**
 * One account-bound next action, on Home (2026-10-20, lock seam wiring: direction B moved Speak and Practice off it).
 *
 * On Today (`vivid`) the lead is `todayLead` (F936): a trial that cannot
 * start leads with plans, ahead of the starter card; the starter card drops
 * "Speak with my tutor" while offline, and "See plans" for anyone not on the
 * free plan (F935). UI-015 places it: `placement="hero"` draws the lead's body
 * on the hero card's ground with no card of its own, and `placement="row"`
 * (when the fix is the hero) draws one `RouteRow` whose press is the lead's
 * primary action, and nothing while loading or failed (the hero shows those).
 * With no placement it draws as it always has.
 */
export function NextTaskCard({ vivid = false, placement, last = false, starter = null }: { vivid?: boolean; placement?: LeadPlacement; /** placement row: the final row on the path. */ last?: boolean; starter?: GuestPractice | null }) {
  const nav = useNavigation<{ navigate(screen: string, params?: object): void }>();
  const { live } = useLive();
  const { user } = useAuth();
  const locks = useFeatureLocks(user?.id ?? null);
  const { profile } = useProfile();
  const t = useB();
  const owner = scopeGeneration();
  // A placed learner's A1 estimate comes from the placement, not a test, so the
  // old A1 cafe suggestion would hand them a Starter scene (F917).
  const startAt = startAtOf(profile);
  const startingMissionId = startAt === null && profile.brain.cefr.estimate === 'A1' && profile.brain.cefr.confidence === 'low' && profile.brain.cefr.evidence.length === 0 ? 'mission:cafe' : undefined;
  const [billing, setBilling] = useState<HomeBilling | null>(null);
  // Whether the billing read has answered (or cannot run), so nothing that
  // depends on it is drawn on a guess.
  const [billingAnswered, setBillingAnswered] = useState(false);
  const [value, setValue] = useState<{ scope: number; card: PracticeCard | null; offer: ReviewOffer; hero: HomeMission | null; buildsOn: string | null; levelIndex: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let cancelled = false; const scope = scopeGeneration(); setBilling(null); setBillingAnswered(false);
    if (live && user !== null) void fetchBillingStatus(user.id).then(result => { if (!cancelled && scope === scopeGeneration()) setBilling(result); }).catch(() => {}).finally(() => { if (!cancelled && scope === scopeGeneration()) setBillingAnswered(true); });
    else setBillingAnswered(true);
    return () => { cancelled = true; };
  }, [live, user]));
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    const scope = scopeGeneration();
    // A re-read keeps the card that is drawn until the new answer lands (F768);
    // only a card read for another account is taken down first.
    setValue(held => (held !== null && held.scope === scope ? held : null)); setFailed(false);
    void recoverPracticeCompletion().catch(() => null).then(() => Promise.all([loadDeck(), loadDrillBank(), loadConversationPacks(), loadPracticeSession(), loadMissionCompletions(), loadScenarioProgress(), loadActivity({ strict: true }), loadPackMarks()]))
      .then(([deck, bank, fetched, saved, completions, records, activity, marks]) => {
        if (cancelled || scope !== scopeGeneration()) return;
        const now = Date.now();
        const packs = withMarks(fetched, marks);
        const rec = recommendation({ resumable: resumableOf(saved, packs, bank), deck, bank, packs, now });
        const card = rec.kind === 'none' ? null : practiceCard({ rec, deck, packs, now, resuming: saved?.targets.map(t => t.phraseKey) ?? [] });
        const levelIndex = levelFor(totalXp(activity)).index;
        const hero = homeMissionFrom({ progress: missionStates(missionCompletionsFrom(completions), deck, now), records, levelIndex, startingMissionId, goal: goalOf(profile), startAt, now });
        setValue({ scope, card, offer: reviewOffer(deck, now), hero, buildsOn: buildsOn(packs, hero), levelIndex });
      }).catch(() => { if (!cancelled && scope === scopeGeneration()) setFailed(true); });
    return () => { cancelled = true; };
  }, [attempt, owner, startingMissionId, startAt]));
  const row = placement === 'row';
  const bare = placement === 'hero';
  // On a row the words are the stop's (`leadStop`), the press the lead's primary action.
  const leadRow = (lead: TodayLead | 'explore', onPress: () => void) => {
    const words = leadStop(lead, null);
    return <LeadRow lead={lead} last={last} title={words.title} line={words.line} onPress={onPress} />;
  };
  const navigateOwned = (screen: string, params?: object) => {
    if (value !== null && value.scope === scopeGeneration()) nav.navigate(screen, params);
  };
  // The plans lead's words and doors, once: on its own sun card, or (UI-015)
  // on the hero card's ground in the theme's ink.
  const plansBody = (onSun: boolean) => <PlansLeadBody onSun={onSun} body={plansLeadBody(billing)} onPlans={() => navigateOwned('Wall', { entry: 'refused' })} onCafe={() => navigateOwned('DailyPractice', { id: DEMO_REPLY_ID, mode: 'shadowing' })} />;
  const plansCard = <ColourCard ground="sun">{plansBody(true)}</ColourCard>;
  if (failed && vivid) return row ? null : (<View><Text style={type.body}>Your next task could not be read.</Text><IconAction layout="inline" icon="refresh" label="Retry next task" onPress={() => setAttempt(n => n + 1)} /></View>);
  if (failed) return <View><Text style={type.body}>Your next task could not be read.</Text><LocalPracticeCard /><IconAction layout="inline" icon="refresh" label="Retry next task" onPress={() => setAttempt(n => n + 1)} /></View>;
  if (value === null || value.scope !== scopeGeneration()) return row ? null : <Text style={type.small}>Finding your next task…</Text>;
  if (vivid) {
    // Today: one rule picks the lead (F936, F651, F924); review is its own
    // row on the path now, never the lead (DECISIONS 2026-10-29).
    const lead = sceneOrExplore(todayLead({ live, billing, starter: starter !== null, answered: billingAnswered }), value.hero !== null);
    if (lead === 'loading') return row ? null : <Text style={type.small}>Finding your next task…</Text>;
    // The starter's typed line opens in the card's own sheet, so on a row the
    // card draws a flat LeadRow as its face and the row's tap opens that sheet,
    // which is the card's primary action, Continue practice (fix round 1).
    const starterCard = (initial: GuestPractice) => <StarterContinuation initial={initial} bare={bare} />;
    const starterRow = (initial: GuestPractice) => <StarterContinuation initial={initial} face={(continuePractice) => leadRow('starter', continuePractice)} />;
    // Offline on a row: the bundled café line when the learner is at Starter;
    // past Starter the phrase and review rows below already work offline.
    const local = localPracticeFor(profile.tutorVoice, DAILY_ITEMS, TUTOR_DAILY_AUDIO);
    const localRow = () => local !== null && offlineOffer(value.levelIndex) === 'cafe' ? leadRow('local', () => nav.navigate('DailyPractice', { id: local.id, mode: 'shadowing' })) : null;
    if (lead === 'plans') {
      if (row) return leadRow(lead, () => navigateOwned('Wall', { entry: 'refused' }));
      return bare ? <View style={{ gap: space(3) }}>{plansBody(false)}</View> : plansCard;
    }
    if ((lead === 'outOfTime' || lead === 'lapsed') && billing !== null) {
      // The words, then practice that needs no minutes, with a real button
      // (fix-verifier round 2): the starter's typed line, or the local card.
      const words = heldWords(billing, Date.now());
      const then = afterHeld(starter !== null) === 'starter' && starter !== null ? 'starter' : 'local';
      if (row) {
        if (words.plans) return leadRow(lead, () => navigateOwned('Wall', { entry: 'refused' }));
        if (then === 'starter' && starter !== null) return starterRow(starter);
        // Past Starter the held words still hold the scene's stop, and the tap
        // opens the practice that needs no minutes (fix round 1).
        return local !== null ? leadRow(lead, () => nav.navigate('DailyPractice', { id: local.id, mode: 'shadowing' })) : null;
      }
      const heldText = <>
        <Text accessibilityRole="header" style={[type.heading, { color: t.text }]}>{words.title}</Text>
        <Text style={[type.body, { color: t.text }]}>{words.message}</Text>
        {words.plans && <PillButton label={PLANS_LEAD.action} onPress={() => navigateOwned('Wall', { entry: 'refused' })} />}
      </>;
      return <View style={{ gap: 12 }}>
        {bare ? <View style={{ gap: 8 }}>{heldText}</View> : <Card style={{ gap: 8 }}>{heldText}</Card>}
        {then === 'starter' && starter !== null ? starterCard(starter) : <LocalPracticeCard bare={bare} />}
      </View>;
    }
    if (lead === 'explore') {
      if (row) return leadRow(lead, () => nav.navigate('Explore'));
      return <ExploreLeadBody bare={bare} title={leadStop(lead, null).title} onExplore={() => nav.navigate('Explore')} />;
    }
    if (lead === 'starter' && starter !== null && row) return starterRow(starter);
    if (lead === 'starter' && starter !== null) return <StarterContinuation initial={starter} bare={bare} onTutor={starterTutorOpen({ live, billing, answered: billingAnswered }) ? () => nav.navigate('Tutor') : undefined} onPlans={offersPlans(billing) ? () => nav.navigate('Wall', { entry: 'recap' }) : undefined} />;
    if (lead === 'scene' && value.hero !== null) return row ? <SceneRow hero={value.hero} last={last} /> : <MissionHero hero={value.hero} vivid buildsOn={value.buildsOn} />;
    if (row) return localRow();
    return <LocalPracticeCard vivid bare={bare} levelIndex={value.levelIndex} />;
  }
  // 2026-10-20 UI-008, artboard B-Today: Today (vivid) leads with the scene
  // and never the blue "Your next practice" or "Ready for review" cards. A
  // sitting to finish is Practice's "Pick up where you stopped"; due review
  // is reached from Practice and the phrase bank.
  if (value.card !== null && !vivid) {
    const card = value.card;
    return <ColourCard ground="blue">
      <Text accessibilityRole="header" style={[type.heading, { color: paper.onInk }]}>Your next practice</Text>
      <Card><FrenchBlock french={card.phrase.fr} english={card.phrase.en} /></Card>
      {card.source !== null && <Text style={[type.small, { color: paper.onInk }]}>{card.source}</Text>}
      <PillButton tone="white" label={card.action.label} onPress={() => navigateOwned('Drill', card.action.kind === 'practice' ? card.action.params : practiceRouteParams({ origin: 'resume', packId: null, exposed: false }))} />
      <Text style={[type.small, { color: paper.onInk }]}>{card.noMinutes}</Text>
    </ColourCard>;
  }
  // Home offers only what Review will deal: a free learner's conversation
  // phrases wait for the trial, so the card falls through to the next free step.
  const review = offeredReview(value.offer, locks.access('conversationPractice'));
  const kind = nextTaskKind({ kind: 'none', fallback: 'first' }, live, billing, !vivid && review !== null);
  if (kind === 'review' && review !== null) return <ColourCard ground="blue">
    <Text accessibilityRole="header" style={[type.heading, { color: paper.onInk }]}>Ready for review</Text>
    <Card><FrenchBlock french={review.front} /></Card>
    <Text style={[type.small, { color: paper.onInk }]}>A saved phrase, ready to revisit. Free on this phone.</Text>
    <PillButton tone="white" label="Practise review" onPress={() => navigateOwned('Review')} />
  </ColourCard>;
  if (kind === 'plans') return plansCard;
  return kind === 'scene' && value.hero !== null ? <MissionHero hero={value.hero} vivid={vivid} buildsOn={vivid ? value.buildsOn : null} /> : <LocalPracticeCard vivid={vivid} />;
}

/**
 * The plans lead's words and doors, props in (UI-015, shared with the dev
 * preview): on its own sun card, or on the hero card's ground in the theme's ink.
 */
export function PlansLeadBody({ onSun, body, onPlans, onCafe }: { onSun: boolean; body: string; onPlans: () => void; onCafe: () => void }) {
  const t = useB();
  return <><Text accessibilityRole="header" style={[type.heading, onSun ? null : { color: t.text }]}>{PLANS_LEAD.title}</Text><Text style={[type.body, onSun ? null : { color: t.text }]}>{body}</Text><Text style={[type.small, onSun ? null : { color: t.muted }]}>{PLANS_LEAD.keeps}</Text><PillButton label={PLANS_LEAD.action} onPress={onPlans} /><IconAction layout="inline" ground={onSun ? 'sun' : undefined} icon="headphones" label="Try the offline café line" onPress={onCafe} /></>;
}

/** No next scene yet: Explore's door, props in (UI-015, shared with the dev preview). */
export function ExploreLeadBody({ bare, title, onExplore }: { bare: boolean; title: string; onExplore: () => void }) {
  const t = useB();
  const exploreText = <><Text style={[type.body, { color: t.text }]}>Your next scene isn't ready yet. Explore has scenes and topics you can start now.</Text><PillButton label="Open Explore" onPress={onExplore} /></>;
  return bare ? <View style={{ gap: 8 }}><Text accessibilityRole="header" style={[type.heading, { color: t.text }]}>{title}</Text>{exploreText}</View> : <Card style={{ gap: 8 }}>{exploreText}</Card>;
}

/**
 * The scene as a row on Today's path: its title, place and time, started
 * through the same tutor gate as the hero's Start. While the gate checks, the
 * row says so and cannot be pressed again; when the tutor cannot be reached,
 * the answer and the same start again sit flat under the row (fix round 1).
 */
function SceneRow({ hero, last }: { hero: HomeMission; last: boolean }) {
  const { open, checking, heldBack, label, modes } = useSceneStart(hero);
  const t = useB();
  const state = sceneRowState({ checking, heldBack: heldBack !== null, line: sceneRowLine(hero), checkingLine: label });
  return <View>
    <LeadRow lead="scene" last={last && !state.held} title={hero.title} line={state.line} disabled={state.disabled} onPress={() => open(modes.textMode)} />
    {state.held && heldBack !== null && <View style={{ gap: space(1), paddingVertical: space(2) }}>
      <Text accessibilityLiveRegion="polite" style={[type.body, { color: t.text }]}>{TUTOR_OFFLINE.body}</Text>
      <IconAction layout="inline" icon="refresh" busy={checking} disabled={checking} label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry} onPress={() => open(heldBack.textMode)} />
    </View>}
  </View>;
}

/** One lead row: the lead's drawing on its pastel (`leadRowArt`), the words and a chevron. */
export function LeadRow({ lead, last, title, line, disabled = false, onPress }: { lead: TodayLead | 'explore'; last: boolean; title: string; line: string | null; disabled?: boolean; onPress: () => void }) {
  const t = useB();
  const { art, ground } = leadRowArt(lead);
  return <RouteRow mark={last ? 'end' : 'stop'} last={last} thumb={<BArt name={art} width={ROW_ART} height={ROW_ART} />} thumbGround={t[ground]} title={title} line={line} chevron disabled={disabled} onPress={onPress} />;
}

/** The café inside the 52pt row thumb. */
const ROW_ART = 40;
