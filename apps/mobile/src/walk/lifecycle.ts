export interface WalkObserver {
  subscribe(interrupted: () => void): () => void;
  ready(): boolean;
}
/** Own the terminal boundary before starting the same metered live driver. */
export function prepareWalk(observer: WalkObserver | null, effects: { start: () => Promise<void>; end: () => void }) {
  let closed = false; let dispatched = false; let remove: (() => void) | null = null;
  const close = () => {
    if (closed) return; closed = true;
    try { if (dispatched) effects.end(); } finally { remove?.(); remove = null; }
  };
  const started = (async () => {
    if (!observer) { close(); return false; }
    try {
      const unsubscribe = observer.subscribe(close);
      if (closed) { unsubscribe(); return false; }
      remove = unsubscribe;
      if (!observer.ready() || closed) { close(); return false; }
      dispatched = true;
      await effects.start();
      return !closed;
    } catch { close(); return false; }
  })();
  const check = () => {
    if (closed) return;
    try { if (!observer?.ready()) close(); } catch { close(); }
  };
  return { started, close, check };
}
