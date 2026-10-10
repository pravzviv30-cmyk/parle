import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { decorative } from '../theme.ts';
import { flameFrameAt, type FlameFrame } from './flameMotion.ts';
import { StreakFlameFrame, useFlameActivity, type StreakFlameProps } from './StreakFlame.shared.tsx';

export { StreakFlameStill, type StreakFlameProps } from './StreakFlame.shared.tsx';
const REST: FlameFrame = { amount: 0, scaleX: 1, scaleY: 1, opacity: 1 };

/** Web animates the same cubic contours as the native Rive, at a bounded 30fps. */
export function StreakFlame(props: StreakFlameProps) {
  const { running, reduced } = useFlameActivity(props);
  const played = useRef(false);
  const [frame, setFrame] = useState<FlameFrame>(REST);
  const celebrating = props.celebrating ?? false;
  const playing = props.playing ?? true;
  useEffect(() => {
    if (reduced !== null) props.onReady?.(reduced === false);
  }, [reduced, props.onReady]);
  useEffect(() => {
    if (reduced === true && celebrating) played.current = true;
    if (!running || !playing) { setFrame(REST); return; }
    const ignition = celebrating && !played.current;
    played.current = true;
    let animationFrame = 0;
    let began: number | undefined;
    let lastFrame = -100;
    const tick = (now: number) => {
      began ??= now;
      if (now - lastFrame >= 1000 / 30) {
        setFrame(flameFrameAt(now - began, ignition));
        lastFrame = now;
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(animationFrame); };
    // The finite opening is captured on playback start. The parent's entrance
    // completing never restarts the same flame or its idle phase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, reduced, playing]);
  return <View {...decorative} style={{ width: props.size, height: props.size, alignSelf: 'center', pointerEvents: 'none' }}>
    <StreakFlameFrame size={props.size} frame={running && playing ? frame : REST} />
  </View>;
}
