import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Label, WeekRail } from '../components.tsx';
import { accent, HAIRLINE, HIT, paper, radius, space, type } from '../theme.ts';
import type { Momentum } from '../progress/momentum.ts';

/** Compact evidence from the same model as Progress; no invented activity. */
export function HomeMomentum({ momentum, onProgress, onPhrases }: {
  momentum: Momentum;
  onProgress: () => void;
  onPhrases: () => void;
}) {
  return (
    <View style={s.section}>
      <View style={s.heading}>
        <Text style={[type.title, { color: paper.ink }]}>Your French, growing.</Text>
      </View>
      <View style={s.grid}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Your speaking rhythm. ${momentum.days.count === null ? 'Make a little room.' : `${momentum.days.count} ${momentum.days.words}.`} Open real progress`} onPress={onProgress} style={({ pressed }) => [s.tile, pressed && s.pressed]}>
          <Label>Your rhythm</Label>
          <Text style={s.value}>{momentum.days.count === null ? 'Make a little room.' : `${momentum.days.count} ${momentum.days.words}`}</Text>
          <WeekRail week={momentum.days.week} />
          <Text style={s.note}>A week of small moments</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Your retained phrases. ${momentum.retained.count === null ? 'Words to keep.' : `${momentum.retained.count} ${momentum.retained.count === 1 ? 'phrase' : 'phrases'}.`} Open phrasebook`} onPress={onPhrases} style={({ pressed }) => [s.tile, s.phrases, pressed && s.pressed]}>
          <Label>Your words</Label>
          <Text style={s.value}>{momentum.retained.count === null ? 'Words to keep.' : `${momentum.retained.count} ${momentum.retained.count === 1 ? 'phrase' : 'phrases'}`}</Text>
          <Text style={s.note}>{momentum.retained.chips[0] ?? 'Useful French from your conversations.'}</Text>
          <ArrowRight />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginTop: space(6), gap: space(3) },
  heading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: space(2) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  tile: { flexGrow: 1, flexBasis: 140, minWidth: 0, minHeight: HIT * 3, backgroundColor: paper.card, borderWidth: HAIRLINE, borderColor: paper.ink, borderRadius: radius.row, padding: space(3), gap: space(2) },
  phrases: { backgroundColor: accent.feature },
  value: { ...type.french, color: paper.ink },
  note: { ...type.small, color: paper.inkSoft },
  pressed: { backgroundColor: paper.groundDeep },
});
