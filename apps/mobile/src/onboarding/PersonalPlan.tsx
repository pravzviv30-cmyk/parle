/**
 * The plan page's body, to the B-OB-Plan artboard (DECISIONS.md UI-008,
 * 2026-10-21): the five stages with the learner at Starter, the first three
 * scenes and How it works. The band above it (title and answer chips) is drawn
 * by PreAccountOnboarding. Every displayed value comes from the saved selections.
 */
import { Text, View } from 'react-native';
import { firstPracticeScenario } from '@luvani/core';
import { canDoSentence } from '../components.tsx';
import { useB } from '../main/bTheme.tsx';
import type { BArtName } from '../art/BArt.tsx';
import { bType } from '../theme.ts';
import { BHowItWorks, BSceneRow, BStageCard, PLAN_STAGES } from './BOnboardingParts.tsx';
import { METHOD_LABEL, METHOD_STEPS, PLAN_SCENES_LABEL, startingSupport, planFor } from './plan.ts';
import type { PreAccountOnboardingDraft } from './preAccountDraft.ts';
import { briefFromDraft } from './firstLiveModel.ts';

/** A scene tile's drawing by its place (B-OB-Plan); a place with no canvas drawing keeps a plain tile. */
const PLACE_ART: Partial<Record<string, BArtName>> = { cafe: 'icon-cafe', hotel: 'icon-suitcase', friends: 'icon-friends', home: 'icon-house' };

export function PersonalPlan({ draft }: { draft: PreAccountOnboardingDraft; onEdit: () => void; compact: boolean; active?: boolean }) {
  const t = useB();
  const plan = planFor(draft);
  const firstPractice = firstPracticeScenario(briefFromDraft(draft));
  return <View style={{ gap: 22 }}>
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text accessibilityRole="header" style={[bType.section20, { color: t.text }]}>{`You start at ${PLAN_STAGES[0]}`}</Text>
        <Text style={[bType.meta, { color: t.muted }]}>Five stages, from first words to confident French</Text>
      </View>
      <BStageCard current={0} />
      <Text style={[bType.note, { color: t.muted }]}>{startingSupport(draft)} {plan.method}</Text>
    </View>
    <View style={{ gap: 10 }}>
      <Text accessibilityRole="header" style={[bType.section20, { color: t.text }]}>{PLAN_SCENES_LABEL}</Text>
      <View style={{ backgroundColor: t.card, borderRadius: 22, paddingVertical: 4, paddingHorizontal: 16 }}>
        {plan.scenes.map((scene, at) => <BSceneRow key={scene.id} index={at} title={scene.titleFr}
          line={at === 0 ? firstPractice.en : canDoSentence(scene.canDoEn)} first={at === 0} last={at === plan.scenes.length - 1}
          art={PLACE_ART[scene.place]} />)}
      </View>
    </View>
    <BHowItWorks title={METHOD_LABEL} steps={METHOD_STEPS} />
  </View>;
}
