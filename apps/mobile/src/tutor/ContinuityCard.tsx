/**
 * What the tutor remembers, on the Tutor tab (F546, F551).
 *
 * The card draws what `tutor/continuity.ts` and `tutor/threads.ts` decided
 * and decides nothing: the tutor's name over the line, the line, and one
 * outline when there is a thread to pick up. A scene left part way is picked
 * up; a finished conversation is kept going, which is the Max plan's door
 * (`purchases/capabilities.ts`), so a plan without it meets one honest line and
 * the way to the plans rather than a button that would be refused. A learner
 * with no record behind them never sees this card, because the fold answers
 * null and the tab draws nothing.
 *
 * An outline, not a pill: the tab's one pill is the resume card's, and this
 * card is the memory, not the way in.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Card, GhostButton, Label, OutlineButton } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { SEE_PLANS } from './realMoments.ts';
import type { Thread } from './threads.ts';

export const PICK_IT_UP = 'Pick it up';
export const KEEP_GOING = 'Keep going';
export const MAX_ONLY_ARC = 'Keeping a conversation going across sessions comes with the Max plan.';

export function ContinuityCard({
  headline,
  line,
  thread,
  continueAllowed,
  disabled,
  onResume,
  onContinue,
  onSeePlans,
}: {
  headline: string;
  /** What the tutor remembers, from `continuity.ts`. */
  line: string;
  /** The one thread to pick up, from `threads.ts`, or null. */
  thread: Thread | null;
  /** Whether keeping a conversation going is open on this plan. */
  continueAllowed: boolean;
  disabled: boolean;
  onResume: (missionId: string) => void;
  onContinue: (packId: string, seedTopic: { fr: string; en: string }) => void;
  onSeePlans: () => void;
}) {
  // The thread's own line is the more specific one when there is a thread.
  const said = thread?.line ?? line;
  return (
    <Card style={st.card}>
      <Label>{headline}</Label>
      <Text style={st.line}>{said}</Text>
      {thread !== null && thread.kind === 'scene' && (
        <View style={st.action}>
          <OutlineButton label={PICK_IT_UP} disabled={disabled} onPress={() => onResume(thread.missionId)} />
        </View>
      )}
      {thread !== null && thread.kind === 'pack' && continueAllowed && (
        <View style={st.action}>
          <OutlineButton label={KEEP_GOING} disabled={disabled} onPress={() => onContinue(thread.packId, thread.seedTopic)} />
        </View>
      )}
      {thread !== null && thread.kind === 'pack' && !continueAllowed && (
        <View style={st.action}>
          <Text style={st.gate}>{MAX_ONLY_ARC}</Text>
          <GhostButton label={SEE_PLANS} color={paper.ink} onPress={onSeePlans} />
        </View>
      )}
    </Card>
  );
}

const st = StyleSheet.create({
  card: { marginTop: space(4) },
  line: { ...type.body, color: paper.ink, marginTop: space(2) },
  action: { marginTop: space(3), gap: space(2) },
  gate: { ...type.small, color: paper.inkSoft },
});
