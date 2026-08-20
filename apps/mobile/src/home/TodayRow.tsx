/**
 * Today, drawn.
 *
 * Two marks in `ProgressDots`' grammar rather than a new primitive: a filled
 * dot for a sitting done, a hairline ring for one still available. Never a
 * number, never red, and never rendered at all until the learner has done
 * something, which is the whole reason this cannot read as a debt.
 *
 * The rule about which colour goes where matters here. A filled mark uses
 * `signal.good`, because green means the learner produced French, which is
 * exactly what it means everywhere else in the app. The waiting mark is a
 * hairline in `paper.line` and not a colour at all, because a thing that has
 * not happened is not a state worth signalling.
 */

import { View, Text, StyleSheet } from 'react-native';
import { paper, signal, space, type, HAIRLINE } from '../theme.ts';
import { hasToday, type Today } from '../progress/today.ts';

const MARK = 10;

export function TodayRow({ today }: { today: Today }) {
  if (!hasToday(today)) return null;

  const marks = Math.max(today.marks, today.done);

  return (
    <View style={st.row} accessibilityRole="summary">
      <View style={st.marks} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: marks }, (_, i) => (
          <View key={i} style={[st.mark, i < today.done ? st.done : st.waiting]} />
        ))}
      </View>
      <View style={st.words}>
        <Text style={[type.bodyStrong, { color: paper.ink }]}>{today.headline}</Text>
        <Text style={[type.small, { color: paper.inkSoft }]}>{today.sub}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(4) },
  marks: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  mark: { width: MARK, height: MARK, borderRadius: MARK / 2 },
  done: { backgroundColor: signal.good },
  waiting: { borderWidth: HAIRLINE + 0.4, borderColor: paper.line },
  words: { flex: 1, gap: space(0.5) },
});
