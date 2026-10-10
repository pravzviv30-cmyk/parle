/**
 * Seven days, with the learner's local today first: one disc a day from the
 * supplied week cells and real finish days alone.
 *
 * A practised day is a sun disc with a flame; today has an ink ring; a past day
 * without practice is a plain outline and a day still ahead is the quiet sand.
 * There is no "missed": nothing here marks a day the learner did not practise.
 *
 * One label for the whole strip, so a screen reader hears which days were
 * practised in one sentence rather than seven stops. When a real finish has
 * just arrived (`moment`), today's disc grows into place once; under Reduce
 * Motion, and on any later visit, it is simply there.
 */

import { StyleSheet, Text, View } from 'react-native';
import type { DayKey, WeekCell } from '@luvani/core';
import { Flame } from '../../game/art/index.ts';
import { Enter } from '../../motion/layout.tsx';
import { DUR } from '../../motion/tokens.ts';
import { colour, decorative, paper, radius, space, type } from '../../theme.ts';
import { weekLabel } from './copy.ts';

/** Today's disc grows from this scale when its finish has just arrived. */
const DISC_FROM = 0.6;

function Disc({ cell, isToday }: { cell: WeekCell; isToday: boolean }) {
  const practised = cell.state === 'practised';
  const quiet = cell.state === 'ahead' || cell.state === 'covered';
  return (
    <View style={[st.disc, practised ? st.practised : quiet ? st.ahead : st.open, isToday && st.today]}>
      {practised ? <Flame size={24} state="lit" flicker={isToday} /> : null}
    </View>
  );
}

export function WeekStrip({ week, today, moment }: { week: readonly WeekCell[]; today: DayKey; moment: string | null }) {
  const practised = week.filter((cell) => cell.state === 'practised').map((cell) => cell.name);
  return (
    <View accessible accessibilityLabel={weekLabel(practised)} style={st.strip}>
      {week.map((cell) => {
        const isToday = cell.day === today;
        const disc = <Disc cell={cell} isToday={isToday} />;
        return (
          <View key={cell.day} {...decorative} style={st.cell}>
            {isToday && cell.state === 'practised' && moment !== null ? (
              <Enter key={moment} play from="none" scaleFrom={DISC_FROM} duration={DUR.base} delay={DUR.slow} style={st.grow}>
                {disc}
              </Enter>
            ) : (
              disc
            )}
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
  /** The growing disc's frame spans its cell, so the disc keeps the cell's width. */
  grow: { alignSelf: 'stretch', alignItems: 'center' },
  disc: { width: '100%', maxWidth: space(10), aspectRatio: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  practised: { backgroundColor: colour.sun },
  open: { backgroundColor: paper.card, borderWidth: 1, borderColor: paper.line },
  ahead: { backgroundColor: paper.skeleton },
  today: { borderWidth: 2, borderColor: paper.ink },
});
