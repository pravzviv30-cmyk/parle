/**
 * The seven named talk-day chips in two rows (T1.4), shared by the ask's step 2
 * and the Settings sheet. What a press does is the caller's (`talkDayPress`
 * in `settings/talkDays.ts`, the ask's own `pressDay`); this only draws.
 */
import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Press } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { HIT, bType, radius, space, type } from '../theme.ts';
import { TALK_DAYS_COPY, TALK_DAY_ORDER, talkDayBlocked, talkDayLabel, talkDayReason, talkDaysValue } from './reminder.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';

export function TalkDayChips({ picked, onPressDay }: { picked: readonly number[]; onPressDay: (day: number) => void }): ReactElement {
  const t = useB();
  const st = useThemedStyles(makeSt);
  const chip = (day: number) => {
    const chosen = picked.includes(day);
    const blocked = talkDayBlocked(picked, day);
    const reason = talkDayReason(picked, day);
    return (
      <Press
        key={day}
        haptic="selection"
        selected={chosen}
        frame={st.cell}
        style={[st.chip, { backgroundColor: chosen ? t.brandMark : blocked ? t.skeleton : t.quiet }]}
        accessibilityLabel={talkDayLabel(picked, day)}
        accessibilityState={{ selected: chosen, disabled: blocked }}
        onPress={() => {
          onPressDay(day);
          // A blocked chip says why but ignores the press: no tick.
          return blocked ? false : undefined;
        }}
      >
        <View style={st.chipHead}>
          {chosen ? <Icon name="check" size={16} color={t.onBrand} /> : null}
          <Text style={[type.button, { textAlign: 'center', color: chosen ? t.onBrand : blocked ? t.muted : t.text }]}>{talkDaysValue([day])}</Text>
        </View>
        {reason !== null ? <Text style={[bType.bold12, st.soft, { textAlign: 'center' }]}>{reason}</Text> : null}
      </Press>
    );
  };
  return (
    <View accessibilityLabel={TALK_DAYS_COPY.row} style={st.days}>
      <View style={st.row}>{TALK_DAY_ORDER.slice(0, 4).map(chip)}</View>
      <View style={st.row}>
        {TALK_DAY_ORDER.slice(4).map(chip)}
        <View style={st.cell} />
      </View>
    </View>
  );
}

function makeSt(t: B) {
  return StyleSheet.create({
    soft: { color: t.muted },
    days: { gap: space(2) },
    row: { flexDirection: 'row', gap: space(2) },
    cell: { flex: 1 },
    // Grows with the words, so nothing clips at 320 or the largest text size.
    chip: { flexGrow: 1, minHeight: HIT, borderRadius: radius.field, paddingVertical: space(2), paddingHorizontal: space(1), alignItems: 'center', justifyContent: 'center', gap: space(0.5) },
    chipHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: space(1) },
  });
}
