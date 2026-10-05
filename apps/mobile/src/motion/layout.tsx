/**
 * Arriving, moving over and leaving: the three layout primitives.
 *
 * Screens use these and never import the engine themselves (motion.test.ts,
 * rule 1). `Enter` is a fade and a short rise on mount, driven through
 * motion/drive.ts like every other primitive, so it behaves the same on a phone
 * and on the web. `Reflow` and `Exit` are Reanimated's layout transitions, each
 * told the live reduced-motion answer explicitly, because left to its default
 * the engine would follow the setting it sampled once at launch. Not for use
 * inside a FlatList yet.
 *
 * Reduced motion: an entrance is simply there, a reflow jumps, and an exit is
 * gone at once. Content is never held back past the moment the OS answers.
 */

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Reanimated, { FadeOut, LinearTransition, ReduceMotion, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '../motion.ts';
import { bezier, cancel, delay, timing } from './drive.ts';
import { useAnswered, useLandOnLeave } from './landing.ts';
import { DUR, EASE, ENTER_DISTANCE, STAGGER } from './tokens.ts';

export type EnterProps = {
  /** Its place in a run of siblings: it starts `index * step` after the first. */
  index?: number;
  /** The gap between siblings. A `STAGGER` token. */
  step?: number;
  /** Where it rises from. `none` only fades. */
  from?: 'down' | 'up' | 'none';
  /** How far it travels, in points. */
  distance?: number;
  /** The scale it grows from. 1 for no growth. */
  scaleFrom?: number;
  /** How long it takes. A `DUR` token. */
  duration?: number;
  /** Extra wait before it starts, in milliseconds. */
  delay?: number;
  /** False to show it at rest with no entrance: a row that was there before the list was. */
  play?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * One entrance, on first mount: opacity 0 to 1 and a rise of `distance` to
 * rest, on the out curve. Later renders never replay it.
 */
export function Enter({
  index = 0,
  step = STAGGER.base,
  from = 'down',
  distance = ENTER_DISTANCE,
  scaleFrom = 1,
  duration = DUR.base,
  delay: wait = 0,
  play = true,
  style,
  children,
}: EnterProps) {
  const reduced = useAnswered(useReduceMotion(true));
  const shown = useSharedValue(play ? 0 : 1);
  const started = useRef(!play);
  const rise = from === 'down' ? distance : from === 'up' ? -distance : 0;
  const look = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * rise }, { scale: scaleFrom + (1 - scaleFrom) * shown.value }],
  }));
  useEffect(() => {
    if (reduced === null) return;
    if (reduced) {
      cancel(shown);
      shown.value = 1;
      return;
    }
    if (started.current) return;
    started.current = true;
    shown.value = delay(wait + Math.max(0, index) * step, timing(1, duration, EASE.out, reduced), reduced);
  }, [reduced, shown, wait, index, step, duration]);
  useLandOnLeave(() => {
    cancel(shown);
    shown.value = 1;
  });
  return <Reanimated.View style={[style, look]}>{children}</Reanimated.View>;
}

/** The live answer as the engine's own mode, for the two layout transitions below. */
function useMode(): ReduceMotion {
  const reduced = useReduceMotion();
  return reduced ? ReduceMotion.Always : ReduceMotion.Never;
}

/**
 * Its children move to their new places when the layout around them changes,
 * over `DUR.base` on the in-out curve, rather than jumping.
 */
export function Reflow({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const mode = useMode();
  const transition = useMemo(() => LinearTransition.duration(DUR.base).easing(bezier(EASE.inOut)).reduceMotion(mode), [mode]);
  return (
    <Reanimated.View layout={transition} style={style}>
      {children}
    </Reanimated.View>
  );
}

/**
 * Its children fade out over `DUR.micro` when the caller stops rendering it.
 * Render it conditionally (`{shown ? <Exit>...</Exit> : null}`); a thing that
 * stays mounted never exits.
 */
export function Exit({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const mode = useMode();
  const leaving = useMemo(() => FadeOut.duration(DUR.micro).reduceMotion(mode), [mode]);
  return (
    <Reanimated.View exiting={leaving} style={style}>
      {children}
    </Reanimated.View>
  );
}
