import { StyleSheet } from 'react-native';
import { HAIRLINE, HIT, font, radius, space } from '../../theme.ts';
import type { B } from '../../main/bTheme.tsx';

/** The speak circle's size, which the level ring around it matches. */
export const SPEAK = 108;

/** The drill kinds' shared styles, moved from DrillScreen with no change. */
export function makeDs(bt: B) {
  return StyleSheet.create({
  // The own-words outcome's check: a white disc, so it reads on the mint card
  // as well as on paper.
  verdictMark: { width: 28, height: 28, borderRadius: 14, backgroundColor: bt.card, alignItems: 'center', justifyContent: 'center' },

  // The exercise card: the SessionView main-card anatomy, content centred.
  // 2026-10-21 UI-008, sim check: no top border. The old 5pt accent edge drew
  // as an ink strip across the card's top on the lavender ground.
  exCard: { alignItems: 'center', minHeight: 220, justifyContent: 'center' },
  promptCard: { minHeight: 260, justifyContent: 'space-between' },

  // The chip anatomy, for choices that are bare words: white paper under a
  // paper hairline, the notebook's one surface, with no tint.
  choice: {
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: bt.card,
    borderWidth: HAIRLINE,
    borderColor: bt.field,
    borderRadius: radius.chip,
    paddingVertical: space(2),
    paddingHorizontal: space(3.5),
  },
  chipPressed: { opacity: 0.6 },

  // The own-words outcome: the verdict beside its mark, then whatever the
  // judge gave the learner to read. It is a card rather than a timed line
  // because a better way to say something is worth more than 1.6 seconds.
  outcome: { gap: space(2.5) },
  outcomeRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },

  // The paper text field, in the Field anatomy. Type styles from the theme,
  // minus lineHeight, which clips single-line TextInputs on iOS.
  input: {
    minHeight: HIT + 8,
    backgroundColor: bt.card,
    borderWidth: 1.5,
    borderColor: bt.field,
    borderRadius: radius.input,
    paddingVertical: space(3),
    paddingHorizontal: space(4),
    color: bt.text,
    fontFamily: font.regular,
    fontSize: 16,
  },

  // B-Drill: the build, gap 18; the answer box (white, radius 22, padding 14,
  // min-height 120, 2pt periwinkle) and its brand tiles (46, radius 14, padding 0 14).
  build: { gap: 18 },
  answerBox: {
    minHeight: 120,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    gap: 8,
    backgroundColor: bt.card,
    borderWidth: 2,
    borderColor: bt.periwinkle,
    borderRadius: 22,
    padding: 14,
  },
  placed: { minHeight: 46, borderRadius: 14, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: bt.brand },
  // The bank: centred, wrapping, gap 8. A placed word leaves a 2pt dashed slot;
  // a free word is a white tile on a 3pt ring-coloured lip.
  bank: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  slot: { height: 46, borderRadius: 14, paddingHorizontal: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: bt.ring, justifyContent: 'center' },
  tileLip: { borderRadius: 14, backgroundColor: bt.ring, paddingBottom: 3 },
  tile: { height: 46, borderRadius: 14, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: bt.card },
  tokenPool: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  token: {
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: bt.card,
    borderWidth: HAIRLINE,
    borderColor: bt.field,
    borderRadius: radius.chip,
    paddingVertical: space(2),
    paddingHorizontal: space(3),
  },
  tokenUsed: { backgroundColor: 'transparent' },

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
  speakCircle: { width: SPEAK, height: SPEAK, alignItems: 'center', justifyContent: 'center' },
  speakRing: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  saidIt: { alignSelf: 'stretch' },
  noMic: { minHeight: HIT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(4) },
});
}
