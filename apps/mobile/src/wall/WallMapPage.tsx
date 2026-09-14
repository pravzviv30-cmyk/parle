import { StyleSheet, Text, View } from 'react-native';

import { ArrowRight, BadgeGlyph, Label, TintPanel } from '../components.tsx';
import { MissionDisc } from '../missions/MissionDisc.tsx';
import { accent, HAIRLINE, paper, radius, signal, space, type } from '../theme.ts';
import {
  MAP_DONE,
  MAP_LABEL,
  MAP_CLOSED_SUB,
  MAP_CLOSED_TITLE,
  MAP_NEXT,
  MAP_READY,
  MAP_SUB,
  MAP_TAUGHT,
  MAP_TITLE,
  MAP_YOURS,
} from './wallCopy.ts';
import type { WallMap, WallMapRow } from './wallMap.ts';

/**
 * Page one. Four rows, and this file decides nothing about any of them.
 *
 * Every word, every tint and every null gate was settled in `wallMap.ts`, for
 * the reason `MomentumCards.tsx` states about itself: this is a set of null
 * gates and a stylesheet. No arithmetic, no counting, no choosing which line to
 * show. If something here looks like a decision, it is in the wrong file.
 *
 * A walked place sits on its own tint and an unwalked one on plain card white.
 * That is the whole difference, and it is deliberately not a padlock: `path.ts`
 * quotes PRODUCT.md's first principle as the reason every authored node is open
 * in any order, so a lock would contradict the product as well as the mood. An
 * unvisited place is an invitation.
 */
export function WallMapPage({ map }: { map: WallMap }) {
  // One more null gate, not a decision. `wallMap` already settled which way round
  // this page opens; all this does is read the flag and pick the pair.
  const title = map.problemFirst ? MAP_CLOSED_TITLE : MAP_TITLE;
  const sub = map.problemFirst ? MAP_CLOSED_SUB : MAP_SUB;
  return (
    <View>
      <Label>{MAP_LABEL}</Label>
      <Text accessibilityRole="header" style={st.title}>{title}</Text>
      <Text style={st.sub}>{sub}</Text>
      <View style={st.rows}>
        {map.rows.map((row) => (
          <MapRow key={row.id} row={row} />
        ))}
      </View>
    </View>
  );
}

function MapRow({ row }: { row: WallMapRow }) {
  return (
    <TintPanel tint={row.tint} style={st.row}>
      <View style={st.head}>
        <MissionDisc place={row.place} size={72} />
        <View style={st.words}>
          <View style={st.status}>
            {row.lit ? <BadgeGlyph size={17} color={signal.good} /> : <ArrowRight size={17} color={accent.primary} />}
            <Text style={[st.statusText, { color: row.lit ? signal.good : accent.primary }]}>
              {row.lit ? MAP_DONE : MAP_READY}
            </Text>
          </View>
          <Text style={st.place}>{row.titleEn}</Text>
          <Text style={st.line}>{row.line}</Text>
        </View>
      </View>
      {row.yours !== null && (
        <View style={st.aside}>
          <Label>{row.yoursIsTheirs ? MAP_YOURS : MAP_TAUGHT}</Label>
          <Text style={st.french}>{row.yours}</Text>
        </View>
      )}
      {row.next !== null && (
        <View style={st.aside}>
          <Label>{MAP_NEXT}</Label>
          <Text style={st.next}>{row.next}</Text>
        </View>
      )}
    </TintPanel>
  );
}

const st = StyleSheet.create({
  title: { ...type.display, color: paper.ink, marginTop: space(2) },
  sub: { ...type.body, color: paper.inkSoft, marginTop: space(2) },
  rows: { marginTop: space(6), gap: space(3) },
  row: { padding: space(4), borderWidth: HAIRLINE, borderColor: paper.line },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(3.5) },
  words: { flex: 1, minWidth: 0 },
  status: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), marginBottom: space(1) },
  statusText: { ...type.small },
  place: { ...type.heading, color: paper.ink },
  line: { ...type.body, color: paper.inkSoft, marginTop: space(1) },
  aside: {
    marginTop: space(3),
    gap: space(1),
    backgroundColor: paper.card,
    borderRadius: radius.chip,
    padding: space(3),
  },
  french: { ...type.frenchSm, color: paper.ink },
  next: { ...type.body, color: paper.inkSoft },
});
