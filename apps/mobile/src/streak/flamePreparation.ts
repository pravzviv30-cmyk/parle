/** Async preparation ownership for one native Rive player, without React/timers. */
export function createFlamePreparation(ignition: boolean) {
  let generation = 0;
  let machine: 'Celebrate' | 'Idle' = ignition ? 'Celebrate' : 'Idle';
  let readiness: boolean | null = null;
  let started = false;
  return {
    get generation() { return generation; },
    get machine() { return machine; },
    get readiness() { return readiness; },
    /**
     * Skipping before first play replaces only the hidden preparation. Once
     * started, keep the same machine through ignition into the resting loop.
     * A failed preparation stays on its still; a later render never retries it.
     */
    setIgnition(wanted: boolean): boolean {
      if (wanted || started || machine === 'Idle' || readiness === false) return false;
      generation += 1;
      machine = 'Idle';
      readiness = null;
      return true;
    },
    /** Late completions/errors from a disposed player cannot affect its replacement. */
    resolve(token: number, canAnimate: boolean): boolean {
      if (token !== generation || readiness === false || readiness === canAnimate) return false;
      readiness = canAnimate;
      return true;
    },
    /** Preparation cannot advance the timeline; only the owner's play request does. */
    start(playing: boolean): { allowed: boolean; first: boolean } {
      if (!playing || readiness !== true) return { allowed: false, first: false };
      const first = !started;
      started = true;
      return { allowed: true, first };
    },
  };
}
