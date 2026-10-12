/** Bounded ownership of the chooser's bundled assets; never starts playback. */
export function createPreviewPreloader<Key extends string>(keys: readonly Key[], deps: {
  preload: (key: Key) => Promise<void>;
  clear: (key: Key) => Promise<void>;
}) {
  let leases = 0;
  const work = new Map<Key, Promise<void>>();
  const enqueue = (key: Key, job: () => Promise<void>) => {
    const next = (work.get(key) ?? Promise.resolve()).then(job).catch(() => {});
    work.set(key, next);
    void next.then(() => { if (work.get(key) === next) work.delete(key); });
  };
  const refresh = (key: Key) => {
    if (!leases || !keys.includes(key)) return;
    enqueue(key, async () => { if (leases) await deps.preload(key); });
  };
  const retain = () => {
    if (++leases === 1) for (const key of keys) refresh(key);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (--leases === 0) for (const key of keys) {
        // Serialize behind in-flight preload so a late load cannot leak after
        // leaving. A fresh foreground lease keeps its cache instead of clearing it.
        enqueue(key, async () => { if (!leases) await deps.clear(key); });
      }
    };
  };
  return { retain, refresh };
}
