import { useEffect, useId, useState } from 'react';
import { AppState } from 'react-native';
import Svg, { Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { useReduceMotion } from '../motion.ts';
import { decorative } from '../theme.ts';
import { FLAME_LAYERS, FLAME_SHADOW } from './flameGeometry.ts';
import { flamePath, type FlameFrame } from './flameMotion.ts';

export type StreakFlameProps = {
  size: number;
  /** Visibility of the owning screen. Paused off screen, with no timers left. */
  active?: boolean;
  /** False prepares a hidden player without starting the finite ignition. */
  playing?: boolean;
  /** Readiness of the local player, or false for a settled error/accessibility fallback. */
  onReady?: (canAnimate: boolean) => void;
  /** Defaults to the live system accessibility setting. */
  reducedMotion?: boolean;
  /** True for a fresh qualifying achievement. Consumed once per mounted hero. */
  celebrating?: boolean;
};

export function useFlameActivity({ active = true, reducedMotion }: StreakFlameProps) {
  const systemReduced = useReduceMotion(true);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [pageVisible, setPageVisible] = useState(typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => setForeground(next === 'active'));
    const visible = () => setPageVisible(document.visibilityState !== 'hidden');
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visible);
    return () => {
      sub.remove();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  const reduced = reducedMotion ?? systemReduced;
  return { reduced, running: active && foreground && pageVisible && reduced === false };
}

const REST: FlameFrame = { amount: 0, scaleX: 1, scaleY: 1, opacity: 1 };

/** Exact resting geometry shared with the editable Rive and Figma vectors. */
export function StreakFlameStill({ size }: Pick<StreakFlameProps, 'size'>) {
  return <StreakFlameFrame size={size} frame={REST} />;
}

export function StreakFlameFrame({ size, frame }: { size: number; frame: FlameFrame }) {
  const shadow = FLAME_SHADOW;
  const shadowId = `streak-shadow-${useId().replace(/:/g, '')}`;
  return <Svg width={size} height={size} viewBox="0 0 320 320" {...decorative}>
    <Defs><RadialGradient id={shadowId}><Stop offset="0" stopColor={shadow.color} stopOpacity={.28} /><Stop offset=".65" stopColor={shadow.color} stopOpacity={.18} /><Stop offset="1" stopColor={shadow.color} stopOpacity={0} /></RadialGradient></Defs>
    <Ellipse cx={shadow.cx} cy={shadow.cy} rx={shadow.rx * (1 + frame.amount * .02)} ry={shadow.ry} fill={`url(#${shadowId})`} />
    <G opacity={frame.opacity} transform={`translate(166 278) scale(${frame.scaleX} ${frame.scaleY}) translate(-166 -278)`}>
      {FLAME_LAYERS.map(layer => <Path key={layer.name} d={flamePath(layer.poses, frame.amount)} transform={`translate(0 ${layer.drift * frame.amount})`} fill={layer.color} opacity={layer.opacity} />)}
    </G>
  </Svg>;
}
