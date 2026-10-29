import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { levelFor, missionStates, totalXp } from '@luvani/core';
import { Card, ColourCard, FrenchBlock, IconAction, PillButton } from '../components.tsx';
import { paper, type } from '../theme.ts';
import { useAuth } from '../auth/useAuth.tsx';
import { fetchBillingStatus } from '../purchases/client.ts';
import type { HomeBilling } from '../home/nextAction.ts';
import { PLANS_LEAD, plansLeadBody } from '../home/nextAction.ts';
import { nextTaskKind, offersPlans, todayLead, type TodayLead } from './nextTask.ts';
import type { ReactNode } from 'react';
import { RouteNode, type RouteMark } from '../home/RoutePath.tsx';
import { pathStep } from '../home/todayView.ts';
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
import { buildsOn } from '../home/todayView.ts';
import { LocalPracticeCard } from './LocalPracticeCard.tsx';
import { DEMO_REPLY_ID } from '../onboarding/tutorLines.ts';

/** The scene stop's words for each lead: the scene's own minutes, or what the lead honestly is. */
function leadStop(lead: TodayLead | 'loading', minutes: number | null): { title: string; line: string } {
  if (lead === 'scene' && minutes !== null) return pathStep('scene', minutes);
  if (lead === 'plans') return { title: 'The next scene', line: 'Needs more speaking time' };
  if (lead === 'starter') return { title: 'Continue your practice', line: 'Typed, no connection needed' };
  if (lead === 'local') return { title: "While you're offline", line: 'No connection needed' };
  return { title: 'The next scene', line: 'Finding your next task' };
}

/**
 * One account-bound next action, on Home (2026-10-20, lock seam wiring: direction B moved Speak and Practice off it).
 *
 * On Today (`vivid`) it is the second stop on Today's path (F934): `step`
 * places it on the route. The lead is `todayLead` (F936): a trial that cannot
 * start leads with plans, ahead of the starter card; the starter card drops
 * "Speak with my tutor" while offline, and "See plans" for anyone not on the
 * free plan (F935).
 */
export function NextTaskCard({ vivid = false, step, starter = null }: { vivid?: boolean; step?: { mark: RouteMark; last: boolean }; starter?: GuestPractice | null }) {
  const nav = useNavigation<{ navigate(screen: string, params?: object): void }>();
  const { live } = useLive();
  const { user } = useAuth();
  const locks = useFeatureLocks(user?.id ?? null);
  const { profile } = useProfile();
  const owner = scopeGeneration();
  // A placed learner's A1 estimate comes from the placement, not a test, so the
  // old A1 cafe suggestion would hand them a Starter scene (F917).
  const startAt = startAtOf(profile);
  const startingMissionId = startAt === null && profile.brain.cefr.estimate === 'A1' && profile.brain.cefr.confidence === 'low' && profile.brain.cefr.evidence.length === 0 ? 'mission:cafe' : undefined;
  const [billing, setBilling] = useState<HomeBilling | null>(null);
  const [value, setValue] = useState<{ scope: number; card: PracticeCard | null; offer: ReviewOffer; hero: HomeMission | null; buildsOn: string | null; levelIndex: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let cancelled = false; const scope = scopeGeneration(); setBilling(null);
    if (live && user !== null) void fetchBillingStatus(user.id).then(result => { if (!cancelled && scope === scopeGeneration()) setBilling(result); }).catch(() => {});
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
  const onStop = (lead: TodayLead | 'loading', minutes: number | null, body: ReactNode) => {
    if (step === undefined) return body;
    const words = leadStop(lead, minutes);
    return <RouteNode mark={step.mark} last={step.last} title={words.title} line={words.line}>{body}</RouteNode>;
  };
  const navigateOwned = (screen: string, params?: object) => {
    if (value !== null && value.scope === scopeGeneration()) nav.navigate(screen, params);
  };
  const plansCard = <ColourCard ground="sun"><Text accessibilityRole="header" style={type.heading}>{PLANS_LEAD.title}</Text><Text style={type.body}>{plansLeadBody(billing)}</Text><Text style={type.small}>{PLANS_LEAD.keeps}</Text><PillButton label={PLANS_LEAD.action} onPress={() => navigateOwned('Wall', { entry: 'refused' })} /><IconAction layout="inline" ground="sun" icon="headphones" label="Try the offline café line" onPress={() => navigateOwned('DailyPractice', { id: DEMO_REPLY_ID, mode: 'shadowing' })} /></ColourCard>;
  if (failed && vivid) return onStop('loading', null, <View><Text style={type.body}>Your next task could not be read.</Text><IconAction layout="inline" icon="refresh" label="Retry next task" onPress={() => setAttempt(n => n + 1)} /></View>);
  if (failed) return <View><Text style={type.body}>Your next task could not be read.</Text><LocalPracticeCard /><IconAction layout="inline" icon="refresh" label="Retry next task" onPress={() => setAttempt(n => n + 1)} /></View>;
  if (value === null || value.scope !== scopeGeneration()) return onStop('loading', null, <Text style={type.small}>Finding your next task…</Text>);
  if (vivid) {
    // Today: one rule picks the lead (F936, F651, F924); review is its own
    // row on the path now, never the lead (DECISIONS 2026-10-29).
    const lead = todayLead({ live, billing, starter: starter !== null });
    if (lead === 'plans') return onStop(lead, null, plansCard);
    if (lead === 'starter' && starter !== null) return onStop(lead, null, <StarterContinuation initial={starter} onTutor={live ? () => nav.navigate('Tutor') : undefined} onPlans={offersPlans(billing) ? () => nav.navigate('Wall', { entry: 'recap' }) : undefined} />);
    if (lead === 'scene' && value.hero !== null) return onStop(lead, value.hero.minutes, <MissionHero hero={value.hero} vivid buildsOn={value.buildsOn} />);
    return onStop('local', null, <LocalPracticeCard vivid levelIndex={value.levelIndex} />);
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
