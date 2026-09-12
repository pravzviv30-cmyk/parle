/**
 * Replay this moment (F554).
 *
 * The pack's first correction, said honestly: what the learner said, a
 * better way, why, and one outline that opens a real drill on the better
 * line. Never audio: nothing in this app keeps a recording or a transcript,
 * by contract, and a quoted line is the moment as the pack kept it.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Card, Label, OutlineButton } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { MADE_FROM, type Replay } from './madeFrom.ts';

export function ReplayMomentCard({ replay, onTry }: { replay: Replay; onTry: () => void }) {
  return (
    <Card style={st.card}>
      <Label>{MADE_FROM.replay.label}</Label>
      <Text style={st.from}>{replay.from}</Text>
      <Text style={st.quote}>« {replay.quote} »</Text>
      <Text style={st.better}>{replay.better}</Text>
      <Text style={st.betterEn}>{replay.betterEn}</Text>
      <Text style={st.why}>{replay.why}</Text>
      <View style={st.action}>
        <OutlineButton label={MADE_FROM.replay.action} onPress={onTry} />
      </View>
    </Card>
  );
}

const st = StyleSheet.create({
  card: { marginTop: space(3) },
  from: { ...type.small, color: paper.inkSoft, marginTop: space(1) },
  quote: { ...type.body, color: paper.inkSoft, marginTop: space(3) },
  better: { ...type.french, color: paper.ink, marginTop: space(2) },
  betterEn: { ...type.small, color: paper.inkSoft, marginTop: space(1) },
  why: { ...type.small, color: paper.inkSoft, marginTop: space(2) },
  action: { marginTop: space(4) },
});
