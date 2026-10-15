import { memo, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Text, View } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { C2_ASSETS, c2AssetSize, c2Scene, type C2Layer, type C2SceneDefinition, type C2SceneKind } from '../../art/flat/c2SceneAssets.ts';
import { c2SvgForInstance } from '../../art/flat/c2SvgNamespace.ts';
import { useReduceMotion } from '../../motion.ts';
import { cancel, repeat, timing } from '../../motion/drive.ts';
import { C2_MOTION } from '../../motion/tokens.ts';
import { decorative } from '../../theme.ts';
import { boldType as type, c } from '../boldRhythm.ts';
import { SceneActivity } from './SceneActivity.ts';
import { c2FloatAmount, c2GestureAmount, c2MotionRuns } from './c2MotionPolicy.ts';

export type C2VectorPartDefinition = {
  id: string;
  xml: string;
  gesture?: {
    pivot: readonly [number, number];
    rotate?: number;
    lift?: number;
    scale?: number;
    phaseOffset?: number;
  };
};

/** The clock stays mounted. Backgrounding pauses it at its current pose. */
function useC2Phase(active: boolean, duration: number, delayMs = 0) {
  const visible = useContext(SceneActivity);
  const reduced = useReduceMotion(true);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const phase = useSharedValue(0);
  const wait = useRef(delayMs);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  const running = c2MotionRuns({ active, visible, foreground, reduced });
  useEffect(() => {
    cancel(phase);
    if (reduced === true) phase.value = 0;
    if (!running) return;
    let alive = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let waitingSince: number | undefined;
    const fullCycle = () => {
      if (!alive) return;
      phase.value = 0;
      phase.value = repeat(timing(1, duration, C2_MOTION.linear, false), -1, false, false);
    };
    const resume = () => {
      wait.current = 0;
      waitingSince = undefined;
      const remaining = (1 - Math.max(0, Math.min(1, phase.value))) * duration;
      if (phase.value === 0 || remaining === 0) fullCycle();
      else phase.value = timing(1, remaining, C2_MOTION.linear, false, finished => { if (finished) fullCycle(); });
    };
    if (wait.current > 0) {
      waitingSince = Date.now();
      timeout = setTimeout(resume, wait.current);
    } else resume();
    return () => {
      alive = false;
      if (timeout) clearTimeout(timeout);
      if (waitingSince !== undefined) wait.current = Math.max(0, wait.current - (Date.now() - waitingSince));
      cancel(phase);
    };
  }, [duration, phase, reduced, running]);
  return phase;
}

function Layer({ layer, phase }: { layer: C2Layer; phase: SharedValue<number> }) {
  const size = c2AssetSize(layer.asset);
  const instanceId = useId();
  const xml = useMemo(() => c2SvgForInstance(C2_ASSETS[layer.asset], instanceId), [layer.asset, instanceId]);
  const motion = useAnimatedStyle(() => {
    const float = c2FloatAmount(phase.value);
    return {
      opacity: 1 + (layer.fade ?? 0) * float,
      transform: [
        { translateY: (layer.bob ?? 0) * float },
        { rotate: `${(layer.sway ?? 0) * float + (layer.spin ? -360 * phase.value : 0)}deg` },
        { scale: 1 + (layer.pulse ?? 0) * float },
      ],
    };
  }, [layer]);
  return <Reanimated.View style={[{ position: 'absolute', left: layer.x, top: layer.y, width: size.width * layer.scaleX, height: size.height * layer.scaleY }, motion]}>
    <View style={{ width: size.width, height: size.height, transformOrigin: 'left top', transform: [{ rotate: `${layer.rotation}deg` }, { scaleX: layer.scaleX }, { scaleY: layer.scaleY }] }}>
      <SvgXml {...decorative} xml={xml} />
    </View>
  </Reanimated.View>;
}

function DayOneBadge({ badge, phase, dayCount }: { badge: NonNullable<C2SceneDefinition['badge']>; phase: SharedValue<number>; dayCount: number }) {
  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: 1 + badge.pulse * c2FloatAmount(phase.value) }] }), [badge]);
  return <Reanimated.View style={[{ position: 'absolute', left: badge.x, top: badge.y, width: badge.size, height: badge.size, borderRadius: badge.size / 2, borderWidth: 5, borderColor: c.butter, backgroundColor: c.sun }, pulse]}>
    <Text style={[type.streakBadge, { position: 'absolute', left: -5, top: 4, width: 100, textAlign: 'center', color: c.ink }]}>{dayCount}</Text>
    <Text style={[type.small, { position: 'absolute', left: -5, top: 61, width: 100, textAlign: 'center', color: c.ink }]}>{dayCount === 1 ? 'DAY' : 'DAYS'}</Text>
  </Reanimated.View>;
}

function GesturePart({ gesture, phase, width, height, children }: {
  gesture: NonNullable<C2VectorPartDefinition['gesture']>;
  phase: SharedValue<number>;
  width: number;
  height: number;
  children: ReactNode;
}) {
  const pose = useAnimatedStyle(() => {
    const amount = c2GestureAmount(phase.value, gesture.phaseOffset);
    return { transform: [
      { translateY: (gesture.lift ?? 0) * amount },
      { rotate: `${(gesture.rotate ?? 0) * amount}deg` },
      { scale: 1 + (gesture.scale ?? 0) * amount },
    ] };
  }, [gesture]);
  return <Reanimated.View style={[{
    position: 'absolute', left: 0, top: 0, width, height,
    transformOrigin: [gesture.pivot[0], gesture.pivot[1], 0],
  }, pose]}>{children}</Reanimated.View>;
}

/** A semantic body/hand/held-prop group shares the scene phase; XML never changes per frame. */
export const C2VectorPart = memo(function C2VectorPart({ part, phase, width, height }: {
  part: C2VectorPartDefinition;
  phase: SharedValue<number>;
  width: number;
  height: number;
}) {
  const instanceId = useId();
  const xml = useMemo(() => c2SvgForInstance(part.xml, instanceId), [part.xml, instanceId]);
  const art = <SvgXml {...decorative} xml={xml} width={width} height={height} preserveAspectRatio="xMidYMid meet" />;
  return part.gesture
    ? <GesturePart gesture={part.gesture} phase={phase} width={width} height={height}>{art}</GesturePart>
    : <View style={{ position: 'absolute', left: 0, top: 0, width, height }}>{art}</View>;
});

/** Source SVG attributes remain untouched; a scene wrapper scales the complete composition. */
export const C2Artwork = memo(function C2Artwork({ scene, width, active = true, animated = true, spin = false, dayCount = 1, children, renderVectors }: {
  scene: C2SceneDefinition;
  width: number;
  active?: boolean;
  animated?: boolean;
  spin?: boolean;
  dayCount?: number;
  /** Locally redrafted vectors share the same scene clock and lifecycle as exports. */
  children?: ReactNode;
  /** Optional local vector groups receive this existing clock, never a second loop. */
  renderVectors?: (phase: SharedValue<number>) => ReactNode;
}) {
  const phase = useC2Phase(active && animated, spin ? C2_MOTION.ringRotationMs : C2_MOTION.halfLoopMs * 2, spin ? C2_MOTION.ringDelayMs : 0);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: (scene.bob ?? 0) * c2FloatAmount(phase.value) }] }), [scene]);
  const scale = width / scene.width;
  return <View {...decorative} style={{ width, height: scene.height * scale, alignSelf: 'center', overflow: scene.clip ? 'hidden' : 'visible', pointerEvents: 'none' }}>
    <View style={{ width: scene.width, height: scene.height, transformOrigin: 'left top', transform: [{ scale }] }}>
      <Reanimated.View style={[{ width: scene.width, height: scene.height }, float]}>
        {children}
        {renderVectors?.(phase)}
        {scene.layers.map((layer, index) => <Layer key={`${layer.asset}/${index}`} layer={layer} phase={phase} />)}
        {scene.badge && <DayOneBadge badge={scene.badge} phase={phase} dayCount={dayCount} />}
      </Reanimated.View>
    </View>
  </View>;
});

export function C2Scene({ kind, width, active = true, animated = true }: { kind: C2SceneKind; width: number; active?: boolean; animated?: boolean }) {
  return <C2Artwork key={kind} scene={c2Scene(kind)} width={width} active={active} animated={animated} spin={kind === 'fresh'} />;
}
