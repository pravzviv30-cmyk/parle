import { StyleSheet, Text, View } from 'react-native';

import { ArrowRight, BadgeGlyph, Card, GhostButton, Ledger } from '../components.tsx';
import { QuoteGlyph, DocumentGlyph, MouthGlyph, ChatGlyph } from '../glyphs.tsx';
import { HAIRLINE, onColour, paper, space, type } from '../theme.ts';
import {
  ADDS_ROWS,
  ADDS_TITLE,
  YOURS_DECLINE,
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
export function WallYoursPage({ canBuy, onLeave }: { canBuy: boolean; onLeave: () => void }) {
  return (
    <View>
      <Text accessibilityRole="header" style={st.title}>{YOURS_TITLE}</Text>
      <Text style={st.sub}>{YOURS_SUB}</Text>

      <Ledger style={st.ledger}>
        {YOURS_ROWS.map((line, index) => (
          <View key={line} style={st.row}>
            <View>{index === 0 ? <QuoteGlyph color={paper.ink} /> : index === 2 ? <ChatGlyph color={paper.ink} /> : index === 3 ? <MouthGlyph color={paper.ink} /> : <DocumentGlyph color={paper.ink} />}</View>
            <Text style={st.line}>{line}</Text>
          </View>
        ))}
      </Ledger>

      <Text accessibilityRole="header" style={st.adds}>{ADDS_TITLE}</Text>
      <View style={st.card}>
        {ADDS_ROWS.map((line, index) => (
          <View key={line} style={st.row}>
            <ArrowRight size={20} color={paper.ink} />
            <Text style={st.line}>{line}</Text>
          </View>
        ))}
      </View>

      {/* On web, and on any build with no store, this page is the only one. It
          closes on the promise it just made rather than on a door that is not
          there. */}
      {!canBuy && <Text style={st.only}>{YOURS_ONLY}</Text>}

      {/* With a plan to go on to, the way out is said here too (come alive,
          README Part 5.G), so nobody has to see the prices to decline them.
          Without one the pill already says it. */}
      {canBuy && (
        <View style={st.decline}>
          <GhostButton label={YOURS_DECLINE} onPress={onLeave} />
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  title: { ...type.display, color: paper.ink },
  sub: { ...type.body, color: onColour.sun, marginTop: space(2) },
  ledger: { marginTop: space(5) },
  adds: { ...type.heading, color: paper.ink, marginTop: space(7) },
  card: { marginTop: space(3), paddingVertical: space(1) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3), minHeight: 48 },
  divided: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard },
  line: { ...type.body, color: paper.ink, flex: 1, minWidth: 0 },
  only: { ...type.body, color: onColour.sun, marginTop: space(6), textAlign: 'center' },
  decline: { marginTop: space(5), alignItems: 'center' },
});
