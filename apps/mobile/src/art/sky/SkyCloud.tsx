import Svg, { Circle, G, Rect } from 'react-native-svg';
import { decorative } from '../../theme.ts';
import { CLOUD_BASE, CLOUD_PUFFS, CLOUD_VIEWBOX } from './skyPaths.ts';

/** One of Today's two clouds (UI-015). Still, decorative; it moves only inside `Drift`. */
export function SkyCloud({ width, color, opacity }: { width: number; color: string; opacity: number }) {
  const vb = CLOUD_VIEWBOX;
  return (
    <Svg width={width} height={(width * vb.height) / vb.width} viewBox={`0 0 ${vb.width} ${vb.height}`} pointerEvents="none" {...decorative}>
      <G fill={color} opacity={opacity}>
        {CLOUD_PUFFS.map((c, i) => <Circle key={i} cx={c.cx} cy={c.cy} r={c.r} />)}
        <Rect x={CLOUD_BASE.x} y={CLOUD_BASE.y} width={CLOUD_BASE.width} height={CLOUD_BASE.height} rx={CLOUD_BASE.rx} />
      </G>
    </Svg>
  );
}
