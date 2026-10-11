import { Text, View } from 'react-native';
import { IconAction } from '../components.tsx';
import { boldType as type, c } from './boldRhythm.ts';
import { BOLD_GOALS, INTERESTS } from './boldChoices.ts';
import { minutesOf, startingSupport, planFor } from './plan.ts';
import type { PreAccountOnboardingDraft } from './preAccountDraft.ts';
import { BoldScene } from './motion/BoldScene.tsx';
import { firstPracticeScenario } from '@luvani/core';
import { briefFromDraft } from './firstLiveModel.ts';

/** Every displayed value comes from the saved selections. */
export function PersonalPlan({ draft, onEdit, active = true }: { draft: PreAccountOnboardingDraft; onEdit: () => void; compact: boolean; active?: boolean }) {
  const minutes = minutesOf(draft);
  const plan = planFor(draft);
  const firstPractice = firstPracticeScenario(briefFromDraft(draft));
  return <View style={{ gap: 16 }}>
    <Text style={[type.body, { color: c.muted, textAlign: 'center' }]}>A plan built around your choices.</Text>
    <BoldScene kind="plan" width={220} active={active} />
    <View style={{ backgroundColor: c.white, borderRadius: 12, padding: 20, gap: 12 }}>
      <Text style={[type.heading, { color: c.ink }]}>{minutes === 'none' ? 'At your own pace' : `${minutes} minutes a day`}</Text>
      <Text style={[type.body, { color: c.ink }]}>{BOLD_GOALS.find(g => g.key === draft.reason)?.title ?? 'Everyday French'}</Text>
      <Text style={[type.body, { color: c.muted }]}>{startingSupport(draft)}</Text>
      {!!draft.interests?.length && <Text style={[type.body, { color: c.muted }]}>{draft.interests.map(i => INTERESTS.find(v => v.key === i)?.title).join(', ')}</Text>}
      <Text style={[type.body, { color: c.ink }]}>{firstPractice.en}.</Text>
      <Text style={[type.body, { color: c.muted }]}>{plan.method}</Text>
    </View>
    <IconAction icon="edit" layout="inline" label="Adjust my plan" onPress={onEdit} />
  </View>;
}
