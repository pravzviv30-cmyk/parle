import Svg, { Circle, Path } from 'react-native-svg';
import { decorative } from '../../theme.ts';
import { DISC_VIEWBOX, MOON_CRESCENT } from './skyPaths.ts';

/** Today's sun or crescent moon (UI-015). Still, decorative; the colour comes from `sky`. */
export function SkyDisc({ kind, size, color }: { kind: 'sun' | 'moon'; size: number; color: string }) {
  const half = DISC_VIEWBOX / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${DISC_VIEWBOX} ${DISC_VIEWBOX}`} pointerEvents="none" {...decorative}>
      {kind === 'sun' ? <Circle cx={half} cy={half} r={half} fill={color} /> : <Path d={MOON_CRESCENT} fill={color} />}
    </Svg>
  );
}
