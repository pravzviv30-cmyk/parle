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
import { nextTaskKind } from './nextTask.ts';
import { recoverPracticeCompletion } from './completion.ts';
import { loadPackMarks, withMarks } from '../conversationPacks/marks.ts';
import { useLive } from '../app/LiveContext.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
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
import { LocalPracticeCard } from './LocalPracticeCard.tsx';
import { DEMO_REPLY_ID } from '../onboarding/tutorLines.ts';

/** One account-bound next action, on Home (2026-10-20, lock seam wiring: direction B moved Speak and Practice off it). */
export function NextTaskCard({ vivid = false }: { vivid?: boolean }) {
  const nav = useNavigation<{ navigate(screen: string, params?: object): void }>();
  const { live } = useLive();
  const { user } = useAuth();
  const locks = useFeatureLocks(user?.id ?? null);
  const { profile } = useProfile();
  const owner = scopeGeneration();
  const startingMissionId = profile.brain.cefr.estimate === 'A1' && profile.brain.cefr.confidence === 'low' && profile.brain.cefr.evidence.length === 0 ? 'mission:cafe' : undefined;
  const [billing, setBilling] = useState<HomeBilling | null>(null);
  const [value, setValue] = useState<{ scope: number; card: PracticeCard | null; offer: ReviewOffer; hero: HomeMission | null } | null>(null);
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
        const hero = homeMissionFrom({ progress: missionStates(missionCompletionsFrom(completions), deck, now), records, levelIndex: levelFor(totalXp(activity)).index, startingMissionId, now });
        setValue({ scope, card, offer: reviewOffer(deck, now), hero });
      }).catch(() => { if (!cancelled && scope === scopeGeneration()) setFailed(true); });
    return () => { cancelled = true; };
  }, [attempt, owner, startingMissionId]));
  const navigateOwned = (screen: string, params?: object) => {
    if (value !== null && value.scope === scopeGeneration()) nav.navigate(screen, params);
  };
  if (failed) return <View><Text style={type.body}>Your next task could not be read.</Text><LocalPracticeCard /><IconAction layout="inline" icon="refresh" label="Retry next task" onPress={() => setAttempt(n => n + 1)} /></View>;
  if (value === null || value.scope !== scopeGeneration()) return <Text style={type.small}>Finding your next task…</Text>;
  if (value.card !== null) {
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
  const kind = nextTaskKind({ kind: 'none', fallback: 'first' }, live, billing, review !== null);
  if (kind === 'review' && review !== null) return <ColourCard ground="blue">
    <Text accessibilityRole="header" style={[type.heading, { color: paper.onInk }]}>Ready for review</Text>
    <Card><FrenchBlock french={review.front} /></Card>
    <Text style={[type.small, { color: paper.onInk }]}>A saved phrase, ready to revisit. Free on this phone.</Text>
    <PillButton tone="white" label="Practise review" onPress={() => navigateOwned('Review')} />
  </ColourCard>;
  if (kind === 'plans') return <ColourCard ground="sun"><Text accessibilityRole="header" style={type.heading}>{PLANS_LEAD.title}</Text><Text style={type.body}>{plansLeadBody(billing)}</Text><Text style={type.small}>{PLANS_LEAD.keeps}</Text><PillButton label={PLANS_LEAD.action} onPress={() => navigateOwned('Wall', { entry: 'refused' })} /><IconAction layout="inline" ground="sun" icon="headphones" label="Try the offline café line" onPress={() => navigateOwned('DailyPractice', { id: DEMO_REPLY_ID, mode: 'shadowing' })} /></ColourCard>;
  return kind === 'scene' && value.hero !== null ? <MissionHero hero={value.hero} vivid={vivid} /> : <LocalPracticeCard vivid={vivid} />;
}
