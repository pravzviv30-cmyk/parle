/**
 * Whether an effect's cleanup is the end, or React about to run it again.
 *
 * React runs an effect's cleanup and then its body again, at once and in the
 * same task, in two cases that end nothing: StrictMode's rehearsal in
 * development, and Fast Refresh after an edit. A one-shot that landed in that
 * cleanup would land for good, because the body that runs again knows it has
 * already started and does not start twice: an entrance would never play and a
 * count would never count. So the landing waits one microtask, which runs after
 * any such remount, and happens only if nothing came back. A real unmount lands
 * once, a moment later than its cleanup.
 *
 * Pure, with nothing imported, so a Node suite can drive it; the wait is
 * injected and defaults to the next microtask.
 */

export type UnmountGuard = {
  /** The effect body ran: the caller is on screen. */
  mounted(): void;
  /** The effect cleanup ran: `land` runs after the wait, once, unless the caller came back first. */
  unmounted(land: () => void): void;
};

const nextMicrotask = (run: () => void): void => {
  void Promise.resolve().then(run);
};

export function createUnmountGuard(wait: (run: () => void) => void = nextMicrotask): UnmountGuard {
  let on = false;
  let ends = 0;
  return {
    mounted() {
      on = true;
    },
    unmounted(land) {
      on = false;
      const end = ++ends;
      wait(() => {
        // Still gone, and no later cleanup has taken over the landing.
        if (!on && end === ends) land();
      });
    },
  };
}
