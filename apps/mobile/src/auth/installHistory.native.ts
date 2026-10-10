import { hasCompletedLocalAccount } from './previousUse.ts';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// A non-personal device hint, separate from credentials and account erasure.
// iOS Keychain can retain it on reinstall; Android uninstallation removes it.
const KEY = 'luvani.has-used-app.v1';
const LEGACY = '@luvani/has-used-app/v1';
export async function hasUsedApp(): Promise<boolean> {
  try {
    if ((await SecureStore.getItemAsync(KEY)) === 'yes') return true;
  } catch {
    /* Try the device fallback. */
  }
  try {
    const used = (await AsyncStorage.getItem(LEGACY)) === 'yes' || await hasCompletedLocalAccount();
    // Upgrade older installs into Keychain while the local evidence remains.
    // This hint chooses the sign-in door; it can never authenticate anybody.
    if (used) await rememberAppUse();
    return used;
  } catch {
    return false;
  }
}
export async function rememberAppUse(): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, 'yes', {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch {
    /* Device storage is best effort. */
  }
  try {
    await AsyncStorage.setItem(LEGACY, 'yes');
  } catch {
    /* The launch keeps its own hint. */
  }
}
