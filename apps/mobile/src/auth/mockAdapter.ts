/**
 * The keyless auth backend: accounts that live entirely on this device.
 *
 * DEV ONLY. This exists so the app keeps its run-with-no-keys promise — the
 * same screens, the same gate, a stable per-account id for the meter — while
 * being zero real security. Passwords are stored as an SHA-256 digest so a
 * casual storage dump does not read them back, and that is the entire threat
 * model; anyone with the device owns these accounts. Supabase replaces all of
 * this the moment the env carries a project.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { AuthAdapter, AuthResult, AuthUser } from './types.ts';

const KEY = 'luvani.auth.mock.v1';

interface MockAccount {
  id: string;
  email: string;
  passwordDigest: string;
  provider: 'mock' | 'google';
}

interface MockStore {
  version: 1;
  users: Record<string, MockAccount>;
  sessionUserId: string | null;
}

function emptyStore(): MockStore {
  return { version: 1, users: {}, sessionUserId: null };
}

async function readStore(): Promise<MockStore> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return emptyStore();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return emptyStore();
    if ((parsed as { version?: unknown }).version !== 1) return emptyStore();
    return parsed as MockStore;
  } catch {
    return emptyStore();
  }
}

async function writeStore(store: MockStore): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Storage full or unavailable. The session still holds for this launch.
  }
}

function digest(email: string, password: string): Promise<string> {
  // Salted with the email so equal passwords do not share a digest.
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${email}:${password}`);
}

function toUser(account: MockAccount): AuthUser {
  return { id: account.id, email: account.email, provider: account.provider === 'google' ? 'google' : 'mock' };
}

export function createMockAdapter(): AuthAdapter {
  const listeners = new Set<(user: AuthUser | null) => void>();

  function notify(user: AuthUser | null): void {
    for (const cb of listeners) cb(user);
  }

  async function setSession(store: MockStore, account: MockAccount | null): Promise<void> {
    await writeStore({ ...store, sessionUserId: account?.id ?? null });
    notify(account ? toUser(account) : null);
  }

  return {
    kind: 'mock',

    async getSession() {
      const store = await readStore();
      if (store.sessionUserId === null) return null;
      const account = Object.values(store.users).find((u) => u.id === store.sessionUserId);
      return account ? toUser(account) : null;
    },

    onAuthStateChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    async signUpWithPassword(email, password): Promise<AuthResult> {
      const store = await readStore();
      const key = email.trim().toLowerCase();
      if (store.users[key]) {
        return { ok: false, message: 'That email already has an account on this device. Sign in instead.' };
      }
      const account: MockAccount = {
        id: `mock-${Math.random().toString(36).slice(2, 10)}`,
        email: key,
        passwordDigest: await digest(key, password),
        provider: 'mock',
      };
      const next: MockStore = { ...store, users: { ...store.users, [key]: account } };
      await setSession(next, account);
      return { ok: true };
    },

    async signInWithPassword(email, password): Promise<AuthResult> {
      const store = await readStore();
      const key = email.trim().toLowerCase();
      const account = store.users[key];
      if (!account) {
        return { ok: false, message: 'No account with that email on this device yet. Create one first.' };
      }
      if (account.passwordDigest !== (await digest(key, password))) {
        return { ok: false, message: 'That password does not match this email.' };
      }
      await setSession(store, account);
      return { ok: true };
    },

    async signInWithGoogle(): Promise<AuthResult> {
      // Keyless dev has no Google to talk to; a stable stand-in account keeps
      // the button, the flow, and per-user data all testable.
      const store = await readStore();
      const key = 'google-dev@luvani.local';
      const account: MockAccount = store.users[key] ?? {
        id: 'mock-google-dev',
        email: key,
        passwordDigest: '',
        provider: 'google',
      };
      const next: MockStore = { ...store, users: { ...store.users, [key]: account } };
      await setSession(next, account);
      return { ok: true };
    },

    async sendPasswordReset(): Promise<AuthResult> {
      return {
        ok: true,
        message: 'Accounts live on this device in demo mode, so there is no email to send. Create a new account if the password is lost.',
      };
    },

    async reauthenticateForDeletion(): Promise<AuthResult> {
      return { ok: true };
    },

    async deleteAccount(): Promise<AuthResult> {
      const store = await readStore();
      if (store.sessionUserId === null) return { ok: false, message: 'There is no signed-in account to delete.' };
      const users = Object.fromEntries(
        Object.entries(store.users).filter(([, account]) => account.id !== store.sessionUserId),
      );
      await writeStore({ ...store, users, sessionUserId: null });
      return { ok: true };
    },

    async signOut() {
      const store = await readStore();
      await setSession(store, null);
    },

    async getAccessToken() {
      return null;
    },
  };
}
