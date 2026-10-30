/**
 * The live room's small movements outside the portrait (UI-014, direction D):
 * the cloud mic's squish with the learner's level, its cheer when a goal is
 * reached, and a goal stamp landing. None of them loops.
 *
 * - `LevelSquish`: scale X `1 + 0.07 L`, Y `1 - 0.1 L` from a live level, each
 *   change re-aimed on `SPRING.settle`. Anchored at the base, so the cloud sits
 *   down rather than shrinking into the air.
 * - `Hop`: two hops on `SPRING.pop` each time `cue` changes, well inside
 *   `CELEBRATION_MAX_MS`.
 * - `PopIn`: a stamp grows from 0.6 to 1 on `SPRING.pop` once, when `play`
 *   first turns true.
 *
 * Reduced motion: all three hold still, watched live. Transform only;
 * decoration, so nothing here is reachable by a screen reader.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Reanimated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { useReduceMotion } from '../motion.ts';
import { cancel, delay, sequence, spring } from './drive.ts';
import { useLandOnLeave } from './landing.ts';
import { SPRING } from './tokens.ts';

/** How far the cloud squishes at full level. */
export const SQUISH = { wide: 0.07, low: 0.1 } as const;
/** The cheer's two hops, in points. */
export const HOP = { first: 18, second: 7 } as const;
/** Where a landing stamp starts. */
export const POP_FROM = 0.6;

export function LevelSquish({ level, on, height, children }: { level: SharedValue<number> | null; on: boolean; height: number; children: ReactNode }) {
  const reduced = useReduceMotion();
  const at = useSharedValue(0);
  const live = on && !reduced && level !== null;
  useAnimatedReaction(
    () => (live && level !== null ? Math.min(1, Math.max(0, level.value)) : 0),
    (now, previous) => {
      if (now === previous) return;
      at.value = spring(now, SPRING.settle, reduced);
    },
    [live, reduced],
  );
  useEffect(() => {
    if (live) return;
    cancel(at);
    at.value = 0;
  }, [live, at]);
  useLandOnLeave(() => { cancel(at); at.value = 0; });
  const look = useAnimatedStyle(() => {
    const scaleY = 1 - SQUISH.low * at.value;
    // Keep the base where it is: shift down by half of what the height lost.
    return { transform: [{ translateY: (height * (1 - scaleY)) / 2 }, { scaleX: 1 + SQUISH.wide * at.value }, { scaleY }] };
  }, [height]);
  return <Reanimated.View style={[st.still, look]}>{children}</Reanimated.View>;
}

export function Hop({ cue, children }: { cue: number; children: ReactNode }) {
  const reduced = useReduceMotion();
  const y = useSharedValue(0);
  const first = useRef(cue);
  useEffect(() => {
    if (cue === first.current) return;
    cancel(y);
    y.value = 0;
    if (reduced) return;
    y.value = sequence(reduced,
      spring(-HOP.first, SPRING.pop, reduced), spring(0, SPRING.pop, reduced),
      spring(-HOP.second, SPRING.pop, reduced), spring(0, SPRING.pop, reduced));
  }, [cue, reduced, y]);
  useLandOnLeave(() => { cancel(y); y.value = 0; });
  const look = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Reanimated.View style={[st.still, look]}>{children}</Reanimated.View>;
}

export function PopIn({ play, children }: { play: boolean; children: ReactNode }) {
  const reduced = useReduceMotion();
  const scale = useSharedValue(1);
  const played = useRef(false);
  useEffect(() => {
    if (!play || played.current) return;
    played.current = true;
    if (reduced) return;
    scale.value = POP_FROM;
    scale.value = spring(1, SPRING.pop, reduced);
  }, [play, reduced, scale]);
  useLandOnLeave(() => { cancel(scale); scale.value = 1; });
  const look = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Reanimated.View style={look}>{children}</Reanimated.View>;
}

/**
 * Rises `distance` points into place on `SPRING.settle` after `wait` ms, once,
 * when it mounts: the toast peeking over the Help sheet. In place at once
 * under reduced motion.
 */
export const PEEK = { rise: 40, wait: 200 } as const;

export function Rise({ children }: { children: ReactNode }) {
  const reduced = useReduceMotion();
  const y = useSharedValue(reduced ? 0 : PEEK.rise);
  useEffect(() => {
    if (reduced) { cancel(y); y.value = 0; return; }
    y.value = delay(PEEK.wait, spring(0, SPRING.settle, reduced), reduced);
  }, [reduced, y]);
  useLandOnLeave(() => { cancel(y); y.value = 0; });
  const look = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Reanimated.View style={[st.still, look]}>{children}</Reanimated.View>;
}

const st = StyleSheet.create({
  still: { pointerEvents: 'box-none' },
});
