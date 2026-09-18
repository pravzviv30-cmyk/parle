/**
 * The still half of the tutor's voice circle.
 *
 * UI 4 made the important call: the tutor is a soft watercolour presence, not
 * a microphone button in a glass capsule. This drawing therefore owns only the
 * misty colour field and its three quiet rings. The direct white voice bars and
 * every moving part live one level up in `VoiceOrb`, where core Animated can
 * move transforms on the native driver without animating an SVG attribute.
 *
 * The mist uses one supplied state colour at several transparencies. It does
 * not smuggle a second purple into the palette, and it changes naturally to
 * green, amber or red when the room changes state. Two off-centre washes keep
 * the centre from reading as a polished app-store gradient while remaining
 * deterministic and inexpensive on native and web.
 */

import { useId } from 'react';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { decorative, STROKE } from '../theme.ts';

/** The drawing's square viewBox. `size` is always the whole ring field. */
export const ORB_BOX = 200;

const CENTRE = ORB_BOX / 2;

export function OrbGlyph({ color, size }: { color: string; size: number }) {
  // Mini orbs share TutorIntro and the full orb shares a screen with the tutor
  // mark, so every gradient id must belong to the instance that draws it.
  const token = useId().replace(/[^a-zA-Z0-9]/g, '');
  const baseId = `orbBase${token}`;
  const mistId = `orbMist${token}`;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${ORB_BOX} ${ORB_BOX}`} {...decorative}>
      <Defs>
        <RadialGradient id={baseId} cx="43%" cy="38%" r="64%">
          <Stop offset="0" stopColor={color} stopOpacity={1} />
          <Stop offset="0.58" stopColor={color} stopOpacity={0.86} />
          <Stop offset="1" stopColor={color} stopOpacity={0.42} />
        </RadialGradient>
        <RadialGradient id={mistId} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.7} />
          <Stop offset="0.7" stopColor={color} stopOpacity={0.2} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* The rings are present enough to hold the control, never strong enough
          to become a progress rail or a second button. */}
      <Circle cx={CENTRE} cy={CENTRE} r={96} fill="none" stroke={color} strokeOpacity={0.05} strokeWidth={STROKE} />
      <Circle cx={CENTRE} cy={CENTRE} r={87} fill="none" stroke={color} strokeOpacity={0.08} strokeWidth={STROKE} />
      <Circle cx={CENTRE} cy={CENTRE} r={78} fill="none" stroke={color} strokeOpacity={0.13} strokeWidth={STROKE} />

      {/* One soft body plus two offset washes. Their edges overlap imperfectly,
          which is the restrained watercolour texture in the approved mockup. */}
      <Circle cx={CENTRE} cy={CENTRE} r={69} fill={`url(#${baseId})`} />
      <Circle cx={78} cy={76} r={54} fill={`url(#${mistId})`} opacity={0.55} />
      <Circle cx={126} cy={124} r={50} fill={`url(#${mistId})`} opacity={0.34} />
    </Svg>
  );
}
