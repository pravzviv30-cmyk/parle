/**
 * The plan, revealed (come alive, README Part 5.C row 5): the learner's own
 * daily minutes drawn as a ring and counted up, the line that says what a
 * streak day is, and three tiles that are all real (how many exchanges the
 * first practice has, the first scene in the plan, and the AI tutor).
 *
 * No "building your plan" text and no shimmer: the numbers are the learner's
 * answers and the plan module's, shown as they are. The screen supplies the
 * plan card, the edit and tutor actions, the first-exchange card and the AI
 * line, so the literals tests pin stay on the screen.
 *
 * Reduced motion: the ring is drawn, the number is final and the tiles are in
 * place at once (each primitive watches the setting live). The ring's label
 * always carries the final value.
 */

import type { ReactNode } from 'react';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';
import { ROW_WORDS } from '../../components.tsx';
import { IconTile } from '../../icons/IconTile.tsx';
import type { BulkIconName } from '../../icons/names.ts';
import { CountUp } from '../../motion/CountUp.tsx';
import { Enter } from '../../motion/layout.tsx';
import { ProgressRing } from '../../motion/ProgressRing.tsx';
import { StaggerIn } from '../../motion/StaggerIn.tsx';
import { DUR, STAGGER } from '../../motion/tokens.ts';
import { decorative, paper, radius, space, type } from '../../theme.ts';
import type { PlanMinutes } from '../preAccountDraft.ts';
import { FIRST_RUN_COPY } from './copy.ts';
import { ringShare } from './planModel.ts';

/** The reading size at which the three tiles stop sharing a row (the action row's threshold). */
export const TILES_WRAP_AT = 1.6;

/** When the ring starts drawing, once the card above it has settled. */
const RING_WAIT = DUR.settle;
/** The scale the plan card grows from as the reveal opens. */
const CARD_FROM = 0.94;

function Tile({ icon, ground, value, label, children }: { icon: BulkIconName; ground: 'blue' | 'mint' | 'coral'; value: string; label: string; children?: ReactNode }) {
  return (
    <View style={st.tile}>
      <IconTile name={icon} ground={ground} size={40} />
      <Text style={[type.bodyStrong, { color: paper.ink }]}>{value}</Text>
      <Text style={[type.small, { color: paper.inkSoft }]}>{label}</Text>
      {children}
    </View>
  );
}

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
  /** The first-exchange card and the AI line. */
  children: ReactNode;
}) {
  const each = minutes === 'none';
  const wraps = PixelRatio.getFontScale() >= TILES_WRAP_AT;
  // Choose each time sets no daily target: the ring is its empty track and says so.
  const said = each ? FIRST_RUN_COPY.noFixedGoal : `${minutes} ${FIRST_RUN_COPY.minutesUnit}`;
  return (
    <View style={st.reveal}>
      {/* The plan card grows into place from the questions' smaller one. */}
      <Enter from="none" scaleFrom={CARD_FROM} duration={DUR.base}>
        {card}
      </Enter>
      <View style={st.ringRow}>
        <ProgressRing to={ringShare(minutes)} size={132} stroke={8} color={paper.ink} track={paper.skeleton} delay={RING_WAIT} accessibilityLabel={`Your daily goal: ${said}`}>
          <View {...decorative} style={st.centre}>
            {each ? (
              <Text style={[type.bodyStrong, st.centreWords]}>{FIRST_RUN_COPY.noFixedGoal}</Text>
            ) : (
              <>
                <CountUp to={minutes} textStyle={[type.stat, { color: paper.ink }]} label={said} />
                <Text style={[type.small, { color: paper.ink }]}>{FIRST_RUN_COPY.minutesUnit}</Text>
              </>
            )}
          </View>
        </ProgressRing>
        <Text style={[type.body, st.streak]}>{FIRST_RUN_COPY.streakLine}</Text>
      </View>
      <View style={[st.tiles, wraps && st.tilesWrapped]}>
        <StaggerIn step={STAGGER.tiles} itemStyle={wraps ? st.cellWrapped : st.cell} delay={RING_WAIT}>
          <Tile icon="chat" ground="blue" value={`${exchanges} ${exchanges === 1 ? 'exchange' : 'exchanges'}`} label={FIRST_RUN_COPY.exchangeTileLabel} />
          {sceneTitle !== null ? <Tile icon="street" ground="mint" value={sceneTitle} label={FIRST_RUN_COPY.sceneTileLabel} /> : null}
          <Tile icon="user" ground="coral" value={tutorName} label={FIRST_RUN_COPY.tutorTileLabel}>
            {tutorAction}
          </Tile>
        </StaggerIn>
      </View>
      {children}
    </View>
  );
}

const st = StyleSheet.create({
  reveal: { gap: space(5) },
  ringRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(5) },
  centre: { alignItems: 'center', justifyContent: 'center' },
  centreWords: { color: paper.ink, textAlign: 'center' },
  streak: { color: paper.ink, flex: 1, minWidth: space(40) },
  tiles: { flexDirection: 'row', gap: space(3) },
  tilesWrapped: { flexDirection: 'column' },
  cell: { ...ROW_WORDS },
  cellWrapped: { alignSelf: 'stretch' },
  tile: { flexGrow: 1, gap: space(1.5), padding: space(3), borderRadius: radius.tile, backgroundColor: paper.card },
});
