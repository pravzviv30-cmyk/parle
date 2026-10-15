import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useCompactPhone } from '../layout.tsx';
import { decorative } from '../theme.ts';
import { c } from './boldRhythm.ts';
import { C2QuestionArtwork } from './C2QuestionArtwork.tsx';
import type { C2QuestionPage } from './c2QuestionScenes.ts';

const grounds: Record<C2QuestionPage, string> = {
  reason: c.sun,
  interests: c.peach,
  'start-level': c.lavender,
  confidence: c.sage,
  focus: c.lavender,
  time: c.butter,
};

/** The scenery moves inside a fixed colour band; the question and curve stay still. */
export function C2QuestionHero({ page, active = true }: { page: C2QuestionPage; active?: boolean }) {
  const compact = useCompactPhone();
  const height = compact ? 118 : 168;
  return <View {...decorative} style={{ height, width: '100%', backgroundColor: grounds[page], overflow: 'hidden', pointerEvents: 'none' }}>
    <Svg {...decorative} width="100%" height="100%" viewBox="0 0 560 176" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute' }}>
      <Circle cx={62} cy={95} r={112} fill="none" stroke={c.white} strokeWidth={30} opacity={0.3} />
      <Circle cx={510} cy={5} r={140} fill="none" stroke={c.white} strokeWidth={26} opacity={0.24} />
    </Svg>
    <View style={{ paddingTop: compact ? 3 : 5 }}>
      <C2QuestionArtwork page={page} width={compact ? 130 : 210} active={active} />
    </View>
    <Svg {...decorative} width="100%" height={compact ? 24 : 32} viewBox="0 0 560 40" preserveAspectRatio="none" style={{ position: 'absolute', bottom: -1 }}>
      <Path d="M0 40 Q280 -30 560 40 L560 42 L0 42 Z" fill={c.paper} />
    </Svg>
  </View>;
}
