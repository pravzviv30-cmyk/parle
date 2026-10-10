/** A first-run request, set by the screen that already knows the local draft. */
export function createLaunchWelcome() {
  let enabled = false;
  const listeners = new Set<(value: boolean) => void>();
  return {
    current: () => enabled,
    set(value: boolean) {
      if (value === enabled) return;
      enabled = value;
      for (const listener of listeners) listener(enabled);
    },
    subscribe(listener: (value: boolean) => void) {
      listeners.add(listener);
      listener(enabled);
      return () => { listeners.delete(listener); };
    },
  };
}

export const launchWelcome = createLaunchWelcome();
