import { useEffect, useLayoutEffect, useState } from 'react';
import { launchHolds } from './launchHold.ts';

/**
 * Hold the launch screen while this wait is on screen.
 *
 * A layout effect rather than an ordinary one, so the hold is in place before
 * the frame is painted and the launch never sees a gap the app did not have.
 * Holding after the launch has gone is harmless: nothing is listening.
 */
export function useLaunchHold(active = true): void {
  useLayoutEffect(() => (active ? launchHolds.hold() : undefined), [active]);
}

/** Whether the app beneath the launch screen has nothing left to load. */
export function useLaunchReady(): boolean {
  const [ready, setReady] = useState(launchHolds.ready());
  useEffect(() => launchHolds.subscribe(setReady), []);
  return ready;
}
