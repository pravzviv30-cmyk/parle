/**
 * A live recorder's level, for the `LevelRing` around its control (come
 * alive, core loop 3.6).
 *
 * While `live`, it asks the recorder for its status every `LEVEL_POLL_MS` and
 * writes the level (`recorderLevel.ts`) into a shared value the ring reads on
 * the UI thread, so a sample costs no React render. `metered` turns true the
 * first time a real reading arrives and stays true for this recorder; until
 * then the caller draws no ring, because a recorder that does not meter has no
 * level to show and none is made up. When the take ends the level falls to
 * rest.
 *
 * Under reduced motion the ring shows only three opacity steps, so it is asked
 * a third as often. The recorder must be created with `isMeteringEnabled`.
 */

import { useEffect, useState } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { RecorderState } from 'expo-audio';

import { useReduceMotion } from '../motion.ts';
import { LEVEL_POLL_MS, levelOfStatus } from './recorderLevel.ts';

/** Under reduced motion a reading every this many polls is enough for three steps. */
const REDUCED_EVERY = 3;

export function useRecorderLevel(recorder: { getStatus(): RecorderState }, live: boolean): { level: SharedValue<number>; metered: boolean } {
  const level = useSharedValue(0);
  const [metered, setMetered] = useState(false);
  const reduced = useReduceMotion();

  useEffect(() => {
    if (!live) {
      level.value = 0;
      return;
    }
    let heard = false;
    const timer = setInterval(
      () => {
        let status: RecorderState | null;
        try {
          status = recorder.getStatus();
        } catch {
          status = null;
        }
        const now = levelOfStatus(status);
        if (now === null) return;
        level.value = now;
        if (!heard) {
          heard = true;
          setMetered(true);
        }
      },
      reduced ? LEVEL_POLL_MS * REDUCED_EVERY : LEVEL_POLL_MS,
    );
    return () => {
      clearInterval(timer);
      level.value = 0;
    };
  }, [recorder, live, reduced, level]);

  return { level, metered };
}
