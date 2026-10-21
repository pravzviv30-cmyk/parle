/**
 * The glyph the review artboards draw that no shared part has (DECISIONS.md
 * UI-008, 2026-10-21, artboards B-Review and B-ReviewReveal). Decoration: the
 * button's words say what it does.
 */
import Svg, { Path, Rect } from 'react-native-svg';
import { decorative } from '../theme.ts';

/** The artboard's keyboard: a rounded body and its keys, stroke 1.8. */
export function KeyboardGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg {...decorative} width={size} height={size} viewBox="0 0 24 24">
      <Rect x={2.5} y={6} width={19} height={12} rx={3} fill="none" stroke={color} strokeWidth={1.8} />
      <Path d="M6.5 10h1M10 10h1M13.5 10h1M17 10h.5M8 14h8" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
