import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { clearOnFreshInstall, INSTALL_MARKER, type InstallDisk } from './freshInstall.ts';
import { createSecureSessionStorage, type KeyValueStorage } from './secureSessionStorage.ts';

const AUTH_DIR = import.meta.dirname;
const KEY = 'sb-project-auth-token';

/** The Keychain: survives uninstalling the app. */
class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();
  failRemoves = 0;
  /** While set, writes and removals wait for it, so a test can order overlapping calls. */
  holdWrites: Promise<void> | null = null;
  holdRemoves: Promise<void> | null = null;
  readonly log: string[];

  constructor(log: string[] = []) {
    this.log = log;
  }

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.holdWrites !== null) await this.holdWrites;
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (this.failRemoves > 0) {
      this.failRemoves -= 1;
      throw new Error('keychain unavailable');
    }
    if (this.holdRemoves !== null) await this.holdRemoves;
    this.log.push(`remove ${key}`);
    this.values.delete(key);
  }
}

/** App storage: uninstalling removes it. In the app it is also the legacy session source. */
class MemoryDisk extends MemoryStorage implements InstallDisk {
  failKeys = false;

  async getAllKeys(): Promise<readonly string[]> {
    if (this.failKeys) throw new Error('disk unavailable');
    return [...this.values.keys()];
  }

  override async setItem(key: string, value: string): Promise<void> {
    this.log.push(`set ${key}`);
    await super.setItem(key, value);
  }
}

/** One app launch on iOS, wired the way supabaseAdapter.ts wires it. */
function launch(keychain: MemoryStorage, disk: MemoryDisk): KeyValueStorage {
  return clearOnFreshInstall(createSecureSessionStorage(keychain, disk), disk);
}

async function signedIn(keychain: MemoryStorage, value: string): Promise<void> {
  await createSecureSessionStorage(keychain, new MemoryDisk()).setItem(KEY, value);
}

describe('a fresh install on iOS is a fresh start (F960)', () => {
  test('a fresh install clears the Keychain sign-in and the used-before hint once', async () => {
    const keychain = new MemoryStorage();
    await signedIn(keychain, 'previous-person');
    const disk = new MemoryDisk(); // reinstalled: app storage is gone, the Keychain is not

    const first = launch(keychain, disk);
    assert.equal(await first.getItem(KEY), null, 'the previous person must not be restored');
    assert.equal(keychain.values.size, 0, 'the stale Keychain session is removed, not just hidden');
    assert.ok(disk.values.has(INSTALL_MARKER), 'the marker records that the clear has happened');
    assert.equal(await first.getItem(KEY), null);

    await first.setItem(KEY, 'new-person');
    const second = launch(keychain, disk);
    assert.equal(await second.getItem(KEY), 'new-person', 'the clear happens once, not on every launch');

    // The used-before hint now lives only in app storage, which uninstalling removes.
    assert.equal(existsSync(path.join(AUTH_DIR, 'installHistory.native.ts')), false);
    assert.doesNotMatch(readFileSync(path.join(AUTH_DIR, 'installHistory.ts'), 'utf8'), /SecureStore/);
  });

  test('an install that already has any stored key keeps its sign-in', async () => {
    const keychain = new MemoryStorage();
    await signedIn(keychain, 'upgraded-person');
    const disk = new MemoryDisk();
    await disk.setItem('@luvani/installation/v1', 'some-installation');

    const storage = launch(keychain, disk);

    assert.equal(await storage.getItem(KEY), 'upgraded-person');
    assert.equal(disk.values.has(INSTALL_MARKER), false);
  });

  test('a storage read error never signs anyone out', async () => {
    const keychain = new MemoryStorage();
    await signedIn(keychain, 'kept-person');
    const disk = new MemoryDisk();
    disk.failKeys = true;

    const storage = launch(keychain, disk);

    assert.equal(await storage.getItem(KEY), 'kept-person');
  });

  test('a sign-in made on the fresh launch survives later reads and the next launch', async () => {
    const keychain = new MemoryStorage();
    const disk = new MemoryDisk();

    const first = launch(keychain, disk);
    await first.setItem(KEY, 'signed-in-now');
    assert.equal(await first.getItem(KEY), 'signed-in-now');
    assert.equal(await first.getItem(KEY), 'signed-in-now');

    const next = launch(keychain, disk);
    assert.equal(await next.getItem(KEY), 'signed-in-now');

    // Signing out on the fresh launch is honoured too, and the sign-in after it survives.
    const other = new MemoryStorage();
    const otherDisk = new MemoryDisk();
    const fresh = launch(other, otherDisk);
    await fresh.removeItem(KEY);
    await fresh.setItem(KEY, 'after-sign-out');
    assert.equal(await fresh.getItem(KEY), 'after-sign-out');
  });

  test('the install marker is written only after the old sign-in is removed', async () => {
    const log: string[] = [];
    const keychain = new MemoryStorage(log);
    await signedIn(keychain, 'previous-person');
    log.length = 0;
    const disk = new MemoryDisk(log);
    keychain.failRemoves = 1;

    const storage = launch(keychain, disk);

    assert.equal(await storage.getItem(KEY), null, 'a failed removal still never restores the previous person');
    assert.equal(disk.values.has(INSTALL_MARKER), false, 'no marker while the old sign-in is still there');

    assert.equal(await storage.getItem(KEY), null);
    assert.ok(disk.values.has(INSTALL_MARKER));
    const marker = log.indexOf(`set ${INSTALL_MARKER}`);
    const removedMeta = log.findIndex((entry) => entry.startsWith(`remove ${KEY}`));
    assert.ok(removedMeta !== -1 && removedMeta < marker, `removal comes before the marker: ${log.join(', ')}`);
    assert.equal(keychain.values.size, 0);
  });

  test('a sign-in written after a failed removal on the fresh launch is kept', async () => {
    const keychain = new MemoryStorage();
    const disk = new MemoryDisk();
    const storage = launch(keychain, disk);
    keychain.failRemoves = 1;

    await storage.setItem(KEY, 'new-person');

    assert.equal(await storage.getItem(KEY), 'new-person');
    assert.equal(await storage.getItem(KEY), 'new-person');
    assert.equal(disk.values.has(INSTALL_MARKER), true);
    assert.equal(await launch(keychain, disk).getItem(KEY), 'new-person');

    const shared = new MemoryStorage();
    await signedIn(shared, 'previous-person');
    const reinstalled = launch(shared, new MemoryDisk());
    shared.failRemoves = 2;

    assert.equal(await reinstalled.getItem(KEY), null);
    await reinstalled.setItem(KEY, 'new-person');
    assert.equal(await reinstalled.getItem(KEY), 'new-person');
  });

  test('a sign-out that succeeds after a failed removal settles the key', async () => {
    const keychain = new MemoryStorage();
    await signedIn(keychain, 'previous-person');
    const disk = new MemoryDisk();
    const storage = launch(keychain, disk);
    keychain.failRemoves = 1;

    await storage.removeItem(KEY);
    assert.equal(disk.values.has(INSTALL_MARKER), true, 'the sign-out itself settles the key');
    await storage.setItem(KEY, 'after-sign-out');

    assert.equal(await storage.getItem(KEY), 'after-sign-out');
    assert.equal(disk.values.has(INSTALL_MARKER), true);
  });

  test('a read that overlaps the sign-in write after a failed removal does not remove the new sign-in', async () => {
    const keychain = new MemoryStorage();
    const storage = launch(keychain, new MemoryDisk());
    const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
    let releaseWrite!: () => void;
    let releaseRemove!: () => void;
    keychain.failRemoves = 1;
    keychain.holdWrites = new Promise((resolve) => { releaseWrite = resolve; });

    const signIn = storage.setItem(KEY, 'new');
    await settle(); // the clear has failed and the sign-in write is in flight
    keychain.holdRemoves = new Promise((resolve) => { releaseRemove = resolve; });
    const read = storage.getItem(KEY);
    await settle();

    releaseWrite();
    await signIn;
    releaseRemove();
    await read;
    keychain.holdWrites = null;
    keychain.holdRemoves = null;

    assert.equal(await storage.getItem(KEY), 'new');
    assert.equal(await storage.getItem(KEY), 'new');
  });

  test('only iOS wraps the session storage with the fresh-install reset', () => {
    const adapter = readFileSync(path.join(AUTH_DIR, 'supabaseAdapter.ts'), 'utf8');
    assert.match(adapter, /Platform\.OS === 'ios'\s*\?\s*clearOnFreshInstall\(\s*secureSessionStorage,\s*AsyncStorage\s*\)\s*:\s*secureSessionStorage/);
    assert.equal(adapter.match(/clearOnFreshInstall\(/g)?.length, 1, 'the reset is applied in exactly one place');
    assert.match(adapter, /storage:\s*nativeSessionStorage/);

    const source = readFileSync(path.join(AUTH_DIR, 'freshInstall.ts'), 'utf8');
    assert.equal(source.includes('AsyncStorage.setItem('), false, 'the decorator writes through its injected disk only');
  });
});
