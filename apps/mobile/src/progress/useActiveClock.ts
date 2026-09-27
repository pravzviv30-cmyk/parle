/**
 * A screen's active learning clock, live only while the screen is focused and
 * the app is in the foreground.
 *
 * All the rules live in `activeTime.ts`; this only feeds them focus and
 * AppState. It returns the same controller for the life of the screen, holds
 * no React state and never ticks, so a keystroke that calls `touch` costs no
 * render. It never writes to disk: the screen reads the total when it saves or
 * banks a sitting.
 *
 * A remount while backgrounded starts not-live, because the first value is
 * read from `AppState.currentState` rather than assumed. Unmount closes the
 * clock, so a timer or network callback from a screen that has gone earns
 * nothing.
 */

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { ACTIVE_CUTOFF_MS, createActiveClock, type ActiveClockController } from './activeTime.ts';
import type { ActivityKind } from './activity.ts';

export function useActiveClock(kind: ActivityKind): ActiveClockController {
  const focused = useIsFocused();
  const ref = useRef<ActiveClockController | null>(null);
  if (ref.current === null) {
    ref.current = createActiveClock(ACTIVE_CUTOFF_MS[kind], Date.now, focused && AppState.currentState === 'active');
  }
  const clock = ref.current;

  useEffect(() => {
    clock.open();
    clock.setLive(focused && AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (next) => {
      clock.setLive(focused && next === 'active');
    });
    return () => {
      subscription.remove();
      clock.setLive(false);
    };
  }, [clock, focused]);

  useEffect(() => () => clock.close(), [clock]);

  return clock;
}
