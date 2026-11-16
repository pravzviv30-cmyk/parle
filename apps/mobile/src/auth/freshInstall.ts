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

  return {
    async getItem(key) {
      return (await clearOnce(key)) ? inner.getItem(key) : null;
    },

    async setItem(key, value) {
      await clearOnce(key);
      await inner.setItem(key, value);
    },

    async removeItem(key) {
      await clearOnce(key);
      await inner.removeItem(key);
    },
  };
}
