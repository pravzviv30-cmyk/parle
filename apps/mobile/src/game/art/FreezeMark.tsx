/**
 * A streak freeze (come alive D4 and D10): a six-armed blue crystal, a plan's
 * perk that covers a missed day by itself.
 *
 *   state   `ready`: a freeze waiting to be used. `used`: one already spent
 *           this week, the same crystal in the paper grey until it returns.
 *   ground  what it sits on, so it never vanishes into it: on blue it is white.
 *
 * Still. Decorative: hidden from assistive technology; the freezes card says
 * how many are ready in words.
 */

import type { ReactElement } from 'react';
import Svg from 'react-native-svg';

import { decorative } from '../../theme.ts';
import { artPaths } from './paths.tsx';
import { ART_VIEWBOX, drawn, type ArtGround, type FreezeState } from './shapes.ts';

export type FreezeMarkProps = {
  /** Points, square. */
  size: number;
  state?: FreezeState;
  ground?: ArtGround;
};

export function FreezeMark({ size, state = 'ready', ground = 'paper' }: FreezeMarkProps): ReactElement {
  return (
    <Svg width={size} height={size} viewBox={ART_VIEWBOX} {...decorative}>
      {artPaths(drawn('freeze', state, ground))}
    </Svg>
  );
}
