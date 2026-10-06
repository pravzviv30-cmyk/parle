/**
 * A streak repair (come alive D4, D10 and D19): a coral ring broken at the
 * top and mended with a stitched sun patch, for a run a subscriber brought
 * back.
 *
 *   ground  what it sits on, so it never vanishes into it.
 *
 * Still. Decorative: hidden from assistive technology; the repair card says
 * what a repair does in words.
 */

import type { ReactElement } from 'react';
import Svg from 'react-native-svg';

import { decorative } from '../../theme.ts';
import { artPaths } from './paths.tsx';
import { ART_VIEWBOX, drawn, type ArtGround } from './shapes.ts';

export type RepairMarkProps = {
  /** Points, square. */
  size: number;
  ground?: ArtGround;
};

export function RepairMark({ size, ground = 'paper' }: RepairMarkProps): ReactElement {
  return (
    <Svg width={size} height={size} viewBox={ART_VIEWBOX} {...decorative}>
      {artPaths(drawn('repair', 'mended', ground))}
    </Svg>
  );
}
