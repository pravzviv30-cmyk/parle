/**
 * A fresh install is a fresh start on iOS (F960).
 *
 * The Keychain outlives an uninstall and app storage does not, so a reinstall
 * could restore the previous person's session. An empty app storage at launch
 * means a fresh install: each session key is removed the first time it is
 * touched that launch, and only then is the marker written so the next launch
 * is not fresh. A read error counts as not fresh, so it never signs anyone out.
 */

import type { KeyValueStorage } from './secureSessionStorage.ts';

export const INSTALL_MARKER = 'luvani.install-marker.v1';

export interface InstallDisk {
  getAllKeys(): Promise<readonly string[]>;
  setItem(key: string, value: string): Promise<void>;
}

export function clearOnFreshInstall(inner: KeyValueStorage, disk: InstallDisk): KeyValueStorage {
  const fresh = disk.getAllKeys().then((keys) => keys.length === 0, () => false);
  // Per key: resolves true once the key is safe to read through.
  const handled = new Map<string, Promise<boolean>>();

  function clearOnce(key: string): Promise<boolean> {
    const known = handled.get(key);
    if (known !== undefined) return known;
    const next = fresh.then(async (isFresh) => {
      if (!isFresh) return true;
      try {
        await inner.removeItem(key);
      } catch {
        handled.delete(key); // The old sign-in is still there: try again next call.
        return false;
      }
      await disk.setItem(INSTALL_MARKER, '1').catch(() => undefined);
      return true;
    });
    handled.set(key, next);
    return next;
  }

  // A write that completed replaces whatever the failed clear left, so it settles the key (F1020).
  async function writeThrough(key: string, write: () => Promise<void>): Promise<void> {
    const cleared = await clearOnce(key);
    if (cleared) return write();
    // Settle the key before writing, so an overlapping read waits for the write
    // instead of starting a second clear that would remove it (F1021).
    let settle!: (readable: boolean) => void;
    const settled = new Promise<boolean>((resolve) => { settle = resolve; });
    handled.set(key, settled);
    try {
      await write();
    } catch (error) {
      if (handled.get(key) === settled) handled.delete(key); // The next call retries the clear.
      settle(false);
      throw error;
    }
    settle(true);
    await disk.setItem(INSTALL_MARKER, '1').catch(() => undefined);
  }

  return {
    async getItem(key) {
      return (await clearOnce(key)) ? inner.getItem(key) : null;
    },

    async setItem(key, value) {
      await writeThrough(key, () => inner.setItem(key, value));
    },

    async removeItem(key) {
      await writeThrough(key, () => inner.removeItem(key));
    },
  };
}
