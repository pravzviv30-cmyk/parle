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
  // Keys with nothing stale left to read this launch.
  const settled = new Set<string>();
  // Each key's calls run one at a time, so no clear can interleave with a write (F1022).
  const tails = new Map<string, Promise<unknown>>();

  function inTurn<T>(key: string, run: () => Promise<T>): Promise<T> {
    const result = (tails.get(key) ?? Promise.resolve()).then(run);
    tails.set(key, result.catch(() => undefined));
    return result;
  }

  async function settle(key: string): Promise<void> {
    settled.add(key);
    await disk.setItem(INSTALL_MARKER, '1').catch(() => undefined);
  }

  // True once nothing stale can be read under this key. A failed removal is retried next call.
  async function clear(key: string): Promise<boolean> {
    if (settled.has(key) || !(await fresh)) return true;
    try {
      await inner.removeItem(key);
    } catch {
      return false;
    }
    await settle(key);
    return true;
  }

  // A write that completed replaces whatever a failed clear left, so it settles the key (F1020).
  async function writeThrough(key: string, write: () => Promise<void>): Promise<void> {
    const cleared = await clear(key);
    await write();
    if (!cleared) await settle(key);
  }

  return {
    getItem: (key) => inTurn(key, async () => ((await clear(key)) ? inner.getItem(key) : null)),
    setItem: (key, value) => inTurn(key, () => writeThrough(key, () => inner.setItem(key, value))),
    removeItem: (key) => inTurn(key, () => writeThrough(key, () => inner.removeItem(key))),
  };
}
