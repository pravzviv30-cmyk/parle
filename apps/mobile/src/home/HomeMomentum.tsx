import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WeekRail } from '../components.tsx';
import { accent, HAIRLINE, HIT, paper, radius, space, type } from '../theme.ts';
import type { Momentum } from '../progress/momentum.ts';

/** Four compact facts, using the same honest projections as the learning stores. */
export function HomeMomentum({ momentum, onPhrases, onReview, onTarget }: {
  momentum: Momentum; onPhrases: () => void; onReview: () => void; onTarget: () => void;
}) {
  const { days, retained, mastery, goal } = momentum;
  return <View style={s.section}>
    <Text accessibilityRole="header" style={[type.title, { color: paper.ink }]}>Your French in practice</Text>
    <View style={s.grid}>
      <View style={s.tile}>
        <Text style={s.label}>Days active</Text>
        <Text style={s.value}>{days.count === null ? 'Your first day awaits' : `${days.count} ${days.words}`}</Text>
        <WeekRail week={days.week} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Retained phrases. ${retained.count ?? 'Your first phrases await'}. Open phrasebook`} onPress={onPhrases} style={({ pressed }) => [s.tile, s.phrases, pressed && s.pressed]}>
        <Text style={s.label}>Retained phrases</Text>
        <Text style={s.value}>{retained.count === null ? 'Your first phrases await' : `${retained.count} ${retained.count === 1 ? 'phrase' : 'phrases'}`}</Text>
        {retained.weekLine && <Text style={s.note}>{retained.weekLine}</Text>}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Recall. ${mastery.percentLabel ?? mastery.words}. Open phrase review`} onPress={onReview} style={({ pressed }) => [s.tile, pressed && s.pressed]}>
        <Text style={s.label}>Recall</Text>
        <Text style={s.value}>{mastery.percentLabel ?? 'After a few reviews'}</Text>
        {mastery.line && <Text style={s.note}>{mastery.line}</Text>}
      </Pressable>
      {/* Active practice time (Phase 1B): measured learning time, typed or spoken, with idle
          and away gaps left out. Never the metered live-minutes balance. `measured` is null
          only when nothing active was recorded today; a timed sitting under a minute reads
          "Under a minute today", never "nothing timed". */}
      <Pressable accessibilityRole="button" accessibilityLabel={`Practice time today. ${goal.measured ?? 'No active practice timed yet'}.${goal.untimedNote === null ? '' : ` ${goal.untimedNote}.`} Adjust optional target`} onPress={onTarget} style={({ pressed }) => [s.tile, pressed && s.pressed]}>
        <Text style={s.label}>Practice time</Text>
        <Text style={s.value}>{goal.measured ?? 'Ready when you are'}</Text>
        <Text style={s.note}>{goal.target === null ? 'Optional target' : `${goal.target} min optional target`}</Text>
        {goal.untimedNote !== null && <Text style={s.note}>{goal.untimedNote}</Text>}
      </Pressable>
    </View>
  </View>;
}
const s = StyleSheet.create({
  section: { marginTop: space(4), gap: space(3) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  tile: { flexGrow: 1, flexBasis: '46%', minWidth: 0, minHeight: HIT * 2, backgroundColor: paper.card, borderWidth: HAIRLINE, borderColor: paper.ink, borderRadius: radius.row, padding: space(3), gap: space(1) },
  phrases: { backgroundColor: accent.feature },
  label: { ...type.small, color: paper.inkSoft },
  value: { ...type.bodyStrong, color: paper.ink },
  note: { ...type.small, color: paper.inkSoft },
  pressed: { opacity: 0.75 },
});
