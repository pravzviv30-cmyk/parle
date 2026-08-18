/**
 * The five bottom-nav glyphs.
 *
 * Same pen as everything else: viewBox 0 0 24 24, `fill="none"`, the shared
 * STROKE, round caps and joins. Deliberately NO filled variant — a solid icon
 * would be the first two-weight mark in the app and would break the one-pen
 * contract the illustrations and the existing icons both keep. The active tab
 * is said with ink colour and a dot underneath instead (see ParleTabBar), which
 * is ProgressDots' grammar reused rather than a new idea.
 *
 * Drawn to the illustration rules too: nothing perfectly level, one oversized
 * element per mark.
 */

import Svg, { Path, Circle, G } from 'react-native-svg';
import { paper, STROKE } from '../theme.ts';

export interface TabIconProps {
  size?: number;
  color?: string;
}

function Glyph({ size = 24, color = paper.ink, children }: TabIconProps & { children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </G>
    </Svg>
  );
}

/** Home — a roofline that does not sit quite level, and a door. */
export function HomeIcon(props: TabIconProps) {
  return (
    <Glyph {...props}>
      <Path d="M3.2 11.6 12 4.4l8.8 7.2" />
      <Path d="M5.6 10.2v9.4h12.8v-9.4" />
      <Path d="M10.1 19.6v-4.5h3.8v4.5" />
    </Glyph>
  );
}

/** Tutor — two bubbles mid-exchange, the near one talking over the far one. */
export function TutorIcon(props: TabIconProps) {
  return (
    <Glyph {...props}>
      <Path d="M12.6 4.6h5.6a2.1 2.1 0 0 1 2.1 2.1v3.1a2.1 2.1 0 0 1-2.1 2.1h-.7" />
      <Path d="M5.9 8.7h7.5a2.1 2.1 0 0 1 2.1 2.1v3.3a2.1 2.1 0 0 1-2.1 2.1H9.3l-3.2 2.5v-2.5a2.1 2.1 0 0 1-2.1-2.1v-3.3a2.1 2.1 0 0 1 2.1-2.1Z" />
    </Glyph>
  );
}

/** Practice — the phrase cards, front one square on, the rest receding. */
export function PracticeIcon(props: TabIconProps) {
  return (
    <Glyph {...props}>
      <Path d="M4.1 12.6h13.1a1.8 1.8 0 0 1 1.8 1.8v3.1a1.8 1.8 0 0 1-1.8 1.8H4.1a1.8 1.8 0 0 1-1.8-1.8v-3.1a1.8 1.8 0 0 1 1.8-1.8Z" />
      <Path d="M5.5 9.9h12.3a1.8 1.8 0 0 1 1.7 1.2" />
      <Path d="M7.1 7.1h10.8" />
    </Glyph>
  );
}

/** Leaderboard — three steps drawn as one unbroken outline. */
export function LeaderboardIcon(props: TabIconProps) {
  return (
    <Glyph {...props}>
      <Path d="M3 19.4v-3.8h5.6v-5.2h6.9v3.3H21v5.7Z" />
    </Glyph>
  );
}

/** Profile — a head sitting a little off centre over one shoulder arc. */
export function ProfileIcon(props: TabIconProps) {
  return (
    <Glyph {...props}>
      <Circle cx={11.7} cy={8.5} r={3.7} />
      <Path d="M4.7 19.8c1.5-3.9 4.1-5.8 7.3-5.8s5.8 1.9 7.3 5.8" />
    </Glyph>
  );
}
