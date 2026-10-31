import { StyleSheet } from 'react-native';
import { HAIRLINE, HIT, bType, radius, space } from '../../theme.ts';
import { LIP_SIZES } from '../../components.tsx';
import type { B } from '../../main/bTheme.tsx';

/** The speak circle's size, which the level ring around it matches. */
export const SPEAK = 108;

/** The drill kinds' shared styles, moved from DrillScreen and reshaped for drill B v2 (UI-016). */
export function makeDs(bt: B) {
  return StyleSheet.create({
  // The own-words outcome's check: a white disc, so it reads on the mint card
  // as well as on paper.
  verdictMark: { width: 28, height: 28, borderRadius: 14, backgroundColor: bt.card, alignItems: 'center', justifyContent: 'center' },

  // The own-words outcome: the verdict beside its mark, then whatever the
  // judge gave the learner to read. It is a card rather than a timed line
  // because a better way to say something is worth more than 1.6 seconds.
  outcome: { gap: space(2.5) },
  outcomeRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },

  // The lip field (drill B v2, UI-016): a `LipTile` card, radius 18 on a 4pt
  // `line` lip, holding the TextInput. Bold 18 from the token, minus
  // lineHeight, which clips single-line TextInputs on iOS (18 stays above
  // the 16 iOS zooms under).
  fieldFace: { minHeight: 58, justifyContent: 'center' },
  input: {
    minHeight: 58,
    paddingVertical: space(3),
    paddingHorizontal: 16,
    color: bt.text,
    fontFamily: bType.bold18.fontFamily,
    fontSize: bType.bold18.fontSize,
  },
  // The nearly field: the same face, holding lit letters instead of a caret.
  litField: { paddingVertical: space(3), paddingHorizontal: 16 },

  // Drill B v2 (V2-Build): the build, gap 18. The answer box is a white
  // `LipTile` (min height 110, padding 14) filled in place.
  build: { gap: 18 },
  answerBox: {
    minHeight: 110,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    alignItems: 'center',
    gap: 8,
    padding: 14,
  },
  // A word chip's face (`LipTile` chip): at least 46 tall, padding 0 14; it
  // grows with the text so a French word never overflows at large sizes.
  chip: { minHeight: 46, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  // The bank: centred, wrapping, gap 10. A placed word leaves a 2pt dashed
  // slot the chip's size, on the chip's lip line so nothing jumps.
  bank: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  slot: { minHeight: 46, marginBottom: LIP_SIZES.chip.lip, borderRadius: LIP_SIZES.chip.radius, paddingHorizontal: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: bt.ring, justifyContent: 'center' },
  // The answer box's next place: an empty slot, 44 tall.
  nextSlot: { minHeight: 44, minWidth: 64, marginBottom: 0 },
  // The fill-blank gap: a 3pt dashed underline in the link colour.
  gap: { minWidth: 96, height: 34, borderBottomWidth: 3, borderStyle: 'dashed' },
  // A landed word (board `.landed`): the brand fill and a 5pt soft brand halo.
  landed: { minHeight: 36, paddingHorizontal: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: bt.brand, margin: 5 },
  // Tap-translate's placed words (V2-Build): 44 tall, padding 0 14, no halo margin.
  landedBig: { minHeight: 44, paddingHorizontal: 14, margin: 0 },
  landedHalo: { position: 'absolute', top: -5, left: -5, right: -5, bottom: -5, borderRadius: 17, backgroundColor: bt.brand, opacity: 0.18 },
  landedPress: { borderRadius: 17, minHeight: 44, justifyContent: 'center' },

  listenButton: {
    marginTop: space(3.5),
    minHeight: HIT + 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2.5),
    backgroundColor: bt.card,
    // A paper hairline, not an ink outline (notebook Phase 4, 2026-09-27):
    // the ink is kept for the one primary pill.
    borderWidth: HAIRLINE,
    borderColor: bt.field,
    borderRadius: radius.pill,
    paddingHorizontal: space(5),
  },
  hear: {
    marginTop: space(3),
    minHeight: HIT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
  },

  speakBlock: { alignItems: 'center', gap: space(2) },
  saidIt: { alignSelf: 'stretch' },
  noMic: { minHeight: HIT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(4) },
});
}
