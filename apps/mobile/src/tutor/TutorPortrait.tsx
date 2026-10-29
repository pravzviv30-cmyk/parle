/**
 * The learner's tutor as their own portrait (founder decision 25, F945): one
 * of the six drawings in onboarding/tutorPortraits.ts, clipped round, with a
 * thin ring in a colour the caller picks to stand out from the surface, so the
 * edge clears the 3:1 mark floor whatever the portrait's ground.
 *
 * Decoration: the tutor's name beside it carries the meaning, so it is hidden
 * from assistive technology. To go back to the shared orb, swap this for
 * `<BArt name="tutor-orb" …/>` at each call site.
 */
import { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { TutorVoiceKey } from '@luvani/core';
import { PORTRAIT_RING, tutorPortraitSvg } from '../onboarding/tutorPortraits.ts';
import { decorative } from '../theme.ts';

export function TutorPortrait({ voice, size, ring, style }: {
  voice: TutorVoiceKey;
  size: number;
  /** The ring's colour: one that clears 3:1 against the surface under the portrait. */
  ring: string;
  style?: StyleProp<ViewStyle>;
}) {
  const xml = useMemo(() => tutorPortraitSvg(voice), [voice]);
  return (
    <View {...decorative} style={[{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', borderWidth: PORTRAIT_RING, borderColor: ring }, style]}>
      <SvgXml {...decorative} xml={xml} width={size - PORTRAIT_RING * 2} height={size - PORTRAIT_RING * 2} />
    </View>
  );
}
