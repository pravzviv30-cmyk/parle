/**
 * How the launch screen knows the app beneath it is ready.
 *
 * The app already says when it is not. These are the waits on the way in, and
 * each holds the launch while it is on screen:
 *
 *   - the one `Loading` view in App.tsx: fonts, the session, the learner's
 *     storage, the fresh-device pull;
 *   - ProfileGate, which draws nothing while the profile is read;
 *   - GuestAccountHandoff, which draws a blank while it reads a guest's practice;
 *   - PreAccountOnboarding, which shows a loading line while it does the same.
 *
 * The app is ready when nothing holds it. That is a fact the screens already
 * know, read where they know it, rather than a second guess at readiness kept
 * somewhere else. A new wait on the way in joins this list and
 * launchScreen.test.ts, or the launch fades onto it.
 *
 * Waits hand over to one another. Within one commit that needs no help: the
 * old wait's release and the new one's hold land together, before the settle
 * timer could ever fire. But a wait can also end a commit or two before the next
 * one starts, as when an effect sets the state that mounts it. So the registry
 * only calls the app ready once nothing has held it for SETTLE_GAP_MS, which
 * steps over a hand-over of a few frames and is far too short to see.
 *
 * Pure and dependency-free so it is tested in node; the React hooks that use it
 * are in useLaunch.ts.
 */

/** How long nothing must hold the launch before the app counts as ready. */
export const SETTLE_GAP_MS = 120;

type Timer = ReturnType<typeof setTimeout>;

export type LaunchHolds = {
  /** Hold the launch until the returned release is called. Releasing twice is harmless. */
  hold(): () => void;
  /** Hear whether the app is ready, now and on every change. Returns the unsubscribe. */
  subscribe(listener: (ready: boolean) => void): () => void;
  /** How many waits are on screen. */
  holds(): number;
  /** Whether nothing has held the launch for SETTLE_GAP_MS. */
  ready(): boolean;
};

export function createLaunchHolds(
  schedule: (run: () => void, ms: number) => Timer = (run, ms) => setTimeout(run, ms),
  cancel: (timer: Timer) => void = (timer) => clearTimeout(timer),
  gapMs: number = SETTLE_GAP_MS,
): LaunchHolds {
  let count = 0;
  let settled = false;
  let timer: Timer | null = null;
  const listeners = new Set<(ready: boolean) => void>();

  const emit = () => {
    for (const listener of listeners) listener(settled);
  };

  const check = () => {
    if (count > 0) {
      if (timer !== null) {
        cancel(timer);
        timer = null;
      }
      if (settled) {
        settled = false;
        emit();
      }
      return;
    }
    if (settled || timer !== null) return;
    timer = schedule(() => {
      timer = null;
      if (count === 0 && !settled) {
        settled = true;
        emit();
      }
    }, gapMs);
  };

  return {
    hold() {
      count += 1;
      check();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        count -= 1;
        check();
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(settled);
      check();
      return () => {
        listeners.delete(listener);
      };
    },
    holds: () => count,
    ready: () => settled,
  };
}

/** The app's one registry. */
export const launchHolds = createLaunchHolds();
