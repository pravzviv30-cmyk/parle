/**
 * What the tutor remembers, on the Tutor tab (F546).
 *
 * The card draws what `tutor/continuity.ts` decided and decides nothing: the
 * tutor's name over the line, the line, and one outline when there is
 * something to do about it. A scene left part way is picked up; a finished
 * conversation is kept going. A learner with no record behind them never sees
 * this card, because the fold answers null and the tab draws nothing.
 *
 * An outline, not a pill: the tab's one pill is the resume card's, and this
 * card is the memory, not the way in.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Card, Label, OutlineButton } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import type { Continuity } from './continuity.ts';

export const PICK_IT_UP = 'Pick it up';
export const KEEP_GOING = 'Keep going';

export function ContinuityCard({
  headline,
  continuity,
  disabled,
  onResume,
  onContinue,
}: {
  headline: string;
  continuity: Continuity;
  disabled: boolean;
  onResume: (missionId: string) => void;
  onContinue: (seedTopic: { fr: string; en: string }) => void;
}) {
  const action = continuity.action;
  return (
    <Card style={st.card}>
      <Label>{headline}</Label>
      <Text style={st.line}>{continuity.line}</Text>
      {action !== null && (
        <View style={st.action}>
          <OutlineButton
            label={action.kind === 'resume' ? PICK_IT_UP : KEEP_GOING}
            disabled={disabled}
            onPress={() => (action.kind === 'resume' ? onResume(action.missionId) : onContinue(action.seedTopic))}
          />
        </View>
      )}
    </Card>
  );
}

const st = StyleSheet.create({
  card: { marginTop: space(4) },
  line: { ...type.body, color: paper.ink, marginTop: space(2) },
  action: { marginTop: space(3) },
});
