/**
 * A settings row whose answer is on the row.
 *
 * Two of Profile's questions had three answers each and a whole screen apiece:
 * a headline, a paragraph, three cards, a trip away from the card and a trip
 * back. That is four taps and two screen changes to move a dial, for a question
 * whose entire content is three words. Here the three words are on the row, the
 * chosen one is a white pill, and what it means is written underneath.
 *
 * The gloss is not decoration. A segmented control shows three labels and hides
 * every difference between them, so the row says what the chosen one actually
 * does in the same place the sheet used to. It is words a learner reads, so it
 * is soft ink at the 4.5 words are held to, never the faint ink that was only
 * ever cleared as a mark (F330).
 *
 * This file decides nothing. `dailyGoal.ts` and `tutor/strictness.ts` own the
 * options, the reading and the writing; what is here is layout.
 */

import { View, Text, StyleSheet } from 'react-native';
import { paper, space, type, HAIRLINE, HIT } from '../theme.ts';
import { TabBar } from '../components.tsx';
import { useSettingsColors } from './SettingsAppearance.tsx';

export function ChoiceRow<K extends string>({
  title,
  options,
  active,
  onChange,
  gloss,
  accessibilityLabel,
  first = false,
}: {
  title: string;
  options: readonly { key: K; label: string }[];
  /** Null while nobody has chosen: the track stands with no pill on it. */
  active: K | null;
  onChange: (key: K) => void;
  /** What the chosen option means, or what choosing would be for. */
  gloss: string;
  /** What the three words are a choice of, for anyone who cannot see the title. */
  accessibilityLabel: string;
  /** Rows after the first carry a divider above them, as SettingsRow does. */
  first?: boolean;
}) {
  const colors = useSettingsColors();
  return (
    <View style={[st.row, !first && st.divided, { borderTopColor: colors.border }]}>
      <Text style={[type.bodyStrong, { color: colors.text }]}>{title}</Text>
      <View style={{ marginTop: space(2) }}>
        <TabBar
          tabs={options}
          active={active}
          onChange={onChange}
          accessibilityLabel={accessibilityLabel}
        />
      </View>
      <Text style={[type.small, { color: colors.muted, marginTop: space(2) }]}>{gloss}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  // The same floor and the same padding as SettingsRow, so a card that mixes
  // the two reads as one list rather than as two kinds of thing.
  row: { minHeight: HIT, paddingVertical: space(2.5) },
  divided: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard },
});
