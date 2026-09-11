import { StyleSheet, Text, View } from 'react-native';

import { Card, Label, TintPanel } from '../components.tsx';
import { HAIRLINE, paper, space, type } from '../theme.ts';
import { MAP_NEXT, MAP_SUB, MAP_TAUGHT, MAP_TITLE, MAP_YOURS } from './wallCopy.ts';
import type { WallMapRow } from './wallMap.ts';

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
export function WallMapPage({ rows }: { rows: readonly WallMapRow[] }) {
  return (
    <View>
      <Text accessibilityRole="header" style={st.title}>{MAP_TITLE}</Text>
      <Text style={st.sub}>{MAP_SUB}</Text>
      <View style={st.rows}>
        {rows.map((row) => (
          <MapRow key={row.id} row={row} />
        ))}
      </View>
    </View>
  );
}

function MapRow({ row }: { row: WallMapRow }) {
  const body = (
    <>
      <Text style={st.place}>{row.titleEn}</Text>
      <Text style={st.line}>{row.line}</Text>
      {row.yours !== null && (
        <View style={st.aside}>
          <View style={st.rule} />
          <Label>{row.yoursIsTheirs ? MAP_YOURS : MAP_TAUGHT}</Label>
          <Text style={st.french}>{row.yours}</Text>
        </View>
      )}
      {row.next !== null && (
        <View style={st.aside}>
          <View style={st.rule} />
          <Label>{MAP_NEXT}</Label>
          <Text style={st.next}>{row.next}</Text>
        </View>
      )}
    </>
  );

  return row.lit ? (
    <TintPanel tint={row.tint} style={st.row}>{body}</TintPanel>
  ) : (
    <Card style={st.row}>{body}</Card>
  );
}

const st = StyleSheet.create({
  title: { ...type.display, color: paper.ink },
  sub: { ...type.body, color: paper.inkSoft, marginTop: space(2) },
  rows: { marginTop: space(6), gap: space(3) },
  row: { padding: space(4) },
  place: { ...type.heading, color: paper.ink },
  line: { ...type.body, color: paper.inkSoft, marginTop: space(1) },
  aside: { marginTop: space(3), gap: space(1) },
  rule: { height: HAIRLINE, backgroundColor: paper.lineOnCard, marginBottom: space(2) },
  french: { ...type.frenchSm, color: paper.ink },
  next: { ...type.body, color: paper.inkSoft },
});
