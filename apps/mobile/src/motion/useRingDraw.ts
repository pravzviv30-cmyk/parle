/**
 * The progress ring's run, shared by its device and web halves.
 *
 * One shared value goes from `from` to the real fraction `to` through
 * motion/drive.ts, on the in-out curve, after `delay`. A new `to` draws on from
 * wherever the ring stands; the same `to` again draws nothing. `onDone` is said
 * once per run: when the run ends, or when the ring lands early (the app
 * leaving the foreground, reduced motion turned on mid-draw), because the ring
 * is then at its final frame and a caller waiting on it should not wait for
 * ever. Never after the ring has gone.
 *
 * Reduced motion: drawn at `to` at once, and `onDone` on the next tick, so a
 * caller never hears it during its own render. The ring asks `useReduceMotion`
 * and hands the live answer in, so it is watched live.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { cancel, delay, timing } from './drive.ts';
import { useLandOnLeave } from './landing.ts';
import { fraction } from './ring.ts';
import { EASE } from './tokens.ts';

export function useRingDraw({
  reduced,
  from,
  to,
  duration,
  wait,
  onDone,
}: {
  /** The ring's `useAnswered(useReduceMotion(true))`: null until the OS has answered. */
  reduced: boolean | null;
  from: number;
  to: number;
  duration: number;
  wait: number;
  onDone?: () => void;
}): { drawn: SharedValue<number>; goal: number } {
  const goal = fraction(to);
  const drawn = useSharedValue(fraction(from));
  const target = useRef<number | null>(null);
  const latest = useRef({ goal, onDone });
  useEffect(() => {
    latest.current = { goal, onDone };
  });

  // A run that has not said it is done yet.
  const owed = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => {
    alive.current = false;
  }, []);
  const settle = useCallback(() => {
    if (!owed.current) return;
    owed.current = false;
    if (alive.current) latest.current.onDone?.();
  }, []);

  const land = useCallback(() => {
    cancel(drawn);
    drawn.value = latest.current.goal;
    settle();
  }, [drawn, settle]);

  useEffect(() => {
    if (reduced === null) return;
    if (reduced) {
      if (target.current !== goal) {
        target.current = goal;
        owed.current = true;
      }
      cancel(drawn);
      drawn.value = goal;
      setTimeout(settle, 0);
      return;
    }
    if (target.current === goal) return;
    target.current = goal;
    owed.current = true;
    drawn.value = delay(
      wait,
      timing(goal, duration, EASE.inOut, reduced, (finished) => {
        if (finished) settle();
      }),
      reduced,
    );
  }, [reduced, goal, wait, duration, drawn, settle]);

  useLandOnLeave(land);

  return { drawn, goal };
}
