/**
 * When a primitive lands on its final frame without being asked.
 *
 * Every primitive in this folder stops at its final frame when the app leaves
 * the foreground and when it unmounts, so nothing runs behind a screen nobody
 * is looking at, and a learner who comes back sees where things ended rather
 * than a replay. A one-shot (an entrance, a count, a ring drawing in, a burst)
 * also has to wait for the OS to say whether movement is reduced before it
 * starts, because guessing either way is wrong: guessing "reduced" plays
 * nothing, and guessing "not" moves things at somebody who asked for stillness.
 *
 * No engine here, only React and AppState: the primitives do their own engine
 * work through motion/drive.ts.
 */

import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ANSWER_WAIT_MS } from './tokens.ts';
import { createUnmountGuard } from './unmount.ts';

/**
 * A one-shot's reduced-motion answer, from `useReduceMotion(true)`.
 *
 * Null while the OS has not answered yet, for at most `ANSWER_WAIT_MS`. After
 * that, the answer, or true when none came, so a slow answer plays the reduced
 * version (the final frame) rather than holding content back.
 */
export function useAnswered(known: boolean | null): boolean | null {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (known !== null) return;
    const timer = setTimeout(() => setLate(true), ANSWER_WAIT_MS);
    return () => clearTimeout(timer);
  }, [known]);
  if (known !== null) return known;
  return late ? true : null;
}

/**
 * Calls `land` when the app leaves the foreground and when the caller
 * unmounts. `land` cancels whatever is running and puts every value at its
 * final frame. It may change between renders; the latest one is called.
 *
 * Only a real unmount lands (motion/unmount.ts): StrictMode and Fast Refresh
 * run this cleanup and then the effect again at once, and a one-shot landed
 * there would never play.
 */
export function useLandOnLeave(land: () => void): void {
  const latest = useRef(land);
  useEffect(() => {
    latest.current = land;
  });
  const [guard] = useState(() => createUnmountGuard());
  useEffect(() => {
    guard.mounted();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') latest.current();
    });
    return () => {
      subscription.remove();
      guard.unmounted(() => latest.current());
    };
  }, [guard]);
}
