/**
 * The archive's summary card: what the learner has said, counted.
 *
 * Null gates and a stylesheet. Every number arrives as a string that
 * `practice/archive.ts` already formatted, and the rail draws only the counts
 * that module handed over, so a first conversation shows one figure and a
 * month of them shows three. Nothing here can produce a nought, because
 * nothing here can count.
 *
 * The mockup puts a soft ambient drawing behind this card. It is a mic in the
 * app's own glyph well instead: the well is already the shape Home uses for
 * exactly this job, and a second decorative treatment for one card is how a
 * design system grows a dialect.
 */

import { View, Text, StyleSheet } from 'react-native';
import { Card, MicGlyph, Stat } from '../components.tsx';
import { radius, space, type } from '../theme.ts';
import type { Vault } from './archive.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';

/** The rounded well the glyph sits in. Square, so it stays a square. */
const WELL = 40;

export function VaultCard({ vault }: { vault: Vault }) {
  const t = useB();
  const st = useThemedStyles(makeSt);
  return (
    <Card style={st.card}>
      <View style={st.head}>
        <View style={st.words}>
          <Text style={st.title}>{vault.title}</Text>
        </View>
        <View style={st.well}>
          <MicGlyph size={20} color={t.text} />
        </View>
      </View>

      <Text style={st.blurb}>{vault.blurb}</Text>

      <View style={st.rail}>
        {vault.stats.map((stat) => (
          <Stat key={stat.label} value={stat.value} label={stat.label} columns={vault.stats.length >= 3 ? 3 : 2} />
        ))}
      </View>
    </Card>
  );
}

function makeSt(t: B) {
  return StyleSheet.create({
  card: { padding: space(4) },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  // `minWidth: 0` is what lets a long title wrap inside the row instead of
  // pushing the glyph well off the card at the largest reading size.
  words: { flex: 1, minWidth: 0 },
  title: { ...type.title, color: t.text },
  well: {
    width: WELL,
    height: WELL,
    borderRadius: radius.chip,
    backgroundColor: t.skeleton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurb: { ...type.small, color: t.muted, marginTop: space(2) },
  // The rail wraps rather than shrinking. Three figures fit a phone at the
  // ordinary reading size and stack at the largest one, which is the same
  // trade the momentum tiles make.
  rail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space(3),
    marginTop: space(4),
    backgroundColor: t.ground,
    borderRadius: radius.input,
    padding: space(3),
  },
});
}
