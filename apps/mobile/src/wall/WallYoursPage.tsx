import { StyleSheet, Text, View } from 'react-native';

import { ArrowRight, BadgeGlyph, Card, Ledger } from '../components.tsx';
import { HAIRLINE, paper, space, type } from '../theme.ts';
import {
  ADDS_ROWS,
  ADDS_TITLE,
  YOURS_ONLY,
  YOURS_ROWS,
  YOURS_SUB,
  YOURS_TITLE,
} from './wallCopy.ts';

/**
 * Page one of two: what you get.
 *
 * 2026-09-27, notebook Phase 6-E. The wall used to open on a map of places and
 * a page of the learner's French before it got here; now it opens here, and the
 * plans are the only page after it. It says two things in the notebook's own
 * shapes: what stays yours for nothing, as ruled rows on the paper, and what a
 * plan adds, as the page's one card. No place art, because nothing here shows a
 * place, and no colour but ink, because nothing here reports a state.
 *
 * The fear this product actually creates is the only one a learner has a right
 * to: if I stop paying, do I lose what I built. The answer is no, it has always
 * been no, and this page says so before it says anything about a plan.
 */
export function WallYoursPage({ canBuy }: { canBuy: boolean }) {
  return (
    <View>
      <Text accessibilityRole="header" style={st.title}>{YOURS_TITLE}</Text>
      <Text style={st.sub}>{YOURS_SUB}</Text>

      <Ledger style={st.ledger}>
        {YOURS_ROWS.map((line) => (
          <View key={line} style={[st.row, st.ruled]}>
            <BadgeGlyph size={20} color={paper.ink} />
            <Text style={st.line}>{line}</Text>
          </View>
        ))}
      </Ledger>

      <Text accessibilityRole="header" style={st.adds}>{ADDS_TITLE}</Text>
      <Card style={st.card}>
        {ADDS_ROWS.map((line, index) => (
          <View key={line} style={[st.row, index > 0 && st.divided]}>
            <ArrowRight size={20} color={paper.ink} />
            <Text style={st.line}>{line}</Text>
          </View>
        ))}
      </Card>

      {/* On web, and on any build with no store, this page is the only one. It
          closes on the promise it just made rather than on a door that is not
          there. */}
      {!canBuy && <Text style={st.only}>{YOURS_ONLY}</Text>}
    </View>
  );
}

const st = StyleSheet.create({
  title: { ...type.display, color: paper.ink },
  sub: { ...type.body, color: paper.inkSoft, marginTop: space(2) },
  ledger: { marginTop: space(5) },
  adds: { ...type.heading, color: paper.ink, marginTop: space(7) },
  card: { marginTop: space(3), paddingVertical: space(1) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3), minHeight: 48 },
  ruled: { borderBottomWidth: HAIRLINE, borderBottomColor: paper.line },
  divided: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard },
  line: { ...type.body, color: paper.ink, flex: 1, minWidth: 0 },
  only: { ...type.body, color: paper.inkSoft, marginTop: space(6), textAlign: 'center' },
});
