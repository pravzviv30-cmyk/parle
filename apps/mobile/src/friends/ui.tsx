/**
 * The friends surface's own small pieces.
 *
 * They live here rather than in components.tsx because nothing outside the
 * friends flow uses them yet; the day something does, they move. The glyph is
 * drawn with the same pen as nav/icons.tsx — viewBox 24, fill none, the shared
 * STROKE, round caps, nothing perfectly level. The Sample chip is the honesty
 * mark: every sample profile wears it, everywhere it appears.
 */

import { View, Text } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { decorative, paper, radius, space, type, STROKE } from '../theme.ts';

/** A person with a plus beside them — the add-friends mark. */
export function PersonPlusGlyph({ size = 24, color = paper.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...decorative}>
      <G fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={9.4} cy={8.7} r={3.5} />
        <Path d="M3.2 19.9c1.4-3.7 3.9-5.6 6.9-5.6s5.4 1.8 6.8 5.4" />
        <Path d="M18.6 4.9v5.4" />
        <Path d="M15.9 7.5h5.3" />
      </G>
    </Svg>
  );
}

/** The honesty mark on every sample profile. */
export function SampleChip() {
  return (
    <View
      style={{
        backgroundColor: paper.groundDeep,
        borderRadius: radius.chip,
        paddingHorizontal: space(2),
        paddingVertical: 2,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={[type.label, { color: paper.inkSoft }]}>Sample</Text>
    </View>
  );
}
