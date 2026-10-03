/**
 * One row in a settings group.
 *
 * The Duolingo reference this page borrows its structure from uses full-bleed
 * rows on a dark sheet. This app has no full-bleed list idiom at all, so the
 * translation is a white Card group with hairline dividers between rows —
 * the shape every other surface here already uses.
 */

import { View, Text, StyleSheet } from 'react-native';
import { paper, radius, signal, space, type, HAIRLINE, HIT } from '../theme.ts';
import { ArrowRight, Press } from '../components.tsx';

export function SettingsRow({
  label,
  value,
  onPress,
  destructive = false,
  first = false,
}: {
  label: string;
  /** The current setting, when the row shows one. */
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  /** Rows after the first carry a divider above them. */
  first?: boolean;
}) {
  const colour = destructive ? signal.correspondance : paper.ink;
  const body = (
    <View style={[st.row, !first && st.divided]}>
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: colour }]}>{label}</Text>
        {value ? <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{value}</Text> : null}
      </View>
      {onPress ? <ArrowRight size={16} color={paper.inkFaint} /> : null}
    </View>
  );

  if (!onPress) {
    // A row with nothing to tap is not a button, and must not announce itself
    // as one either.
    return body;
  }
  return (
    <Press
      haptic="selection"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={st.pressable}
    >
      {body}
    </Press>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 60, paddingVertical: space(2.5) },
  divided: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard },
  // Keep every word fully legible while a tap lands. The deeper porcelain is
  // the design system's pressed surface; opacity made the whole row disappear
  // at exactly the moment the learner needed confirmation.
  pressable: { borderRadius: radius.row },
  pressed: { backgroundColor: paper.groundDeep },
});
