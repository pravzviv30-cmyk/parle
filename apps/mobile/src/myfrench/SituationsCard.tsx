import { StyleSheet, Text, View } from 'react-native';

import { BadgeGlyph, Card, Label } from '../components.tsx';
import { paper, signal, space, type } from '../theme.ts';
import { SITUATIONS } from './situations.ts';
import { SituationRow } from './SituationRow.tsx';
import type { MyFrench } from './model.ts';

/**
 * Where the learner's French works, as one page of places.
 *
 * The founder's mockup drew this as a titled white card with the situations
 * inside it, each on the colour of the place it happens in and each carrying a
 * short pill saying how much help was still in play. That shape is here more or
 * less exactly. What is not here is the four things the mockup's pills said,
 * because none of them can be told the truth: the percentages have no
 * denominator, and "Locked" is a state this product does not have. `situations.ts`
 * says what they became and why.
 *
 * The heading's tick is the one green in this file, and it is the same claim the
 * stamps make: these are the situations handled with nothing handed over. It is
 * a count and never a share.
 */
export function SituationsCard({ model, onOpen }: { model: MyFrench; onOpen: (id: string, refine: boolean) => void }) {
  return (
    <View style={st.block}>
      <View style={st.headRow}>
        <View style={st.headWords}>
          <Label>{SITUATIONS.label}</Label>
        </View>
        {model.readyLine !== null && (
          <View style={st.count}>
            <BadgeGlyph size={16} color={signal.good} />
            <Text style={[type.small, { color: signal.good }]}>{model.readyLine}</Text>
          </View>
        )}
      </View>

      <Card>
        <Text style={[type.title, { color: paper.ink }]}>{SITUATIONS.title}</Text>
        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{SITUATIONS.blurb}</Text>
        <View style={st.rows}>
          {model.situations.map((row) => (
            <SituationRow
              key={row.progress.mission.id}
              row={row}
              onPress={() => onOpen(row.progress.mission.id, row.action.kind === 'refine')}
            />
          ))}
        </View>
      </Card>
    </View>
  );
}

const st = StyleSheet.create({
  block: { marginTop: space(7), gap: space(2) },
  headRow: { flexDirection: 'row', alignItems: 'baseline', gap: space(2) },
  headWords: { flex: 1, minWidth: 0 },
  // The tick and its count, kept together so they wrap as one thing.
  count: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), flexShrink: 1, minWidth: 0 },
  rows: { marginTop: space(4), gap: space(2) },
});
