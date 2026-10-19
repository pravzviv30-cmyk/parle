/**
 * One row in a settings group.
 *
 * P2 · Luvani (2026-10-19): a grouped-list row. The label in body ink, an
 * optional subtitle under it, an optional value at the trailing edge in muted
 * ink, and a chevron when the row leads somewhere. Rows after the first draw
 * the inset separator. Long answers belong in `sub`, short ones in `value`.
 */

import { View, Text, StyleSheet } from 'react-native';
import { space, type } from '../theme.ts';
import { ArrowRight, ChevronRight, Press } from '../components.tsx';
import { useSettingsColors } from './SettingsAppearance.tsx';
import { RowDivider, useInGroup, useRowFrame } from './SettingsGroup.tsx';

export function SettingsRow({
  label,
  sub,
  value,
  onPress,
  destructive = false,
  action = false,
  first = false,
}: {
  label: string;
  /** A second line under the label, for answers too long to sit at the edge. */
  sub?: string;
  /** The current setting, short, at the trailing edge. */
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  /** A row that does something in place (Sign out) rather than going somewhere: no glyph. */
  action?: boolean;
  /** Rows after the first carry the inset separator above them. */
  first?: boolean;
}) {
  const colors = useSettingsColors();
  const frame = useRowFrame();
  const grouped = useInGroup();
  const colour = destructive ? colors.danger : colors.text;
  const body = (
    <View style={[st.row, frame]}>
      {first ? null : <RowDivider />}
      <View style={st.words}>
        <Text style={[type.body, { color: colour }]}>{label}</Text>
        {sub ? <Text style={[type.small, { color: colors.muted, marginTop: space(0.5) }]}>{sub}</Text> : null}
      </View>
      {value ? <Text style={[type.body, st.value, { color: colors.muted }]}>{value}</Text> : null}
      {onPress && !action ? (grouped ? <ChevronRight color={colors.muted} /> : <ArrowRight size={16} color={colors.muted} />) : null}
    </View>
  );

  if (!onPress) {
    // A row with nothing to tap is not a button, and must not announce itself
    // as one either.
    return body;
  }
  const spoken = [label, sub, value].filter((part): part is string => typeof part === 'string' && part.length > 0).join(', ');
  return (
    <Press
      haptic="selection"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spoken}
    >
      {body}
    </Press>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  words: { flex: 1, minWidth: 0 },
  // Short answers only; a long one wraps rather than pushing the label away.
  value: { flexShrink: 1, maxWidth: '50%', textAlign: 'right' },
  // Keep every word fully legible while a tap lands: no opacity on press.
});
