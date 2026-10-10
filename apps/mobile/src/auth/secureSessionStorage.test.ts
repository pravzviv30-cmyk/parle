import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createSecureSessionStorage, type KeyValueStorage } from './secureSessionStorage.ts';

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();
  failWrites = false;

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.failWrites) throw new Error('storage unavailable');
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

describe('native auth storage — encrypted migration', () => {
  test('a legacy Supabase session moves to encrypted storage before plaintext is removed', async () => {
    const secure = new MemoryStorage();
    const legacy = new MemoryStorage();
    legacy.values.set('sb-auth-token', 'old-session');
    const storage = createSecureSessionStorage(secure, legacy);

    assert.equal(await storage.getItem('sb-auth-token'), 'old-session');
    assert.equal(legacy.values.has('sb-auth-token'), false);
    assert.equal(await storage.getItem('sb-auth-token'), 'old-session');
    assert.ok([...secure.values.keys()].every((key) => key !== 'sb-auth-token'));
  });

  test('a session larger than one keychain item survives a round trip', async () => {
    const secure = new MemoryStorage();
    const legacy = new MemoryStorage();
    const storage = createSecureSessionStorage(secure, legacy);
    const session = 'token.'.repeat(1_200);

    await storage.setItem('sb-auth-token', session);

    assert.equal(await storage.getItem('sb-auth-token'), session);
    assert.ok(secure.values.size > 2, 'the session was split across bounded encrypted values');
  });

  test('a failed encrypted migration removes the plaintext bearer and requires sign-in', async () => {
    const secure = new MemoryStorage();
    const legacy = new MemoryStorage();
    legacy.values.set('sb-auth-token', 'old-session');
    secure.failWrites = true;
    const storage = createSecureSessionStorage(secure, legacy);

    assert.equal(await storage.getItem('sb-auth-token'), null);
    assert.equal(legacy.values.has('sb-auth-token'), false);
  });

  test('sign-out removes encrypted chunks and any remaining legacy copy', async () => {
    const secure = new MemoryStorage();
    const legacy = new MemoryStorage();
    const storage = createSecureSessionStorage(secure, legacy);
    await storage.setItem('sb-auth-token', 'session');
    legacy.values.set('sb-auth-token', 'stale-session');

    await storage.removeItem('sb-auth-token');

    assert.equal(await storage.getItem('sb-auth-token'), null);
    assert.equal(legacy.values.has('sb-auth-token'), false);
    assert.equal(secure.values.size, 0);
  });
});

test('a reinstall with retained Keychain restores the session without old app storage', async () => {
  const keychain = new MemoryStorage();
  const installed = createSecureSessionStorage(keychain, new MemoryStorage());
  await installed.setItem('sb-auth-token', 'retained-session');
  const reinstalled = createSecureSessionStorage(keychain, new MemoryStorage());
  assert.equal(await reinstalled.getItem('sb-auth-token'), 'retained-session');
  await reinstalled.removeItem('sb-auth-token');
  const afterLogoutAndReinstall = createSecureSessionStorage(keychain, new MemoryStorage());
  assert.equal(await afterLogoutAndReinstall.getItem('sb-auth-token'), null);
});

test('an OS that removes secure storage on uninstall requires authentication again', async () => {
  const before = createSecureSessionStorage(new MemoryStorage(), new MemoryStorage());
  await before.setItem('sb-auth-token', 'old-session');
  const freshInstall = createSecureSessionStorage(new MemoryStorage(), new MemoryStorage());
  assert.equal(await freshInstall.getItem('sb-auth-token'), null);
});
