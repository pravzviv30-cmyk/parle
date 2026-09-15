/**
 * The tutor, as a mark small enough to sit at the head of a row.
 *
 * The founder settled it early: no face anywhere. The orb stands in for
 * Alexandre on the "remembers" row and on Profile's tutor card, drawn small and
 * completely still. It is never a `Monogram` — that mark is the learner's
 * initial (F337), and the two of them on one screen would say the tutor is the
 * learner.
 *
 * Decorative on purpose: every row that draws it already says whose it is in
 * words, and an unlabelled image announced beside those words is one thing read
 * twice.
 */

import { View, StyleSheet } from 'react-native';
import { DISC, decorative, orb, paper } from '../theme.ts';
import { OrbGlyph } from './OrbGlyph.tsx';

export function TutorMark() {
  return (
    <View style={st.disc} {...decorative}>
      <OrbGlyph color={orb.ready} size={DISC - 8} />
    </View>
  );
}

const st = StyleSheet.create({
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: paper.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
