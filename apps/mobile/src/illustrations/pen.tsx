/** The static pen: one stroke weight, 4:3 frame and decorative SVGs. */
import Svg, { Circle, G } from 'react-native-svg';
import { paper, STROKE, decorative } from '../theme.ts';
import { frameHeight } from './timing.ts';

export interface SceneProps {
  width?: number;
  /** Static marks accept callers' visibility hints but never animate. */
  paused?: boolean;
}

export function Frame({ width = 200, children }: { width?: number; children: React.ReactNode }) {
  return (
    <Svg width={width} height={frameHeight(width)} viewBox="0 0 200 150" {...decorative}>
      <G fill="none" stroke={paper.ink} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </G>
    </Svg>
  );
}

export function Stipple({ points }: { points: readonly (readonly [number, number])[] }) {
  return <>{points.map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={1.1} fill={paper.ink} stroke="none" />)}</>;
}
