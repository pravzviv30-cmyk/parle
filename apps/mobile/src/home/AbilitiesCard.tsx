/**
 * What the learner can now do, on Home (F545).
 *
 * Drawn from `home/abilities.ts` and deciding nothing: the label the model
 * chose, its softer sentence when there is one, and one row per situation
 * handled on your own, each in the passport's words for assistive tech. Every
 * row opens My French, where the whole passport is.
 */

import { StyleSheet, Text, View } from 'react-native';

import { AbilityRow, Card, Label } from '../components.tsx';
import { MissionDisc } from '../missions/MissionDisc.tsx';
import { stampLabel } from '../progress/passport.ts';
import { paper, space, type } from '../theme.ts';
import type { Abilities } from './abilities.ts';

export function AbilitiesCard({ abilities, onOpen }: { abilities: Abilities; onOpen: () => void }) {
  return (
    <Card style={st.card}>
      <Label>{abilities.label}</Label>
      {abilities.softLine !== null && <Text style={st.soft}>{abilities.softLine}</Text>}
      {abilities.rows.length > 0 && (
        <View style={st.rows}>
          {abilities.rows.map((stamp, index) => (
            <AbilityRow
              key={stamp.missionId}
              first={index === 0}
              leading={<MissionDisc place={stamp.place} size={40} />}
              title={stamp.titleEn}
              accessibilityLabel={stampLabel(stamp)}
              onPress={onOpen}
            />
          ))}
        </View>
      )}
    </Card>
  );
}

const st = StyleSheet.create({
  card: { marginTop: space(4) },
  soft: { ...type.body, color: paper.ink, marginTop: space(2) },
  rows: { marginTop: space(1) },
});
