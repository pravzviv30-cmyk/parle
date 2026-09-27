/**
 * The five bottom-nav glyphs.
 *
 * Same pen as everything else: viewBox 0 0 24 24, `fill="none"`, the shared
 * STROKE, round caps and joins. Deliberately NO filled variant — a solid icon
 * would be the first two-weight mark in the app and would break the one-pen
 * contract the illustrations and the existing icons both keep. The active tab
 * is said with an ink glyph and a Medium word instead, on a flat bar with
 * no chartreuse and no wash (see LuvaniTabBar): the label carries the signal,
 * and there is no dot.
 *
 * Drawn to the illustration rules too: nothing perfectly level, one oversized
 * element per mark.
 */

import Svg, { Path, Circle, G } from 'react-native-svg';
import { decorative, paper, STROKE } from '../theme.ts';

export interface TabIconProps {
  size?: number;
  color?: string;
}

function Glyph({ size = 24, color = paper.ink, children }: TabIconProps & { children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...decorative}>
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

/**
 * Tutor — one bubble with a voice inside it, the middle bar the tallest.
 *
 * Revamp A: the two overlapping bubbles read as a messaging app at 26pt, and
 * this tab is a person to speak to rather than a thread to read. One bubble
 * with three bars says a voice, and it is the same mark the orb's soundwave
 * lines make beside the tutor's circle.
 */
export function TutorIcon(props: TabIconProps) {
  return (
    <Glyph {...props}>
      <Path d="M5.6 4.8h12.8a2.2 2.2 0 0 1 2.2 2.2v7a2.2 2.2 0 0 1-2.2 2.2h-7.4l-4.6 3.4v-3.4a2.2 2.2 0 0 1-2.2-2.2V7a2.2 2.2 0 0 1 2.2-2.2Z" />
      <Path d="M9.4 8.6v3.8M12 7.4v6.2M14.6 9v3" />
    </Glyph>
  );
}

/** Practice — a repeat arrow around a spoken phrase, readable at dock size. */
export function PracticeIcon(props: TabIconProps) {
  return (
    <Glyph {...props}>
      <Path d="M19.4 8A8 8 0 1 0 20 14M19.4 3.6V8H15" />
      <Path d="M8.5 10v4M12 8v8M15.5 10v4" />
    </Glyph>
  );
}

/** My French — an open notebook containing the learner's own lines. */
export function MyFrenchIcon(props: TabIconProps) {
  return (
    <Glyph {...props}>
      <Path d="M3.2 5.2c3.2-.8 6-.3 8.8 1.6v12c-2.8-1.9-5.6-2.4-8.8-1.6Z" />
      <Path d="M20.8 5.2c-3.2-.8-6-.3-8.8 1.6v12c2.8-1.9 5.6-2.4 8.8-1.6Z" />
      <Path d="M6.1 9.1c1.2-.1 2.2.1 3.2.6M14.7 9.7c1-.5 2-.7 3.2-.6" />
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

export function FriendsIcon(props: TabIconProps) {
  return <Glyph {...props}><Circle cx={8.5} cy={8} r={3} /><Path d="M2.8 19c.8-3.7 2.7-5.3 5.7-5.3s4.9 1.6 5.7 5.3M16 5.5a3 3 0 0 1 0 5.7M16.5 14c2.8.3 4.2 2 4.7 5" /></Glyph>;
}
