import { Text, View } from 'react-native';
import { boldType as type, c } from './boldRhythm.ts';
import { BOLD_GOALS, INTERESTS } from './boldChoices.ts';
import { CONFIDENCE_OPTIONS, FOCUS_OPTIONS, START_LEVELS, minutesOf, startingSupport, planFor } from './plan.ts';
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
    <Text style={[type.body, { color: c.white, textAlign: 'center' }]}>Your first stop: {firstPractice.en.toLocaleLowerCase()}.</Text>
    <BoldScene kind="plan" width={230} active={active} />
    <View style={{ backgroundColor: c.paper, borderRadius: 20, padding: 18, gap: 8 }}>
      <Text style={[type.heading, { color: c.ink }]}>{firstPractice.en}</Text>
      <Text style={[type.body, { color: c.ink }]}>{BOLD_GOALS.find(g => g.key === draft.reason)?.title ?? 'Everyday French'}{draft.interests?.length ? `, ${draft.interests.map(i => INTERESTS.find(v => v.key === i)?.title).join(' + ')}` : ''}</Text>
      <Text style={[type.body, { color: c.ink }]}>{[START_LEVELS.find(v => v.key === draft.startLevel)?.title, CONFIDENCE_OPTIONS.find(v => v.key === draft.speakingConfidence)?.title].filter(Boolean).join(', ')}</Text>
      <Text style={[type.body, { color: c.ink }]}>{[FOCUS_OPTIONS.find(v => v.key === draft.practiceFocus)?.title, minutes === 'none' ? 'Choose each time' : `${minutes} minutes`].filter(Boolean).join(', ')}</Text>
    </View>
    <Text style={[type.body, { color: c.white, textAlign: 'center' }]}>{startingSupport(draft)} {plan.method}</Text>
  </View>;
}
