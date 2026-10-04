import AsyncStorage from '@react-native-async-storage/async-storage';
import { scopeGeneration, userKey, writeInUserScope } from '../storage/scope.ts';
import { repairGuestPractice, type GuestPractice } from './guestModel.ts';

export async function loadSavedStarter(): Promise<GuestPractice | null> {
  const owner = scopeGeneration();
  const raw = await AsyncStorage.getItem(userKey('onboarding-practice'));
  if (!raw || owner !== scopeGeneration()) return null;
  try {
    return repairGuestPractice(JSON.parse(raw));
  } catch {
    return null;
  }
}
export async function saveStarter(
  value: GuestPractice,
  owner = scopeGeneration(),
): Promise<boolean> {
  const key = userKey('onboarding-practice');
  return writeInUserScope(owner, () =>
    AsyncStorage.setItem(
      key,
      JSON.stringify({ ...value, token: null, attempts: value.attempts.slice(-100) }),
    ),
  );
}
