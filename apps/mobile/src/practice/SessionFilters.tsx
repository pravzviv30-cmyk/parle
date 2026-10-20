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

import { View, StyleSheet } from 'react-native';
import { Chip } from '../components.tsx';
import { space } from '../theme.ts';
import type { ArchiveFilter, FilterKey } from './archive.ts';

// B0 (2026-10-20): each chip is the shared `Chip` filter variant now, so the
// touch floor, the chosen tick and aria-selected (F522) live in one part.
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
      {filters.map((filter) => (
        <Chip
          key={filter.key}
          variant="filter"
          role="tab"
          label={filter.label}
          selected={filter.key === active}
          onPress={() => onChange(filter.key)}
        />
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
});
