/** Gate resolves account history before the launch chooses its choreography. */
export function createLaunchWelcome() {
  let enabled: boolean | null = null;
  const listeners = new Set<(value: boolean | null) => void>();
  return {
    current: () => enabled,
    set(value: boolean | null) {
      if (value === enabled) return;
      enabled = value;
      for (const listener of listeners) listener(enabled);
    },
    subscribe(listener: (value: boolean | null) => void) {
      listeners.add(listener);
      listener(enabled);
      return () => { listeners.delete(listener); };
    },
  };
}

export const launchWelcome = createLaunchWelcome();
