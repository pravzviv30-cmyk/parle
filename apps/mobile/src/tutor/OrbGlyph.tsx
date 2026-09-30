/**
 * The still half of the tutor's voice circle (SNIPPETS orb).
 *
 * Two rings and a core, all in the one state colour: an outer ring at 0.3, an
 * inner ring half again as heavy at 0.55, and a solid core. Revamp B dropped
 * the mist, the gradients and the paper collar: the orb is a flat colour mark
 * like every other B part, so it reads on paper, on white and on a colour
 * ground alike. The mark inside the core (the bars, the microphone, the dots)
 * and every moving part live one level up in `VoiceOrb`, where core Animated
 * moves transforms on the native driver without animating an SVG attribute.
 *
 * Below 64 the rings are too fine to read, so a small orb is the core alone,
 * filling its box: the tutor mark at 36 and the tutor card at 56.
 */

import Svg, { Circle } from 'react-native-svg';
import { decorative, STROKE } from '../theme.ts';

/** The drawing's square viewBox, SNIPPETS' 120. `size` is always the whole orb. */
export const ORB_BOX = 120;

const CENTRE = ORB_BOX / 2;

export function OrbGlyph({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${ORB_BOX} ${ORB_BOX}`} {...decorative}>
      {size >= 64 ? (
        <>
          <Circle cx={CENTRE} cy={CENTRE} r={58} fill="none" stroke={color} strokeWidth={STROKE} strokeOpacity={0.3} />
          <Circle cx={CENTRE} cy={CENTRE} r={49} fill="none" stroke={color} strokeWidth={STROKE * 1.5} strokeOpacity={0.55} />
          <Circle cx={CENTRE} cy={CENTRE} r={40} fill={color} />
        </>
      ) : (
        <Circle cx={CENTRE} cy={CENTRE} r={60} fill={color} />
      )}
    </Svg>
  );
}
