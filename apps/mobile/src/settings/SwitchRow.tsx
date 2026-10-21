/**
 * A settings row whose answer is yes or no.
 *
 * The reminder group has had a switch since F230 and it was built inline, so
 * the next two questions with a yes and a no had nowhere to go. This is that
 * shape lifted out: a title, one sentence saying what saying yes does, and the
 * switch itself at the trailing edge.
 *
 * The sentence is the part worth keeping. A switch labelled "Prefer typing"
 * alone is a switch whose consequences a learner has to discover by flipping
 * it, and both of the settings that use this change what happens the next time
 * somebody opens a conversation. So the row says so, in soft ink at the 4.5
 * words are held to rather than the 3 a mark gets.
 *
 * The switch is named to assistive tech by the row's own title, because the
 * title is drawn as text rather than bound to the control.
 *
 * The off track is said twice: `trackColor.false` for Android and the web, and
 * `ios_backgroundColor` for iOS, which ignores the first when it paints an off
 * switch and would otherwise leave a bare white thumb on the card (F736).
 */

import { View, Text, Switch, StyleSheet } from 'react-native';
import { accent, bType, paper, space, type } from '../theme.ts';
import { tapSettled } from '../motion/haptics.ts';
import { useBRows, useSettingsColors } from './SettingsAppearance.tsx';
import { RowDivider, useInGroup, useRowFrame } from './SettingsGroup.tsx';

export function SwitchRow({
  title,
  sub,
  value,
  onChange,
  accessibilityLabel,
  first = false,
  disabled = false,
}: {
  title: string;
  /**
   * One plain sentence about what turning this on does. Empty only on a B row
   * whose title already says it (2026-10-20 UI-008, artboard B-Settings: "Alexandre
   * speaks more simply" carries no second line); it is still the hint.
   */
  sub: string;
  value: boolean;
  onChange: (next: boolean) => void;
  accessibilityLabel: string;
  /** Rows after the first carry a divider above them, as SettingsRow does. */
  first?: boolean;
  disabled?: boolean;
}) {
  const colors = useSettingsColors();
  const frame = useRowFrame();
  const bRows = useBRows();
  const grouped = useInGroup();
  const b = bRows && grouped;
  // UI-005: the off track is the field grey everywhere, the 3:1 non-text
  // floor on white. The hairline it used in grouped lists read ~1.24:1.
  const offTrack = paper.field;
  return (
    <View style={[st.row, frame]}>
      {first ? null : <RowDivider />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[b ? type.label : type.body, { color: colors.text }]}>{title}</Text>
        {sub.length > 0 ? <Text style={[b ? bType.note : type.small, { color: colors.muted, marginTop: b ? 2 : space(0.5) }]}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          tapSettled();
          onChange(next);
        }}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={sub}
        trackColor={{ true: accent.brand, false: offTrack }}
        ios_backgroundColor={offTrack}
        thumbColor={paper.card}
      />
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
});
