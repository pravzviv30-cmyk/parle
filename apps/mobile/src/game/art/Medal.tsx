/**
 * A milestone and badge medal (come alive D6 and D10): a star on a disc in a
 * rim, with two ribbon tails below.
 *
 *   state   `sun`, `mint` or `blue`: an earned medal in that colour (the
 *           milestones row gives 7 days sun, 30 mint and 100 blue). `next`: a
 *           badge still ahead, the same medal in the paper greys.
 *   ground  what it sits on, so it never vanishes into it.
 *
 * Still. A celebration that drops or turns it moves a wrapper around it.
 * Decorative: hidden from assistive technology; the badge's title and line
 * beside it say what it is.
 */

import type { ReactElement } from 'react';
import Svg from 'react-native-svg';

import { decorative } from '../../theme.ts';
import { artPaths } from './paths.tsx';
import { ART_VIEWBOX, drawn, type ArtGround, type MedalState } from './shapes.ts';

export type MedalProps = {
  /** Points, square. */
  size: number;
  state?: MedalState;
  ground?: ArtGround;
};

export function Medal({ size, state = 'sun', ground = 'paper' }: MedalProps): ReactElement {
  return (
    <Svg width={size} height={size} viewBox={ART_VIEWBOX} {...decorative}>
      {artPaths(drawn('medal', state, ground))}
    </Svg>
  );
}
