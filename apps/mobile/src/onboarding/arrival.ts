/** Durable, account-scoped presentation receipts. They award no practice. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scopeGeneration, setItemInUserScope, userKey } from '../storage/scope.ts';
export interface Arrival { sessionId: string; finishedAt: number[]; welcomeSeen: boolean; streakSeen: boolean }
export async function loadArrival(): Promise<Arrival | null> {
  const owner = scopeGeneration();
  const raw = await AsyncStorage.getItem(userKey('first-live-arrival'));
  if (owner !== scopeGeneration()) throw new Error('Account changed.');
  if (!raw) return null;
  const v = JSON.parse(raw) as Arrival;
  if (typeof v.sessionId !== 'string' || !Array.isArray(v.finishedAt) || !v.finishedAt.every(n => Number.isSafeInteger(n) && n > 0)
    || typeof v.welcomeSeen !== 'boolean' || typeof v.streakSeen !== 'boolean') throw new Error('Your welcome could not be restored.');
  return v;
}
export async function saveArrival(value: Arrival): Promise<void> {
  await setItemInUserScope(scopeGeneration(), userKey('first-live-arrival'), JSON.stringify(value));
}
