/**
 * Where the suggestion card had got to.
 *
 * One integer, per account. It is a convenience and not learning state, which
 * is why it carries no version envelope, joins no sync adoption, and forgives
 * every failure by answering nought: the worst a lost value can do is show a
 * learner today's situation again, and that is not worth a try/catch that
 * reports anything.
 *
 * Keyed through `userKey` like every other store, so two accounts on one
 * device do not walk each other's pool.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { userKey } from '../storage/scope.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('suggestions');

export async function loadSuggestionOffset(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY());
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export async function saveSuggestionOffset(offset: number): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY(), `${Math.max(0, Math.trunc(offset))}`);
  } catch {
    // The card still moved on screen. Losing where it got to costs the learner
    // one repeated suggestion, and nothing worth interrupting them for.
  }
}
