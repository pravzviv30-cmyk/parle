import { StyleSheet, Text, View } from 'react-native';

import { BadgeGlyph, Card, Label } from '../components.tsx';
import { paper, signal, space, type } from '../theme.ts';
import { SITUATIONS, YOU_CAN_NOW, splitByStamp } from './situations.ts';
import { SituationRow } from './SituationRow.tsx';
import type { MyFrench } from './model.ts';

/**
 * The situations, in two groups (F559): what the learner can now do, first,
 * with the count the passport licenses beside its heading; then the next
 * places, suggested and never locked. The split is `situations.ts`'s and the
 * card draws it: which rows are the learner's is the passport's fold, read
 * off the model, and this file names no state of its own.
 *
 * A learner with nothing stamped meets one group under the section's own
 * heading, exactly as before, so nothing here draws an empty "you can now".
 */
export function SituationsCard({ model, onOpen }: { model: MyFrench; onOpen: (id: string, refine: boolean) => void }) {
  const { own, next, nextHeading } = splitByStamp(model.situations);
  return (
    <View style={st.block}>
      {own.length > 0 && (
        <View style={st.group}>
          <View style={st.headRow}>
            <View style={st.headWords}>
              <Label>{YOU_CAN_NOW.label}</Label>
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
            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{YOU_CAN_NOW.blurb}</Text>
            <View style={st.rows}>
              {own.map((row) => (
                <SituationRow
                  key={row.progress.mission.id}
                  row={row}
                  onPress={() => onOpen(row.progress.mission.id, row.action.kind === 'refine')}
                />
              ))}
            </View>
          </Card>
        </View>
      )}

      {next.length > 0 && (
        <View style={st.group}>
          <View style={st.headRow}>
            <View style={st.headWords}>
              <Label>{nextHeading.label}</Label>
            </View>
          </View>
          <Card>
            {own.length === 0 && <Text style={[type.title, { color: paper.ink }]}>{SITUATIONS.title}</Text>}
            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{nextHeading.blurb}</Text>
            <View style={st.rows}>
              {next.map((row) => (
                <SituationRow
                  key={row.progress.mission.id}
                  row={row}
                  onPress={() => onOpen(row.progress.mission.id, row.action.kind === 'refine')}
                />
              ))}
            </View>
          </Card>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  block: { marginTop: space(7), gap: space(6) },
  group: { gap: space(2) },
  headRow: { flexDirection: 'row', alignItems: 'baseline', gap: space(2) },
  headWords: { flex: 1, minWidth: 0 },
  // The tick and its count, kept together so they wrap as one thing.
  count: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), flexShrink: 1, minWidth: 0 },
  rows: { marginTop: space(4), gap: space(2) },
});
