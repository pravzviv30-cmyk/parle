/**
 * One row in a settings group.
 *
 * P2 · Luvani (2026-10-19): a grouped-list row. The label in body ink, an
 * optional subtitle under it, an optional value at the trailing edge in muted
 * ink, and a chevron when the row leads somewhere. Rows after the first draw
 * the inset separator. Long answers belong in `sub`, short ones in `value`.
 */

import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { bType, decorative, space, type } from '../theme.ts';
import { ArrowRight, ChevronRight, Press } from '../components.tsx';
import { ChevronGlyph } from '../explore/ExploreParts.tsx';
import { useBRows, useSettingsColors } from './SettingsAppearance.tsx';
import { RowDivider, useInGroup, useRowFrame } from './SettingsGroup.tsx';

export function SettingsRow({
  label,
  sub,
  value,
  onPress,
  destructive = false,
  action = false,
  first = false,
  lead,
  badge,
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
  /** B rows only: a drawing at the leading edge (the tutor orb, the star jar). Decoration. */
  lead?: ReactNode;
  /** B rows only: a mark before the chevron, the round lock badge. */
  badge?: ReactNode;
}) {
  const colors = useSettingsColors();
  const frame = useRowFrame();
  const grouped = useInGroup();
  const b = useBRows() && grouped;
  const colour = destructive ? colors.danger : colors.text;
  // 2026-10-20 UI-008, artboard B-Settings: 16/600 label, the answer stacked
  // under it at 15 and a longer sub at 13, both in muted ink, then the 18pt
  // chevron. Nothing at the trailing edge but marks.
  const body = b ? (
    <View style={[st.row, frame]}>
      {first ? null : <RowDivider />}
      {lead != null ? <View {...decorative}>{lead}</View> : null}
      <View style={[st.words, st.stack]}>
        <Text style={[type.label, { color: colour }]}>{label}</Text>
        {value ? <Text style={[bType.line15, { color: colors.muted }]}>{value}</Text> : null}
        {sub ? <Text style={[bType.note, { color: colors.muted }]}>{sub}</Text> : null}
      </View>
      {badge ?? null}
      {onPress && !action ? <View {...decorative}><ChevronGlyph size={18} color={colors.muted} /></View> : null}
    </View>
  ) : (
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
  stack: { gap: 2 },
  // Short answers only; a long one wraps rather than pushing the label away.
  value: { flexShrink: 1, maxWidth: '50%', textAlign: 'right' },
  // Keep every word fully legible while a tap lands: no opacity on press.
});
