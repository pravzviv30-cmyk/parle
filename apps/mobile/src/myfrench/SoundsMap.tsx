/**
 * The sounds map on My French: every sound in the inventory once, led by a
 * word that has it, with the symbol under the word (notebook Phase 3,
 * 2026-09-27).
 *
 * A sound carries a mark only when a check the assessor measured called it
 * out, and the mark is words in ink, not a colour, a tick or a number. Nothing
 * here is a score: a sound with no mark has simply not been called out, which
 * says nothing about how it sounds. `myfrench/notebook.ts` decides every cell.
 */

import { StyleSheet, Text, View } from 'react-native';

import { HAIRLINE, paper, space, type } from '../theme.ts';
import { NOTEBOOK, type SoundCell } from './notebook.ts';

export function SoundsMap({ cells }: { cells: readonly SoundCell[] }) {
  return (
    <View style={st.grid}>
      {cells.map((cell) => (
        <View
          key={cell.ipa}
          accessible
          accessibilityLabel={cell.calledOut ? `${cell.example}, /${cell.ipa}/. ${NOTEBOOK.calledOut}` : `${cell.example}, /${cell.ipa}/`}
          style={st.cell}
        >
          <Text style={st.word}>{cell.example}</Text>
          <Text style={st.ipa}>{`/${cell.ipa}/`}</Text>
          {cell.calledOut && <Text style={st.mark}>{NOTEBOOK.calledOut}</Text>}
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  // A fixed step on the grid, so the cells line up; taller, never clipped, at large text.
  cell: {
    flexBasis: space(24),
    paddingVertical: space(2),
    borderTopWidth: HAIRLINE,
    borderTopColor: paper.line,
  },
  word: { ...type.frenchSm, color: paper.ink },
  ipa: { ...type.notation, color: paper.inkSoft },
  mark: { ...type.small, color: paper.ink },
});
