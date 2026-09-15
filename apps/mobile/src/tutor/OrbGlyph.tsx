/**
 * The orb, drawn once and standing still — revamp A.
 *
 * Everything the tutor's circle looks like lives here, and nothing that moves
 * does: one `<Svg>`, static attributes only, so the wrapper above it
 * (`VoiceOrb`) can animate transform and opacity on the native driver without
 * ever reaching an SVG attribute. `motion.test.ts` enforces that separation.
 *
 * The gradient is the ONE state colour thinned by opacity rather than a second
 * hex, so the palette gains no token and the 3:1 floor a state mark is held to
 * (F323) is the floor the colour already cleared. Three faint rings sit around
 * it, and in the two states where a voice is in the room the soundwave lines
 * are drawn either side.
 *
 * It carries no shadow. The app's only shadows are the white card's whisper and
 * the live microphone's glow, and an orb that borrowed one would quietly make
 * two things look equally urgent.
 *
 * Geometry is in the mockup's own units: a 170 square for the ball and its
 * rings, widened to 270 when the lines are drawn, so `size` always means the
 * diameter of the ball's box whether or not the voice is showing.
 */

import { useId } from 'react';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { decorative, STROKE } from '../theme.ts';

/** The ball and its rings, in viewBox units. */
export const ORB_BOX = 170;
/** The same drawing with room either side for the voice lines. */
export const ORB_WIDE = 270;
/** The strip either side that holds nothing but the lines. */
export const ORB_SIDE = (ORB_WIDE - ORB_BOX) / 2;

const CX = ORB_WIDE / 2;
const CY = 85;

export function OrbGlyph({ color, size, waves }: { color: string; size: number; waves?: boolean }) {
  // Two orbs can share a page — the tutor's mark sits in a row under the big
  // one on Profile — and two gradients under one id is one gradient.
  const id = `orb${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg
      width={waves ? (size * ORB_WIDE) / ORB_BOX : size}
      height={size}
      viewBox={waves ? `0 0 ${ORB_WIDE} ${ORB_BOX}` : `${ORB_SIDE} 0 ${ORB_BOX} ${ORB_BOX}`}
      {...decorative}
    >
      <Defs>
        <RadialGradient id={id} cx="50%" cy="42%" r="55%">
          <Stop offset="0" stopColor={color} stopOpacity={1} />
          <Stop offset="0.65" stopColor={color} stopOpacity={0.85} />
          <Stop offset="1" stopColor={color} stopOpacity={0.45} />
        </RadialGradient>
      </Defs>
      <Circle cx={CX} cy={CY} r={82} fill="none" stroke={color} strokeOpacity={0.07} strokeWidth={STROKE} />
      <Circle cx={CX} cy={CY} r={70} fill="none" stroke={color} strokeOpacity={0.12} strokeWidth={STROKE} />
      <Circle cx={CX} cy={CY} r={58} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={STROKE} />
      <Circle cx={CX} cy={CY} r={50} fill={`url(#${id})`} />
      {waves ? (
        <G fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round">
          <Path d="M14 85c5-9 9-9 14 0s9 9 14 0" strokeOpacity={0.22} />
          <Path d="M22 72c4-7 7-7 11 0s7 7 11 0" strokeOpacity={0.14} />
          <Path d="M22 98c4-7 7-7 11 0s7 7 11 0" strokeOpacity={0.14} />
          <Path d="M228 85c5-9 9-9 14 0s9 9 14 0" strokeOpacity={0.22} />
          <Path d="M222 72c4-7 7-7 11 0s7 7 11 0" strokeOpacity={0.14} />
          <Path d="M222 98c4-7 7-7 11 0s7 7 11 0" strokeOpacity={0.14} />
        </G>
      ) : null}
    </Svg>
  );
}
