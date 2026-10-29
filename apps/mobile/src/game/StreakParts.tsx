/**
 * The parts the Streak screen is drawn from, to the B-Streak artboard
 * (2026-10-20 UI-008, artboard B-Streak), in light and dark.
 *
 * Pure presentation: every word and every day's state arrives from
 * `streakScreenView.ts` and `streakNudge.ts`, and every colour is a `useB()`
 * token. The snowflake is the artboard's own path. Marks (circles, rings, the
 * bar) are decoration: each cell's spoken label says what the day was.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BArt } from '../art/BArt.tsx';
import { LockBadge, Press } from '../components.tsx';
import { lockSpoken } from '../access/featureAccess.ts';

import { ChevronGlyph } from '../explore/ExploreParts.tsx';
import { Icon } from '../icons/Icon.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { tapSettled } from '../motion/haptics.ts';
import { HIT, accent, bType, decorative, paper, type } from '../theme.ts';
import { RepairMark } from './art/RepairMark.tsx';
import { monthWeeks, type DayCellView, type MonthView } from './streakScreenView.ts';

/** The second freeze and the repair come with any paid plan (D4, D23), so the lock names Core (F910). */
const STREAK_REPAIR_PLAN = 'starter' as const;

const CIRCLE = 36;

/** The artboard's snowflake (stroke 2). */
export function Snowflake({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** The week strip's white card: seven circles over their letters. */
export function WeekStrip({ week }: { week: readonly DayCellView[] }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.weekCard}>
      {week.map((cell) => (
        <View key={cell.day} style={s.weekCol} accessible accessibilityLabel={cell.label}>
          <DayCircle cell={cell} />
          <Text style={[cell.today ? bType.heavy12 : bType.semi12, { color: cell.today ? t.text : t.muted }]}>{cell.mark}</Text>
        </View>
      ))}
    </View>
  );
}

/** A practised day is sun with the flame; a covered one lavender with what covered it; today a dashed ring; the rest the inset well. */
function DayCircle({ cell }: { cell: DayCellView }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  if (cell.state === 'practised') {
    return <View {...decorative} style={[s.circle, { backgroundColor: t.sun }]}><BArt name="flame" width={18} height={22} /></View>;
  }
  if (cell.state === 'covered') {
    return (
      <View {...decorative} style={[s.circle, { backgroundColor: t.lavender }]}>
        {cell.cover === 'repair' ? <RepairMark size={22} /> : cell.cover === 'travel' ? <Icon name="trip" variant="bulk" size={18} color={t.link} /> : <Snowflake size={18} color={t.link} />}
      </View>
    );
  }
  if (cell.state === 'today-open') return <View {...decorative} style={[s.circle, s.todayRing]} />;
  return <View {...decorative} style={[s.circle, { backgroundColor: t.inset }]} />;
}

/** The freeze card: the snowflake disc, the title and its line, the paragraph, and the trial pill's footer. */
export function FreezeCard({ title, sub, line, returns, upsell, onUpsell }: { title: string; sub: string; line: string; returns: string | null; upsell: string | null; onUpsell: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.freeze}>
      <View style={s.freezeHead}>
        <View {...decorative} style={s.freezeDisc}><Snowflake size={28} color={t.link} /></View>
        <View style={s.grow}>
          <Text accessibilityRole="header" style={[bType.bold18, { color: t.text }]}>{title}</Text>
          <Text style={[bType.meta, { color: t.muted }]}>{sub}</Text>
        </View>
      </View>
      <Text style={[bType.para15, { color: t.secondary }]}>{line}</Text>
      {returns !== null ? <Text style={[bType.para15, { color: t.secondary }]}>{returns}</Text> : null}
      {upsell !== null ? (
        <Press haptic="light" accessibilityRole="button" accessibilityLabel={`${upsell}. ${lockSpoken(STREAK_REPAIR_PLAN)}`} onPress={onUpsell} style={s.upsell}>
          <Text style={[bType.meta, { color: t.secondary }]}>{upsell}</Text>
          <LockBadge plan={STREAK_REPAIR_PLAN} said />
        </Press>
      ) : null}
    </View>
  );
}

/** A 20/800 section head with an optional right-hand part. */
export function StreakHead({ title, right }: { title: string; right?: ReactNode }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.head}>
      <Text accessibilityRole="header" style={[bType.section20, s.grow, { color: t.text }]}>{title}</Text>
      {right}
    </View>
  );
}

/** The milestone row: the peach tile with the café table, the title, the bar and "n of 7 days". */
export function MilestoneRow({ title, progress, fraction }: { title: string; progress: string; fraction: number }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.milestone} accessible accessibilityLabel={`${title}. ${progress}`}>
      <View {...decorative} style={s.tile}><BArt name="cafe-table" width={70} height={64} style={s.tileArt} /></View>
      <View style={[s.grow, s.gap6]}>
        <Text style={[bType.bold16, { color: t.text }]}>{title}</Text>
        <View {...decorative} style={s.track}><View style={[s.fill, { width: `${Math.round(fraction * 100)}%` }]} /></View>
        <Text style={[bType.note, { color: t.muted }]}>{progress}</Text>
      </View>
    </View>
  );
}

/** A 44pt white month arrow, off where the months run out. */
export function MonthArrow({ label, back, disabled, onPress }: { label: string; back: boolean; disabled: boolean; onPress: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <Press haptic="selection" accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.arrow, disabled && s.off]}>
      <ChevronGlyph size={18} color={disabled ? t.muted : t.text} back={back} />
    </Press>
  );
}

/** The month card: the weekday letters, the leading blanks, and the dates. */
export function MonthGrid({ month, weekdays }: { month: MonthView; weekdays: readonly string[] }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.monthCard}>
      {/* 2026-10-21 (simulator, 402pt): no wrapping and no percentages. The
          header and every week are their own row of seven equal flex cells
          (`monthWeeks`), so a seventh cell can never be pushed to the next line. */}
      <View style={s.week} {...decorative}>
        {weekdays.map((letter, i) => <View key={i} style={s.dateCol}><Text numberOfLines={1} style={[bType.bold12, s.weekday, { color: t.muted }]}>{letter}</Text></View>)}
      </View>
      {monthWeeks(month.leading, month.cells).map((week, w) => (
        <View key={w} style={s.week}>
          {week.map((cell, i) => cell === null ? <View key={`blank-${w}-${i}`} style={s.dateCol} /> : (
            <View key={cell.day} style={s.dateCol} accessible accessibilityLabel={cell.label}>
              <DateCell cell={cell} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** A practised date is sun, 700; today a brand ring, 800; a covered one lavender; the rest muted. */
function DateCell({ cell }: { cell: DayCellView }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const practised = cell.state === 'practised';
  const covered = cell.state === 'covered';
  // Ink on sun in both modes (onMint is the ink a sun or mint disc carries).
  const ink = practised ? t.onMint : cell.today ? t.link : covered ? t.text : t.muted;
  return (
    <View style={[s.date, practised && { backgroundColor: t.sun }, covered && { backgroundColor: t.lavender }, cell.today && s.dateToday]}>
      <Text style={[practised ? bType.bold14 : cell.today ? bType.heavy14 : bType.meta, { color: ink }]}>{cell.mark}</Text>
    </View>
  );
}

/** "How a day counts": the lavender card. */
export function HowCard({ title, line }: { title: string; line: string }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.how}>
      <Text accessibilityRole="header" style={[bType.bold16, { color: t.text }]}>{title}</Text>
      <Text style={[bType.para15, { color: t.secondary }]}>{line}</Text>
    </View>
  );
}

/** The Evening nudge row: the alarm clock, the words, and the daily reminder's switch. */
export function NudgeRow({ title, line, note, trouble, on, busy, onChange }: { title: string; line: string; note: string; trouble: string | null; on: boolean; busy: boolean; onChange: (next: boolean) => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  // The off track is the field grey on iOS and elsewhere alike (SwitchRow, F736).
  const offTrack = paper.field;
  return (
    <View style={s.nudgeCard}>
      <View style={s.nudge}>
        <BArt name="alarm-clock" width={44} height={40} />
        <View style={[s.grow, s.gap2]}>
          <Text style={[type.label, { color: t.text }]}>{title}</Text>
          <Text style={[bType.note, { color: t.muted }]}>{line}</Text>
        </View>
        <Switch
          value={on}
          disabled={busy}
          onValueChange={(next) => {
            tapSettled();
            onChange(next);
          }}
          accessibilityLabel={title}
          accessibilityHint={line}
          trackColor={{ true: accent.brand, false: offTrack }}
          ios_backgroundColor={offTrack}
          thumbColor={paper.card}
        />
      </View>
      {note.length > 0 ? <Text style={[bType.note, s.below, { color: t.muted }]}>{note}</Text> : null}
      {trouble !== null ? <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={[bType.note, s.below, { color: t.text }]}>{trouble}</Text> : null}
    </View>
  );
}

const makeStyles = (t: B) =>
  StyleSheet.create({
    grow: { flex: 1, minWidth: 0 },
    gap2: { gap: 2 },
    gap6: { gap: 6 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    // The week strip.
    weekCard: { backgroundColor: t.card, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 12, flexDirection: 'row', marginTop: 6 },
    weekCol: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6 },
    circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: 'center', justifyContent: 'center' },
    todayRing: { borderWidth: 2.5, borderStyle: 'dashed', borderColor: t.link },
    // The freeze card.
    freeze: { backgroundColor: t.card, borderRadius: 24, padding: 16, gap: 12, borderWidth: 2, borderColor: t.periwinkle },
    freezeHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    freezeDisc: { width: 52, height: 52, borderRadius: 26, backgroundColor: t.lavender, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    upsell: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: t.line, paddingTop: 10, minHeight: HIT },
    // The milestone.
    milestone: { backgroundColor: t.card, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
    tile: { width: 64, height: 64, borderRadius: 16, backgroundColor: t.peach, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
    tileArt: { marginTop: 8 },
    track: { height: 8, borderRadius: 4, backgroundColor: t.inset, overflow: 'hidden' },
    fill: { height: 8, borderRadius: 4, backgroundColor: t.sun },
    // The month.
    arrow: { width: HIT, height: HIT, borderRadius: HIT / 2, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' },
    off: { opacity: 0.5 },
    monthCard: { backgroundColor: t.card, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 12, gap: 4 },
    weekday: { textAlign: 'center' },
    week: { flexDirection: 'row' },
    dateCol: { flex: 1, minWidth: 0, paddingHorizontal: 2 },
    date: { minHeight: CIRCLE, borderRadius: CIRCLE / 2, alignItems: 'center', justifyContent: 'center' },
    dateToday: { borderWidth: 2, borderColor: t.link },
    // How a day counts.
    how: { backgroundColor: t.lavender, borderRadius: 22, padding: 16, gap: 8 },
    // The nudge.
    nudgeCard: { backgroundColor: t.card, borderRadius: 22, paddingVertical: 4, paddingHorizontal: 16 },
    nudge: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: HIT },
    below: { paddingBottom: 12 },
  });
