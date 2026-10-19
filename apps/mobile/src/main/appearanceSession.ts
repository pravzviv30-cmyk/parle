import { displayPreference, type DisplayPreference } from './appearanceModel.ts';

export const APPEARANCE_LOAD_ERROR = 'Your display choice could not be loaded.';
export const APPEARANCE_SAVE_ERROR = 'This display choice could not be saved. Try choosing it again.';

/** Serialize the device writes, including across provider remounts. */
export function serialAppearanceWrites<T>(write: (value: T) => Promise<void>) {
  let tail: Promise<void> = Promise.resolve();
  return {
    write(value: T): Promise<void> {
      const result = tail.then(() => write(value), () => write(value));
      tail = result.catch(() => undefined);
      return result;
    },
    /** A remounted provider must read after the previous provider's writes. */
    async settled(): Promise<void> { await tail; },
  };
}

/** Owns only this mounted account's async requests, not a second preference store. */
export function appearanceSession(ports: {
  current: () => boolean;
  read: () => Promise<unknown>;
  write: (value: DisplayPreference) => Promise<void>;
  value: (value: DisplayPreference) => void;
  error: (value: string | null) => void;
}) {
  let live = true;
  let revision = 0;
  const current = (ticket: number) => live && ticket === revision && ports.current();
  return {
    async load(): Promise<void> {
      const ticket = ++revision;
      try {
        const value = await ports.read();
        if (current(ticket)) ports.value(displayPreference(value));
      } catch {
        if (current(ticket)) ports.error(APPEARANCE_LOAD_ERROR);
      }
    },
    async choose(value: DisplayPreference): Promise<void> {
      if (!live || !ports.current()) return;
      const ticket = ++revision;
      ports.value(value);
      ports.error(null);
      try {
        await ports.write(value);
      } catch {
        // A failed older write cannot blame a successfully saved newer choice.
        if (current(ticket)) ports.error(APPEARANCE_SAVE_ERROR);
      }
    },
    dispose(): void { live = false; revision += 1; },
  };
}
