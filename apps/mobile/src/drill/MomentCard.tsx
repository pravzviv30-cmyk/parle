/**
 * The moment a replay drill replays, above the exercise (F556).
 *
 * A drill node carries an id, a title and phrase keys, so a replay used to
 * open on the exercise alone and the learner's own line was gone. The node
 * may carry the moment now, plain strings, and this draws it: what they said,
 * a better way, and why, so the verdict below reads as a comparison rather
 * than a mark. Every word is the pack's; nothing here decides anything.
 */

import { StyleSheet, Text } from 'react-native';

import { Card, Label } from '../components.tsx';
import { MADE_FROM } from '../practice/madeFrom.ts';
import { paper, space, type } from '../theme.ts';

export interface DrillMoment {
  quote: string;
  better: string;
  why: string;
}

export function MomentCard({ moment }: { moment: DrillMoment }) {
  return (
    <Card style={st.card}>
      <Label>{MADE_FROM.replay.said}</Label>
      <Text style={st.quote}>« {moment.quote} »</Text>
      <Label>{MADE_FROM.replay.better}</Label>
      <Text style={st.better}>{moment.better}</Text>
      <Text style={st.why}>{moment.why}</Text>
    </Card>
  );
}

const st = StyleSheet.create({
  card: { marginBottom: space(4) },
  quote: { ...type.body, color: paper.inkSoft, marginTop: space(1), marginBottom: space(3) },
  better: { ...type.french, color: paper.ink, marginTop: space(1) },
  why: { ...type.small, color: paper.inkSoft, marginTop: space(1) },
});
