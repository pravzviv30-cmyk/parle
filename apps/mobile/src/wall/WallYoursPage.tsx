import { StyleSheet, Text, View } from 'react-native';

import { ArrowRight, BadgeGlyph, Card, Label } from '../components.tsx';
import { Phrasebook } from '../illustrations.tsx';
import { HAIRLINE, paper, signal, space, type } from '../theme.ts';
import {
  ADDS_ROWS,
  ADDS_LABEL,
  ADDS_TITLE,
  YOURS_ONLY,
  YOURS_LABEL,
  YOURS_ROWS,
  YOURS_SUB,
  YOURS_TITLE,
} from './wallCopy.ts';

/**
 * Page three, and the one the video called "removing the fear".
 *
 * There is no free trial here to explain, so the Blinkist timeline the founder
 * sent has nothing to describe. The fear this product actually creates is a
 * different one, and it is the only fear a learner has a right to: if I stop
 * paying, do I lose what I built. The answer is no, it has always been no, and
 * nothing in the app has ever said so.
 *
 * Two lists. What stays is marked with the tick glyph in `signal.good`, which is
 * this app's colour for ground the learner has already covered. What a plan adds
 * is marked with an arrow in `inkSoft`, because it is ahead rather than held: an
 * arrow points, a lock accuses, and the difference is the whole tone of the
 * page. Neither list takes the accent, which is identity and never reports a
 * state.
 */
export function WallYoursPage({ canBuy }: { canBuy: boolean }) {
  return (
    <View>
      <View style={st.art}>
        <Phrasebook width={146} />
      </View>
      <Label>{YOURS_LABEL}</Label>
      <Text accessibilityRole="header" style={st.title}>{YOURS_TITLE}</Text>
      <Text style={st.sub}>{YOURS_SUB}</Text>

      <Card style={st.card}>
        {YOURS_ROWS.map((line, index) => (
          <View key={line} style={[st.row, index > 0 && st.divided]}>
            <BadgeGlyph size={18} color={signal.good} />
            <Text style={st.line}>{line}</Text>
          </View>
        ))}
      </Card>

      <View style={st.adds}>
        <Label>{ADDS_LABEL}</Label>
        <Text accessibilityRole="header" style={st.addsTitle}>{ADDS_TITLE}</Text>
      </View>
      <Card style={[st.card, st.planCard]}>
        {ADDS_ROWS.map((line, index) => (
          <View key={line} style={[st.row, index > 0 && st.divided]}>
            <ArrowRight size={18} color={paper.inkSoft} />
            <Text style={st.line}>{line}</Text>
          </View>
        ))}
      </Card>

      {/* On web, and on any build with no store, this page is the last one. It
          closes on the promise it just made rather than on a door that is not
          there: three pages of appetite ending in nothing would be worse than
          never opening the wall. */}
      {!canBuy && <Text style={st.only}>{YOURS_ONLY}</Text>}
    </View>
  );
}

const st = StyleSheet.create({
  art: { height: 116, alignItems: 'center', justifyContent: 'center', marginBottom: space(2) },
  title: { ...type.display, color: paper.ink, marginTop: space(2) },
  sub: { ...type.body, color: paper.inkSoft, marginTop: space(2) },
  card: { marginTop: space(4), paddingVertical: space(1), backgroundColor: paper.groundDeep },
  planCard: { backgroundColor: paper.card },
  adds: { marginTop: space(7) },
  addsTitle: { ...type.heading, color: paper.ink, marginTop: space(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3) },
  divided: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard },
  line: { ...type.body, color: paper.ink, flex: 1, minWidth: 0 },
  only: { ...type.body, color: paper.inkSoft, marginTop: space(6), textAlign: 'center' },
});
