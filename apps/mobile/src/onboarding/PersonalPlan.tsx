/**
 * The plan page's body, to the B-OB-Plan artboard (DECISIONS.md UI-008,
 * 2026-10-21): the five stages with the learner at their starting point, the
 * first three scenes and How it works. The band above it (title and answer
 * chips) is drawn by PreAccountOnboarding. Every displayed value comes from the
 * saved selections.
 *
 * F916/F917 (2026-10-29): the heading and stage card follow the placement,
 * the first-conversation line names the scene really played next (the guest
 * café before an account), and "Skip ahead" is a quiet secondary link.
 */
import { Text, View } from 'react-native';
import { canDoSentence, Press } from '../components.tsx';
import { useB } from '../main/bTheme.tsx';
import { bType } from '../theme.ts';
import { BHowItWorks, BSceneRow, BStageCard } from './BOnboardingParts.tsx';
import { METHOD_LABEL, METHOD_STEPS, PLAN_SCENES_LABEL, SKIP_AHEAD, SKIP_AHEAD_HINT, firstConversationLines, planFor } from './plan.ts';
import type { PreAccountOnboardingDraft } from './preAccountDraft.ts';
import { planSceneRows } from './planScenes.ts';

export function PersonalPlan({ draft, guestScene, onSkipAhead }: { draft: PreAccountOnboardingDraft; onEdit: () => void; compact: boolean; active?: boolean; guestScene: boolean; onSkipAhead: () => void }) {
  const t = useB();
  const plan = planFor(draft);
  const lines = firstConversationLines(draft, { guestScene });
  const rows = planSceneRows(plan.scenes, canDoSentence);
  return <View style={{ gap: 22 }}>
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text accessibilityRole="header" style={[bType.section20, { color: t.text }]}>{plan.heading}</Text>
        <Text style={[bType.meta, { color: t.muted }]}>Five stages, from first words to confident French</Text>
      </View>
      <BStageCard current={plan.stage} />
      {plan.canSkipAhead ? <Press accessibilityRole="button" accessibilityLabel={SKIP_AHEAD} accessibilityHint={SKIP_AHEAD_HINT} onPress={onSkipAhead}
        style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
        <Text style={[bType.bold14, { color: t.link }]}>{SKIP_AHEAD}</Text>
      </Press> : null}
      <Text style={[bType.note, { color: t.muted }]}>{plan.method}</Text>
      {plan.gentle !== null ? <Text style={[bType.note, { color: t.muted }]}>{plan.gentle}</Text> : null}
      <Text style={[bType.note, { color: t.muted }]}>{lines.first}</Text>
      {lines.comingUp !== null ? <Text style={[bType.note, { color: t.muted }]}>{lines.comingUp}</Text> : null}
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
