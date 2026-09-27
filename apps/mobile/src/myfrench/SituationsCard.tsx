import { StyleSheet, Text, View } from 'react-native';

import { BadgeGlyph, Label, LedgerRow } from '../components.tsx';
import { PlaceGlyph } from '../glyphs.tsx';
import { accent, paper, radius, signal, space, type } from '../theme.ts';
import { NEXT_PLACES, YOU_CAN_NOW, splitByStamp, tryNext, type SituationChip } from './situations.ts';
import type { MyFrench, SituationRow } from './model.ts';

/**
 * The situations, in two groups, one tinted row each.
 *
 * Each row is the colour of the place it happens in, which is the founder's
 * mockup and F467's decision: the café is sand wherever it appears and the
 * market is sage. The colour says where you are, which is the one thing this
 * list is sorted by. It is never a state, and no state on this page is ever
 * told in one of these six.
 *
 * Revamp A replaced the card-of-rows with the shared `LedgerRow`, so the place's
 * drawing became the place's line-art mark on the white disc every tinted row
 * in the app now carries. Nothing here caps a line count or a reading size:
 * at the largest text the French title wraps and the row grows.
 *
 * The split is `situations.ts`'s and the card draws it. Which rows are the
 * learner's is the passport's fold, read off the model, and this file names no
 * state of its own. A learner with nothing stamped meets one group under "Next
 * places", so nothing here draws an empty "You can now".
 */
export function SituationsCard({ model, onOpen }: { model: MyFrench; onOpen: (id: string, refine: boolean) => void }) {
  const { own, next } = splitByStamp(model.situations, model.suggestedId);
  return (
    <View style={st.block}>
      {own.length > 0 && (
        <View style={st.group}>
          <Label>{YOU_CAN_NOW.label}</Label>
          {own.map((row) => (
            <Row key={row.id} row={row} onOpen={onOpen} />
          ))}
        </View>
      )}

      {next.length > 0 && (
        <View style={st.group}>
          <Label>{NEXT_PLACES.label}</Label>
          {/* At most two suggestions, core's own first. The whole catalogue
              is Missions', one door below this card. */}
          {tryNext(next).map((row) => (
            <Row key={row.id} row={row} onOpen={onOpen} />
          ))}
        </View>
      )}
    </View>
  );
}

/** One place, on its own paper, with the state it has reached beside it. */
function Row({ row, onOpen }: { row: SituationRow; onOpen: (id: string, refine: boolean) => void }) {
  return (
    <LedgerRow
      glyph={<PlaceGlyph place={row.place} color={accent.primary} />}
      title={row.title}
      gloss={row.gloss}
      accessibilityLabel={row.accessibilityLabel}
      trailing={<StateChip chip={row.chip} />}
      onPress={() => onOpen(row.id, row.action.kind === 'refine')}
    />
  );
}

/**
 * The state the row has reached, in words.
 *
 * The green is the only one in this file and it says exactly what the passport's
 * mark used to say: this scene was handled with nothing handed over. Everything
 * else is quiet, on TodayRow's rule that a thing which has not happened is not a
 * state worth signalling, and it keeps its words because "With help" and "Come
 * back" are things the heading above the row does not say.
 */
function StateChip({ chip }: { chip: SituationChip }) {
  return (
    <View style={[st.chip, chip.earned ? st.chipEarned : st.chipQuiet]}>
      {chip.earned && <BadgeGlyph size={14} color={paper.onInk} />}
      <Text style={[type.small, { color: chip.earned ? paper.onInk : paper.ink }]}>{chip.text}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  block: { gap: space(4) },
  group: { gap: space(4) },
  // The chip keeps its width and the words take what is left: the chip is five
  // to eleven characters and the situation name is not, so shrinking the name
  // is the wrong way round and was what hyphenated "réception" through the
  // middle on a 375pt phone.
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1),
    paddingVertical: space(1),
    paddingHorizontal: space(2.5),
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  chipEarned: { backgroundColor: signal.good },
  chipQuiet: { backgroundColor: paper.card },
});
