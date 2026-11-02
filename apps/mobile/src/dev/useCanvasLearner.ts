/**
 * Seeds the canvas learner once per signed-in mock account, when every lock in
 * `canvasAllowed` holds. Development only; refused everywhere else.
 */

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthAdapter, AuthUser } from '../auth/types.ts';
import { activeUserId, clearActiveUserData } from '../storage/scope.ts';
import { canvasAllowed, canvasStartsFresh, seedCanvasLearner, spendFreshStart } from './canvasLearner.ts';

/** Accounts seeded this launch, and seeds still running (shared across remounts). */
const done = new Set<string>();
const inflight = new Map<string, Promise<void>>();

/** Clears the account once, the first time a fresh canvas run meets it. */
function startFresh(uid: string): Promise<void> {
  return spendFreshStart(uid, {
    fresh: () => canvasStartsFresh(),
    activeUid: activeUserId,
    read: (key) => AsyncStorage.getItem(key),
    write: (key, value) => AsyncStorage.setItem(key, value),
    clear: () => clearActiveUserData(),
  });
}

/**
 * Seeds once `ready` holds (the account's storage scope exists) and returns
 * whether a seed for this account is still pending, so the caller can hold its
 * first screen until the seed settles, ok or not. Off, or outside development,
 * `canvasAllowed` is false and this is false from the first render.
 */
export function useCanvasLearner(adapter: Pick<AuthAdapter, 'kind'>, user: Pick<AuthUser, 'id'> | null, ready: boolean): boolean {
  const uid = user?.id ?? null;
  const [settled, setSettled] = useState<string | null>(null);
  useEffect(() => {
    if (!ready || uid === null || done.has(uid) || !canvasAllowed(adapter)) return;
    let live = true;
    let run = inflight.get(uid);
    if (!run) {
      run = startFresh(uid).then(() => seedCanvasLearner({ id: uid }, adapter)).then((result) => {
        // A changed account, a failed write or a storage rejection may try again on the next sign-in.
        inflight.delete(uid);
        if (result.ok) done.add(uid);
      }).catch(() => { inflight.delete(uid); });
      inflight.set(uid, run);
    }
    void run.finally(() => { if (live) setSettled(uid); });
    return () => { live = false; };
  }, [adapter, uid, ready]);
  return uid !== null && canvasAllowed(adapter) && !done.has(uid) && settled !== uid;
}
