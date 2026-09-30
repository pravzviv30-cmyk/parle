/**
 * The five bottom-nav glyphs: ICONS.md's tab bar marks, path for path.
 *
 * Same pen as everything else: viewBox 0 0 24 24, `fill="none"`, the shared
 * STROKE of 2, round caps and joins. Deliberately NO filled variant: ICONS.md
 * fills only the two brand marks, and a solid tab icon would be the first
 * two-weight mark in the bar. The active tab is said by the glyph and the word
 * together (see LuvaniTabBar), with no chartreuse and no wash: the label
 * carries the signal, and there is no dot.
 *
 * Speak is not drawn here. ICONS.md makes the tab and the control the same
 * microphone on purpose, so `TutorIcon` is `MicGlyph` re-exported, the way
 * `glyphs.tsx` re-exports the ear as the speaker: two drawings of one idea
 * drift apart the first time one of them is nudged.
 */

import Svg, { Path, Circle, G } from 'react-native-svg';
import { decorative, paper, STROKE } from '../theme.ts';

export interface TabIconProps {
  size?: number;
  color?: string;
}

/** Speak: the same microphone as the control. */
export { MicGlyph as TutorIcon } from '../components.tsx';

function Glyph({ size = 24, color = paper.ink, children }: TabIconProps & { children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...decorative}>
      <G fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </G>
    </Svg>
  );
}

/** ICONS.md `home`: a roofline and a door. */
export function HomeIcon(props: TabIconProps) {
  return (
    <Glyph {...props}>
      <Path d="M3.5 11 12 4l8.5 7" />
      <Path d="M5.5 9.5V20h13V9.5" />
      <Path d="M10 20v-5.5h4V20" />
    </Glyph>
  );
}

/** ICONS.md `practice`: two arrows going round again. */
export function PracticeIcon(props: TabIconProps) {
  return (
    <Glyph {...props}>
      <Path d="M4.6 13.3A7.5 7.5 0 0 1 17.75 7.2" />
      <Path d="M18.05 3.7 17.75 7.2 14.25 6.9" />
      <Path d="M19.4 10.7A7.5 7.5 0 0 1 6.25 16.8" />
      <Path d="M5.95 20.3 6.25 16.8 9.75 17.1" />
    </Glyph>
  );
}

/** ICONS.md `progress`: a road from a start dot, winding forward. The MyFrench route. */
export function MyFrenchIcon(props: TabIconProps) {
  return (
    <Glyph {...props}>
      <Circle cx={4.5} cy={19} r={1.5} />
      <Path d="M6 19h7.5a3.5 3.5 0 0 0 0-7h-3a3.5 3.5 0 0 1 0-7H20" />
      <Path d="M17 2 20 5l-3 3" />
    </Glyph>
  );
}

/** ICONS.md `user`: a head over one shoulder arc. */
export function ProfileIcon(props: TabIconProps) {
  return (
    <Glyph {...props}>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4.5 20.5V19a4.5 4.5 0 0 1 4.5-4.5h6A4.5 4.5 0 0 1 19.5 19v1.5" />
    </Glyph>
  );
}

/** ICONS.md `friends`: two people, the second half behind the first. */
export function FriendsIcon(props: TabIconProps) {
  return (
    <Glyph {...props}>
      <Circle cx={9} cy={8} r={3.5} />
      <Path d="M2.5 20v-1.5a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5V20" />
      <Path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8" />
      <Path d="M18.5 14.2a4.5 4.5 0 0 1 3 4.3V20" />
    </Glyph>
  );
}
