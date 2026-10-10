import { Text, View } from 'react-native';
import { Card, IconAction } from '../components.tsx';
import { ProgressRing } from '../motion/ProgressRing.tsx';
import { colour, decorative, paper, type } from '../theme.ts';
import { REASON_LABELS } from './story.ts';
import { minutesOf, planFor, startingSupport } from './plan.ts';
import { ringShare } from './firstRun/planModel.ts';
import type { PreAccountOnboardingDraft } from './preAccountDraft.ts';
import { OnboardingScene } from './motion/OnboardingScenes.tsx';
import { useFontScale } from '../layout.tsx';

/** Every plan statement is derived from answers or the authored first scene. */
export function PersonalPlan({ draft, onEdit, compact }: {
  draft: PreAccountOnboardingDraft; onEdit: () => void; compact: boolean;
}) {
  const minutes = minutesOf(draft);
  const plan = planFor(draft);
  const largeText = useFontScale() >= 1.3;
  const goal = minutes === 'none' ? 'Practice at your pace' : `${minutes} minutes a day`;
  return <View style={{ gap: compact ? 12 : 16 }}>
    <View style={{ alignItems: 'center', height: compact ? 105 : 135 }}>
      <OnboardingScene kind="plan" size={compact ? 105 : 135} />
    </View>
    <Card style={{ flexDirection: largeText ? 'column' : 'row', alignItems: 'center', gap: 16 }}>
      <View accessible accessibilityRole="text" accessibilityLabel={goal}>
      <ProgressRing to={ringShare(minutes)} size={96} stroke={6} color={colour.blue} track={paper.skeleton}>
        {!largeText && <View {...decorative} style={{ width: 78, height: 78, justifyContent: 'center', alignItems: 'center', gap: 2 }}>
          <Text style={[type.stat, { color: paper.ink, textAlign: 'center' }]}>{minutes === 'none' ? '∞' : minutes}</Text>
          <Text style={[type.small, { color: paper.ink, textAlign: 'center' }]}>{minutes === 'none' ? 'your pace' : 'min/day'}</Text>
        </View>}
      </ProgressRing>
      </View>
      <View style={{ flex: largeText ? undefined : 1, minWidth: 0, gap: 4 }}>
        {largeText && <Text style={[type.heading, { color: paper.ink }]}>{goal}</Text>}
        <Text style={[type.heading, { color: paper.ink }]}>{draft.reason ? REASON_LABELS[draft.reason] : 'Everyday French'}</Text>
        <Text style={[type.small, { color: paper.ink }]}>{startingSupport(draft)}</Text>
      </View>
    </Card>
    <Card style={{ gap: 6 }}>
      <Text style={[type.small, { color: paper.inkSoft }]}>Your first practice</Text>
      <Text style={[type.heading, { color: paper.ink }]}>{plan.starter.title}</Text>
      <Text style={[type.body, { color: paper.ink }]}>{plan.method}</Text>
    </Card>
    <IconAction icon="edit" layout="inline" ground="sun" label="Change plan" onPress={onEdit} />
  </View>;
}
