/**
 * The filter row over the archive.
 *
 * Chips rather than a segmented track, and they wrap rather than shrink. Four
 * equal columns of a `TabBar` cannot hold "All sessions" on a 375pt phone
 * without breaking the word, and the conversation screen already settled what
 * to do about a row of small controls that will not fit: it wraps them and
 * every one keeps the touch floor.
 *
 * The row draws whatever `practice/archive.ts` hands it and decides nothing.
 * Which filters exist at all is that module's question.
 */

import { Pressable, View, Text, StyleSheet } from 'react-native';
import { accent, HAIRLINE, HIT, paper, radius, space, type } from '../theme.ts';
import type { ArchiveFilter, FilterKey } from './archive.ts';

export function SessionFilters({
  filters,
  active,
  onChange,
}: {
  filters: readonly ArchiveFilter[];
  active: FilterKey;
  onChange: (key: FilterKey) => void;
}) {
  return (
    <View style={st.row} accessibilityRole="tablist" accessibilityLabel="Filter your recorded sessions">
      {filters.map((filter) => {
        const chosen = filter.key === active;
        return (
          <Pressable
            key={filter.key}
            onPress={() => onChange(filter.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: chosen }}
            style={[st.chip, chosen && st.chipChosen]}
          >
            <Text style={[st.word, chosen && st.wordChosen]}>{filter.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  // The touch floor is the height, not the padding, so a chip stays reachable
  // whatever the reading size does to the word inside it.
  chip: {
    minHeight: HIT,
    justifyContent: 'center',
    flexShrink: 1,
    minWidth: 0,
    paddingHorizontal: space(4),
    borderRadius: radius.pill,
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
  },
  // The chosen chip takes the identity violet, which is what an active tab
  // already does. It is labelling the control, not reporting a state.
  chipChosen: { backgroundColor: accent.primary, borderColor: accent.primary },
  word: { ...type.button, color: paper.inkSoft },
  wordChosen: { color: paper.onInk },
});
