/**
 * Seven days, with the learner's local today first: one disc a day from the
 * supplied week cells and real finish days alone.
 *
 * A practised day is a sun disc with a flame; today has an ink ring; a past day
 * without practice is a plain outline and a day still ahead is the quiet sand.
 * There is no "missed": nothing here marks a day the learner did not practise.
 *
 * One label for the whole strip, so a screen reader hears which days were
 * practised in one sentence rather than seven stops.
 */

import { StyleSheet, Text, View } from 'react-native';
import type { DayKey, WeekCell } from '@luvani/core';
import { Flame } from '../../game/art/index.ts';
import { colour, decorative, paper, radius, space, type } from '../../theme.ts';
import { weekLabel } from './copy.ts';

function Disc({ cell, isToday }: { cell: WeekCell; isToday: boolean }) {
  const practised = cell.state === 'practised';
  const quiet = cell.state === 'ahead' || cell.state === 'covered';
  return (
    <View style={[st.disc, practised ? st.practised : quiet ? st.ahead : st.open, isToday && st.today]}>
      {practised ? <Flame size={24} state="lit" flicker={isToday} /> : null}
    </View>
  );
}

export function WeekStrip({ week, today }: { week: readonly WeekCell[]; today: DayKey }) {
  const practised = week.filter((cell) => cell.state === 'practised').map((cell) => cell.name);
  return (
    <View accessible accessibilityLabel={weekLabel(practised)} style={st.strip}>
      {week.map((cell) => {
        const isToday = cell.day === today;
        return (
          <View key={cell.day} {...decorative} style={st.cell}>
            <Disc cell={cell} isToday={isToday} />
            <Text style={[type.small, { color: isToday ? paper.ink : paper.inkSoft }]}>{cell.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  strip: { flexDirection: 'row', justifyContent: 'space-between', gap: space(1) },
  cell: { flex: 1, alignItems: 'center', gap: space(1) },
  disc: { width: '100%', maxWidth: space(10), aspectRatio: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  practised: { backgroundColor: colour.sun },
  open: { backgroundColor: paper.card, borderWidth: 1, borderColor: paper.field },
  // A day still ahead: a dashed field ring, told from an open day's solid one by the dash (F921 round 4).
  ahead: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: paper.field },
  today: { borderWidth: 2, borderColor: paper.ink },
});
