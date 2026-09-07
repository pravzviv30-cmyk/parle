import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BadgeGlyph, TintPanel } from '../components.tsx';
import { MissionArt } from '../missions/MissionArt.tsx';
import { paper, radius, signal, space, type, HIT } from '../theme.ts';
import type { SituationRow as Row } from './model.ts';

/** The white field the drawing sits in, so the art reads on a coloured row. */
const DISC = 44;

/**
 * One situation, on its own paper.
 *
 * The founder's mockup gave every situation the colour of the place it happens
 * in, and this is that: the row's ground is the tint `missionTint` already
 * assigns, so the café is sand wherever it appears and the market is sage. The
 * colour is not decoration and it is not a state. It says where you are, which
 * is the one thing this list is sorted by, and F467 is the decision that let a
 * tint be a ground rather than only a disc.
 *
 * The drawing keeps a white field inside the coloured row. A tinted disc on a
 * tinted ground would be one shade on the same shade: this app has one value per
 * tint rather than a light and a deep, and a deep set could not exist without
 * breaking the rule that keeps no two tints within ten of each other. That is
 * the one place this row is not the mockup exactly.
 *
 * The whole row is the control. The mockup gave the right-hand slot to the
 * status pill rather than to a button, which is better: a row about a place you
 * can walk into should be tappable as one thing, and a learner aiming at a small
 * word beside it was the worse target anyway. The verb the button used to carry
 * is in the accessible name, so nothing is lost to a screen reader.
 *
 * The green is the pill, and it is the only one in this file. It says the same
 * thing the passport's mark said and it says it in words, so the mark is gone
 * rather than drawn twice. Every judgement is `model.ts`'s and `situations.ts`'s.
 */
export function SituationRow({ row, onPress }: { row: Row; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${row.action.accessibilityLabel}. ${row.chip.text}.`}
      style={({ pressed }) => [pressed && st.pressed]}
    >
      <TintPanel tint={row.tint} style={st.row}>
        <View style={st.disc}>
          <MissionArt place={row.progress.mission.place} width={36} paused />
        </View>
        <View style={st.words}>
          <Text style={[type.bodyStrong, { color: paper.ink }]}>{row.progress.mission.title}</Text>
          <Text style={[type.small, { color: paper.inkSoft }]}>{row.progress.mission.titleEn}</Text>
          {row.sound !== null && <Text style={[type.small, st.check]}>{row.sound}</Text>}
        </View>
        <View style={[st.chip, row.chip.earned ? st.chipEarned : st.chipQuiet]}>
          {row.chip.earned && <BadgeGlyph size={14} color={paper.onInk} />}
          <Text style={[type.small, { color: row.chip.earned ? paper.onInk : paper.ink }]}>{row.chip.text}</Text>
        </View>
      </TintPanel>
    </Pressable>
  );
}

const st = StyleSheet.create({
  row: { minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3) },
  pressed: { opacity: 0.7 },
  // A white field for the drawing, because the row is already the place's colour.
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: paper.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  words: { flex: 1, minWidth: 0 },
  // The pill on the right, in SessionRow's anatomy. It keeps its width and the
  // words take what is left: the pill is five to eleven characters and the
  // situation name is not, so shrinking the name is the wrong way round and was
  // what hyphenated "réception" through the middle on a 375pt phone.
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1),
    paddingVertical: space(1),
    paddingHorizontal: space(2.5),
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  // Earned: filled in the green the learner speaks in, which is the claim the
  // passport's mark used to make on its own.
  chipEarned: { backgroundColor: signal.good },
  // Everything else is quiet. A thing that has not happened is not a state
  // worth signalling, so nothing here reports an absence in colour.
  chipQuiet: { backgroundColor: paper.card },
  check: { color: paper.ink, marginTop: space(1.5) },
});
