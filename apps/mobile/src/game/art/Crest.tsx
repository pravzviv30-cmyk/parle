/**
 * The level crest (come alive D6 and D10): a sun shield with a white star and
 * a coral banner across it.
 *
 * It draws no number and no name. The caller sets "Level {n}" beside it in
 * type, so the words grow with Dynamic Type and a screen reader reads them.
 * Level names are never shown.
 *
 * Still. A celebration that grows it moves a wrapper around it. Decorative:
 * hidden from assistive technology.
 */

import type { ReactElement } from 'react';
import Svg from 'react-native-svg';

import { decorative } from '../../theme.ts';
import { artPaths } from './paths.tsx';
import { ART_VIEWBOX, drawn, type ArtGround } from './shapes.ts';

export type CrestProps = {
  /** Points, square. */
  size: number;
  ground?: ArtGround;
};

export function Crest({ size, ground = 'paper' }: CrestProps): ReactElement {
  return (
    <Svg width={size} height={size} viewBox={ART_VIEWBOX} {...decorative}>
      {artPaths(drawn('crest', 'level', ground))}
    </Svg>
  );
}
