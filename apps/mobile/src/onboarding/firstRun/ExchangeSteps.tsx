/**
 * Where the learner is in the first practice (come alive, README Part 5.C row
 * 7): one segment per real exchange, the ones done and the one in hand filled,
 * and the words "Exchange 1 of 2" for a screen reader and the eye alike. It is
 * drawn only when the practice has more than one exchange. Still: it changes
 * when the learner moves on, and never on its own.
 */

import { StyleSheet, Text, View } from 'react-native';
import { colour, paper, radius, space, type } from '../../theme.ts';
import { exchangeLabel } from './copy.ts';

export function ExchangeSteps({ index, total }: { index: number; total: number }) {
  if (total < 2) return null;
  const label = exchangeLabel(index, total);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Exchanges"
      accessibilityValue={{ min: 1, max: total, now: Math.min(total, index + 1), text: label }}
      style={st.steps}
    >
      <View style={st.track}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[st.segment, { backgroundColor: i <= index ? colour.blue : paper.skeleton }]} />
        ))}
      </View>
      <Text style={[type.small, { color: paper.ink }]}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  steps: { flex: 1, gap: space(1) },
  track: { flexDirection: 'row', gap: space(1) },
  segment: { flex: 1, height: 8, borderRadius: radius.pill },
});
