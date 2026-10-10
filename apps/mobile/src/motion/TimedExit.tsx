import { useEffect, useRef, type ReactNode } from 'react';
import { AppState, type StyleProp, type ViewStyle } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { cancel, timing } from './drive.ts';
import { DUR, EASE } from './tokens.ts';
import { useReduceMotion } from '../motion.ts';
/** A single short presentation, with a coordinated fade of the entire surface. */
export function TimedExit({ children, delayMs, automatic = true, onDone, style }: {
  children: ReactNode; delayMs: number; automatic?: boolean; onDone: () => void; style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReduceMotion(), opacity = useSharedValue(1);
  const latest = useRef(onDone); latest.current = onDone;
  const finished = useRef(false);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
  useEffect(() => {
    if (!automatic || finished.current) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => { if (!finished.current) { finished.current = true; latest.current(); } };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      if (AppState.currentState === 'inactive' || AppState.currentState === 'background') return;
      timer = setTimeout(() => { opacity.value = timing(0, DUR.base, EASE.out, reduced, landed => { if (landed) finish(); }); }, delayMs);
    };
    schedule();
    const sub = AppState.addEventListener('change', state => {
      if (timer) clearTimeout(timer); cancel(opacity); opacity.value = 1;
      if (state === 'active') schedule();
    });
    return () => { if (timer) clearTimeout(timer); cancel(opacity); sub.remove(); };
  }, [automatic, delayMs, reduced, opacity]);
  return <Reanimated.View style={[style, fade]}>{children}</Reanimated.View>;
}

/** Fade a prepared overlay after its durable work succeeds; content beneath stays mounted. */
export function FadeOverlay({ leaving, onHidden, children }: { leaving: boolean; onHidden: () => void; children: ReactNode }) {
  const reduced = useReduceMotion(), opacity = useSharedValue(1), done = useRef(false);
  const latest = useRef(onHidden); latest.current = onHidden;
  const fade = useAnimatedStyle(() => ({opacity:opacity.value}));
  useEffect(() => {
    if (!leaving) return;
    opacity.value = timing(0,DUR.base,EASE.out,reduced,finished => { if (finished && !done.current) { done.current = true; latest.current(); } });
    return () => cancel(opacity);
  },[leaving,reduced,opacity]);
  return <Reanimated.View style={[{flex:1},fade]}>{children}</Reanimated.View>;
}
