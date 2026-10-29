/**
 * When to ask /health again (F924). Pure of React and of the platform, so the
 * rule is tested: probe once now; probe again on the browser's `online` event
 * and when the app comes to the foreground; and while not live, probe on a
 * slow repeat that stops the moment the tutor answers. Nothing polls once live.
 */
export interface LiveWatchDeps {
  probe: () => Promise<boolean>;
  isLive: () => boolean;
  onOnline: (fn: () => void) => () => void;
  onForeground: (fn: () => void) => () => void;
  every: number;
  setRepeat: (fn: () => void, ms: number) => unknown;
  clearRepeat: (handle: unknown) => void;
}

export function watchLive(deps: LiveWatchDeps): () => void {
  let stopped = false;
  let repeat: unknown = null;
  const settle = () => {
    if (stopped) return;
    if (deps.isLive()) {
      if (repeat !== null) { deps.clearRepeat(repeat); repeat = null; }
    } else if (repeat === null) {
      repeat = deps.setRepeat(() => void check(), deps.every);
    }
  };
  const check = async () => {
    if (stopped) return;
    try { await deps.probe(); } catch { /* the probe says false itself */ }
    settle();
  };
  const offOnline = deps.onOnline(() => void check());
  const offForeground = deps.onForeground(() => void check());
  void check();
  return () => {
    stopped = true;
    offOnline();
    offForeground();
    if (repeat !== null) deps.clearRepeat(repeat);
  };
}
