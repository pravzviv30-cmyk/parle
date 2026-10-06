/**
 * A game drawing's parts as react-native-svg paths, each filled with the
 * palette value its token names (`shapes.ts`). Nothing here picks a colour of
 * its own, writes a stroke, or draws an Svg: each drawing's own file wraps
 * these in its one decorative `<Svg>`.
 */

import type { ReactElement } from 'react';
import { Path } from 'react-native-svg';

import { colourOf, type DrawnPart } from './shapes.ts';

export function artPaths(parts: readonly DrawnPart[]): ReactElement[] {
  return parts.map((part) => <Path key={part.id} d={part.d} fill={colourOf(part.fill)} />);
}
