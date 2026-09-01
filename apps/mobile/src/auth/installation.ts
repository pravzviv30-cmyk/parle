/**
 * A random installation signal for server-side abuse budgets. It is not an
 * advertising identifier and carries no account or device-platform content.
 * It intentionally survives sign-out and account deletion so creating another
 * account cannot reset vendor-cost protection.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const KEY = 'luvani.installation.v1';
let pending: Promise<string> | null = null;

export function installationId(): Promise<string> {
  pending ??= (async () => {
    const existing = await AsyncStorage.getItem(KEY);
    if (existing && /^[a-zA-Z0-9-]{16,80}$/.test(existing)) return existing;
    const created = Crypto.randomUUID();
    await AsyncStorage.setItem(KEY, created);
    return created;
  })();
  return pending;
}

