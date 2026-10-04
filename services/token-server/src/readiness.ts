export interface BackendReadiness {
  schema: boolean; redis: boolean; tutor: boolean; practice: boolean; maintenance: boolean; admission: boolean;
}
const unavailable = (): BackendReadiness => ({ schema: false, redis: false, tutor: false, practice: false, maintenance: false, admission: false });
/** A single bounded probe is cached across callers. No speech/model work in probes. */
export function cachedReadiness(probe: (signal: AbortSignal) => Promise<BackendReadiness>, options: { timeoutMs?: number; ttlMs?: number } = {}) {
  let current = unavailable();
  let checkedAt = 0;
  let pending: Promise<BackendReadiness> | undefined;
  let draining = false;
  async function refresh() {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timedOut = new Promise<BackendReadiness>(resolve => {
        timer = setTimeout(() => { controller.abort(); resolve(unavailable()); }, options.timeoutMs ?? 2000);
      });
      current = await Promise.race([probe(controller.signal).catch(unavailable), timedOut]);
      checkedAt = Date.now();
      return current;
    } finally { clearTimeout(timer); pending = undefined; }
  }
  return {
    drain: () => { draining = true; },
    async state() {
      if (Date.now() - checkedAt > (options.ttlMs ?? 15_000)) pending ??= refresh();
      const components = pending ? await pending : current;
      return { ready: !draining && Object.values(components).every(value => value === true), draining, components };
    },
  };
}
