import { hasCompletedLocalAccount } from './previousUse.ts';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Device hint only. Account profiles remain authoritative for onboarding. */
export const INSTALL_HISTORY_KEY = '@luvani/has-used-app/v1';
export async function hasUsedApp(): Promise<boolean> {
  try {
    if ((await AsyncStorage.getItem(INSTALL_HISTORY_KEY)) === 'yes') return true;
    return await hasCompletedLocalAccount();
  } catch {
    return false;
  }
}
export async function rememberAppUse(): Promise<void> {
  try {
    await AsyncStorage.setItem(INSTALL_HISTORY_KEY, 'yes');
  } catch {
    /* The in-memory hint still handles this launch. */
  }
}
