/**
 * The size of a daily goal, drawn (founder decision D5): a ring filled a
 * quarter, a half, three quarters or all the way round, for Casual 5, Regular
 * 10, Serious 15 and Intense 20 minutes. The picture shows how big the
 * commitment is, so four goals are four different marks rather than four of
 * the same clock.
 *
 * A still drawing on the 24 box at the app's one pen, like every generated
 * icon: the track is the soft second layer, the filled share is the mark. It
 * moves nothing and says nothing to a screen reader; the choice it sits in
 * names the goal in words.
 */

import type { ReactElement } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { decorative, paper, STROKE } from '../theme.ts';
import { SECONDARY_OPACITY } from './drawing.ts';

/** How many quarters of the ring are filled. */
export type GoalQuarters = 1 | 2 | 3 | 4;

/** The filled share, clockwise from the top, on a ring of radius 9 about the centre. */
const ARC: Record<Exclude<GoalQuarters, 4>, string> = {
  1: 'M12 3a9 9 0 0 1 9 9',
  2: 'M12 3a9 9 0 0 1 0 18',
  3: 'M12 3a9 9 0 1 1 -9 9',
};

export function GoalDial({
  quarters,
  size = 24,
  color = paper.ink,
}: {
  quarters: GoalQuarters;
  size?: number;
  /** The filled share; the track is the same colour at SECONDARY_OPACITY. A palette token. */
  color?: string;
}): ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...decorative}>
      <Circle cx={12} cy={12} r={9} fill="none" stroke={color} strokeWidth={STROKE} opacity={SECONDARY_OPACITY} />
      {quarters === 4 ? (
        <Circle cx={12} cy={12} r={9} fill="none" stroke={color} strokeWidth={STROKE} />
      ) : (
        <Path d={ARC[quarters]} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      )}
    </Svg>
  );
}
