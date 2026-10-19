import { Text, View } from 'react-native';
import { Card } from '../components.tsx';
import { type } from '../theme.ts';
import { minutesOf, planFor, START_LEVELS } from './plan.ts';
import { firstPracticeScenario } from '@luvani/core';
import { briefFromDraft } from './firstLiveModel.ts';
import type { PreAccountOnboardingDraft } from './preAccountDraft.ts';
import { OnboardingScene } from './motion/OnboardingScenes.tsx';
import { C2, C2_OPTION_COPY } from './c2Presentation.ts';

/** Every plan statement is derived from answers or the authored first scene. */
export function PersonalPlan({ draft, onEdit, compact }: {
  draft: PreAccountOnboardingDraft; onEdit: () => void; compact: boolean;
}) {
  const minutes = minutesOf(draft);
  const plan = planFor(draft);
  const conversation = firstPracticeScenario(briefFromDraft(draft));
  const statedLevel = START_LEVELS.find(option => option.key === draft.startLevel);
  const goal = minutes === 'none' ? 'Practice at your pace' : `${minutes} minutes a day`;
  const practiceGoal = `${draft.practiceFocus ? `${C2_OPTION_COPY[draft.practiceFocus].title}. ` : ''}${goal}`;
  return <View style={{ gap: compact ? 12 : 16 }}>
    <Text style={[type.body, { color: C2.white, textAlign: 'center' }]}>{conversation.en}.</Text>
    <View style={{ alignItems: 'center' }}>
      <OnboardingScene kind="plan" size={compact ? 160 : 186} />
    </View>
    <Card style={{ backgroundColor: C2.reading, borderRadius: 20, gap: 8 }}>
      <Text style={[type.heading, { color: C2.ink }]}>{conversation.fr}</Text>
      {statedLevel && <Text style={[type.label, { color: C2.ink }]}>{statedLevel.title}</Text>}
      {draft.speakingConfidence && <Text style={[type.body, { color: C2.ink }]}>{C2_OPTION_COPY[draft.speakingConfidence].title}</Text>}
      <View accessible accessibilityRole="text" accessibilityLabel={practiceGoal}>
        <Text style={[type.body, { color: C2.ink }]}>{practiceGoal}</Text>
      </View>
    </Card>
    <Text style={[type.body, { color: C2.white, textAlign: 'center' }]}>{plan.method}</Text>
  </View>;
}
