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
/**
 * Whether the post-sign-up welcome should show (founder decision 18, F926).
 * Only for an account with no guest practice left to hand off, and only while
 * the receipt says it has not been seen.
 */
export function welcomePending(guestLeft: boolean, arrival: Arrival | null, newlyCreated: boolean): boolean {
  if (guestLeft) return false;
  return arrival ? !arrival.welcomeSeen : newlyCreated;
}
/**
 * Written the moment the welcome is drawn, not on Continue, so a reload before
 * Continue never shows it twice. Everything Continue does besides this still
 * runs on Continue, or on the reload path when the welcome is not shown.
 */
export async function markWelcomeSeen(): Promise<void> {
  const arrival = await loadArrival();
  if (arrival?.welcomeSeen === true) return;
  await saveArrival({ ...(arrival ?? { sessionId: 'account-welcome', finishedAt: [], streakSeen: true }), welcomeSeen: true });
}
