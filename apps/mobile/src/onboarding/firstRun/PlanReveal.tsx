/**
 * The plan, revealed (come alive, README Part 5.C row 5): the learner's own
 * daily minutes drawn as a ring and counted up, the first scene and its real
 * exchange count, followed by a compact plan summary and chosen AI tutor.
 *
 * No "building your plan" text and no shimmer: the numbers are the learner's
 * answers and the plan module's, shown as they are. The screen supplies the
 * plan card, the edit and tutor actions and the first-exchange card. The
 * chosen tutor is explicitly identified as AI in its row.
 *
 * Reduced motion: the ring is drawn, the number is final and the content is in
 * place at once (each primitive watches the setting live). The ring's label
 * always carries the final value.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CountUp } from '../../motion/CountUp.tsx';
import { useFontScale } from '../../layout.tsx';
import { Enter } from '../../motion/layout.tsx';
import { ProgressRing } from '../../motion/ProgressRing.tsx';
import { DUR } from '../../motion/tokens.ts';
import { decorative, paper, radius, space, type } from '../../theme.ts';
import type { PlanMinutes } from '../preAccountDraft.ts';
import { FIRST_RUN_COPY } from './copy.ts';
import { ringShare } from './planModel.ts';

/** Larger text moves the goal outside its decorative ring and stacks the tutor controls. */
export const TILES_WRAP_AT = 1.3;

/** When the ring starts drawing, once the card above it has settled. */
const RING_WAIT = DUR.settle;
/** The scale the plan card grows from as the reveal opens. */
const CARD_FROM = 0.94;

export function PlanReveal({
  minutes,
  exchanges,
  sceneTitle,
  tutorName,
  card,
  tutorAction,
  children,
}: {
  /** The learner's daily goal, or "choose each time". */
  minutes: PlanMinutes;
  /** How many exchanges the first practice really has. */
  exchanges: number;
  /** The first scene in the plan, or null when the plan has none. */
  sceneTitle: string | null;
  tutorName: string;
  /** The expanded plan card, with its edit action. */
  card: ReactNode;
  /** Choose tutor, on the tutor tile. */
  tutorAction: ReactNode;
  /** The first-exchange card. */
  children: ReactNode;
}) {
  const each = minutes === 'none';
  const fontScale = useFontScale();
  const wraps = fontScale >= TILES_WRAP_AT;
  // Choose each time sets no daily target: the ring is its empty track and says so.
  const said = each ? FIRST_RUN_COPY.noFixedGoal : `${minutes} ${FIRST_RUN_COPY.minutesUnit}`;
  return (
    <View style={st.reveal}>
      <View style={st.ringRow}>
        <ProgressRing to={ringShare(minutes)} size={wraps ? 72 : 112} stroke={8} color={paper.ink} track={paper.skeleton} delay={RING_WAIT} accessibilityLabel={`Your daily goal: ${said}`}>
          {!wraps && (
          <View {...decorative} style={st.centre}>
            {each ? (
              <Text style={[type.bodyStrong, st.centreWords]}>{FIRST_RUN_COPY.noFixedGoal}</Text>
            ) : (
              <>
                <CountUp to={minutes} textStyle={[type.stat, { color: paper.ink, fontSize: wraps ? 36 : 64, lineHeight: wraps ? 38 : 64 }]} label={said} />
                <Text style={[type.small, { color: paper.ink }]}>min / day</Text>
              </>
            )}
          </View>
          )}
        </ProgressRing>
        {wraps && <Text style={[type.title, { color: paper.ink, flexShrink: 1 }]}>{said}</Text>}
        <View style={st.scene}>
          {sceneTitle !== null ? <Text style={[type.title, st.streak]}>{sceneTitle}</Text> : null}
          <Text style={[type.small, { color: paper.ink }]}>{exchanges} {exchanges === 1 ? 'exchange' : 'exchanges'}</Text>
        </View>
      </View>
      <Enter from="none" scaleFrom={CARD_FROM} duration={DUR.base}>
        {card}
      </Enter>
      {children}
      <View style={[st.tutor, wraps && st.tutorWrapped]}>
        <Text style={[type.bodyStrong, st.tutorName]}>{tutorName}, AI tutor</Text>
        {tutorAction}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  reveal: { gap: space(3) },
  ringRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(5) },
  centre: { alignItems: 'center', justifyContent: 'center' },
  centreWords: { color: paper.ink, textAlign: 'center' },
  scene: { flex: 1, minWidth: space(40), gap: space(1) },
  streak: { color: paper.ink },
  tutor: { flexDirection: 'row', alignItems: 'center', gap: space(2), padding: space(3), borderRadius: radius.tile, backgroundColor: paper.card },
  tutorWrapped: { flexDirection: 'column', alignItems: 'stretch' },
  tutorName: { color: paper.ink, flex: 1, flexShrink: 1 },
});
