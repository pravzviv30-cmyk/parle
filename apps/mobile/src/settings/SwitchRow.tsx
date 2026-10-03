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
 */

import { View, Text, Switch, StyleSheet } from 'react-native';
import { accent, paper, space, type, HAIRLINE, HIT } from '../theme.ts';
import { tapSettled } from '../motion/haptics.ts';

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
  /** One plain sentence about what turning this on does. */
  sub: string;
  value: boolean;
  onChange: (next: boolean) => void;
  accessibilityLabel: string;
  /** Rows after the first carry a divider above them, as SettingsRow does. */
  first?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={[st.row, !first && st.divided]}>
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: paper.ink }]}>{title}</Text>
        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{sub}</Text>
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
        trackColor={{ true: accent.brand, false: paper.field }}
        thumbColor={paper.card}
      />
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: HIT, paddingVertical: space(2.5) },
  divided: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard },
});
