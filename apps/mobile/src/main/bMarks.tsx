/**
 * The three small marks both Today and the live room draw: the artboard's mic,
 * the two-wave speaker and the keyboard (b-spec A6). They live here, in a leaf
 * module that imports only `react-native-svg` and the theme, so `today/TodayParts`
 * and `live/LiveParts` never import each other. Both re-export what they
 * exported before. Marks are decoration: the words beside them say what they mean.
 */

import Svg, { Path, Rect } from 'react-native-svg';

import { decorative } from '../theme.ts';

/** The artboard's mic: a capsule and its stand, stroke 2. */
export function BMic({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Rect x={8.5} y={3} width={7} height={12} rx={3.5} fill="none" stroke={color} strokeWidth={2} />
      <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** The two-wave speaker (b-spec A6), filled cone and 1.8 waves. */
export function BSpeaker({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill={color} />
      <Path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/** The keyboard (b-spec A6), stroke 1.8. */
export function KeyboardMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Rect x={2.5} y={6} width={19} height={12} rx={3} fill="none" stroke={color} strokeWidth={1.8} />
      <Path d="M6.5 10h1M10 10h1M13.5 10h1M17 10h.5M8 14h8" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
