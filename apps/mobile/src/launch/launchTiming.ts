/**
 * When the launch screen may leave, decided in one pure place.
 *
 * The launch is Hum, the Luvani mark, turning while the app opens: the ring
 * goes round, the name settles in beneath it, and the screen fades into
 * wherever the learner was going, which the app has already decided behind it
 * (the welcome and onboarding for somebody new, Home for everybody else).
 *
 * Returning learners leave the moment two
 * things are both true: the app beneath has nothing left to load, and the name
 * has finished arriving, so the brand moment is never cut off halfway. The
 * second condition costs a fast returning launch at most ENTRANCE_DELAY_MS plus one
 * settle; a slow launch pays nothing for it, because the ring is what fills the
 * wait instead of a spinner. With reduce motion on, the final frame is drawn
 * at once, so the only wait left is the app's own.
 *
 * New learners first see 1.5 seconds of stillness, then the name and action
 * arrive. Their welcome remains until Get Started is tapped.
 *
 * No React and no React Native in this file, so the rules are tested in node.
 */

/**
 * The mark's size on screen, in points. app.json's `expo-splash-screen`
 * `imageWidth` is the same number, and both draw the same 256 canvas, so the
 * native launch and this screen are pixel for pixel the same frame. On iOS,
 * where the native launch goes in a single frame, the hand-off between them
 * cannot be seen. src/launch/launchScreen.test.ts holds the two together.
 */
export const LAUNCH_MARK_SIZE = 128;

/** One full turn of the ring. Slow enough to read as a hum, not a spinner. */
export const RING_TURN_MS = 2400;

/** The ring turns alone for a beat before the name starts to arrive. */
export const ENTRANCE_DELAY_MS = 240;

/** New learners see the still mark for this much foreground time. */
export const FIRST_LAUNCH_STILL_MS = 1500;

/** Unknown identity must not accidentally start the returning-user animation. */
export function launchCanStart(welcome: boolean | null, reduced: boolean | null, stillFinished: boolean): boolean {
  return welcome !== null && reduced !== null && (!welcome || reduced || stillFinished);
}

/** A visible-time delay: background time never consumes the first impression. */
export function createVisibleDelay(
  durationMs: number,
  complete: () => void,
  clock = {
    now: () => Date.now(),
    schedule: (run: () => void, ms: number) => setTimeout(run, ms),
    cancel: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
  },
) {
  let remaining = durationMs;
  let since: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let finished = false;
  const pause = () => {
    if (since !== null) remaining = Math.max(0, remaining - (clock.now() - since));
    since = null;
    if (timer !== null) clock.cancel(timer);
    timer = null;
  };
  return {
    setActive(active: boolean) {
      if (finished || (active && since !== null)) return;
      if (!active) { pause(); return; }
      since = clock.now();
      timer = clock.schedule(() => {
        if (finished) return;
        finished = true;
        timer = null;
        since = null;
        complete();
      }, remaining);
    },
    dispose() { pause(); finished = true; },
  };
}

/**
 * The longest a launch is ever held, ready or not. Past this the screen leaves
 * and the app's own loading state shows beneath, so a stuck load is never
 * hidden behind a brand animation. It sits above the fresh-device wait in
 * src/app/freshDevice.ts, the longest wait the app makes on purpose, so that
 * wait is always spent watching the mark rather than a spinner.
 */
export const MAX_LAUNCH_MS = 12_000;

export type LaunchState = {
  /** The app beneath has nothing left to load. */
  readonly appReady: boolean;
  /** The name has finished arriving, or reduce motion drew it at once. */
  readonly entered: boolean;
  /** MAX_LAUNCH_MS has passed since the launch began. */
  readonly capped: boolean;
  /** Only a fresh first-run asks the learner to start; return visits stay automatic. */
  readonly welcome?: boolean | null;
  readonly started?: boolean;
};

/** May the launch screen start to leave? */
export function launchMayLeave({ appReady, entered, capped, welcome = false, started = false }: LaunchState): boolean {
  if (welcome && appReady) return entered && started;
  if (capped) return true;
  if (welcome === null) return false;
  return appReady && entered;
}
