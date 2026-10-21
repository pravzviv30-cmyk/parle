/**
 * Seeds the canvas learner once per signed-in mock account, when every lock in
 * `canvasAllowed` holds. Development only; refused everywhere else.
 */

import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthAdapter, AuthUser } from '../auth/types.ts';
import { clearActiveUserData } from '../storage/scope.ts';
import { canvasAllowed, canvasStartsFresh, seedCanvasLearner } from './canvasLearner.ts';

const seeded = new Set<string>();

/** Device key: this mock account has had its one fresh start. Development only. */
const freshKey = (uid: string): string => `luvani.dev.canvasFresh.${uid}`;

/** Clears the account once, the first time a fresh canvas run meets it. */
async function startFresh(uid: string): Promise<void> {
  if (!canvasStartsFresh() || (await AsyncStorage.getItem(freshKey(uid))) !== null) return;
  await clearActiveUserData();
  await AsyncStorage.setItem(freshKey(uid), new Date().toISOString());
}

export function useCanvasLearner(adapter: Pick<AuthAdapter, 'kind'>, user: Pick<AuthUser, 'id'> | null): void {
  const uid = user?.id ?? null;
  useEffect(() => {
    if (uid === null || seeded.has(uid) || !canvasAllowed(adapter)) return;
    seeded.add(uid);
    void startFresh(uid).then(() => seedCanvasLearner({ id: uid }, adapter)).then((result) => {
      // A changed account or a failed write may try again on the next sign-in.
      if (!result.ok) seeded.delete(uid);
    });
  }, [adapter, uid]);
}
