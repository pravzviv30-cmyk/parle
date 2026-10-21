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
import { bType } from '../theme.ts';
import { BHowItWorks, BSceneRow, BStageCard, PLAN_STAGES } from './BOnboardingParts.tsx';
import { METHOD_LABEL, METHOD_STEPS, PLAN_SCENES_LABEL, startingSupport, planFor } from './plan.ts';
import type { PreAccountOnboardingDraft } from './preAccountDraft.ts';
import { briefFromDraft } from './firstLiveModel.ts';
import { planSceneRows } from './planScenes.ts';

export function PersonalPlan({ draft }: { draft: PreAccountOnboardingDraft; onEdit: () => void; compact: boolean; active?: boolean }) {
  const t = useB();
  const plan = planFor(draft);
  const firstPractice = firstPracticeScenario(briefFromDraft(draft));
  const rows = planSceneRows(plan.scenes, canDoSentence);
  return <View style={{ gap: 22 }}>
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text accessibilityRole="header" style={[bType.section20, { color: t.text }]}>{`You start at ${PLAN_STAGES[0]}`}</Text>
        <Text style={[bType.meta, { color: t.muted }]}>Five stages, from first words to confident French</Text>
      </View>
      <BStageCard current={0} />
      <Text style={[bType.note, { color: t.muted }]}>{startingSupport(draft)} {plan.method}</Text>
      {/* The live first conversation is its own authored practice, named apart from the scene list. */}
      <Text style={[bType.note, { color: t.muted }]}>{`Your first conversation: ${firstPractice.en.toLocaleLowerCase()}.`}</Text>
    </View>
    <View style={{ gap: 10 }}>
      <Text accessibilityRole="header" style={[bType.section20, { color: t.text }]}>{PLAN_SCENES_LABEL}</Text>
      <View style={{ backgroundColor: t.card, borderRadius: 22, paddingVertical: 4, paddingHorizontal: 16 }}>
        {/* 2026-10-21 simulator check: title, line and drawing all from the same scene. */}
        {rows.map((row, at) => <BSceneRow key={row.id} index={at} title={row.title} line={row.line}
          first={at === 0} last={at === rows.length - 1} art={row.icon} />)}
      </View>
    </View>
    <BHowItWorks title={METHOD_LABEL} steps={METHOD_STEPS} />
  </View>;
}
