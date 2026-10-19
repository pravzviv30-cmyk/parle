/**
 * Keeps the trial-ending reminder honest for the signed-in learner. Mounted
 * once, in `App.tsx` `Gate`. The timing rules are `trialReminderWiring.ts`;
 * every decision about the reminder is `reminders/trialReminder.ts`.
 */

import { useEffect, useLayoutEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { onBillingChange } from './billingChanges.ts';
import { fetchBillingStatus } from './client.ts';
import { purchases } from './adapter.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { cancelTrialReminder, syncTrialReminder } from '../reminders/trialReminderSync.ts';
import { accountLeft, startTrialReminderSync } from './trialReminderWiring.ts';

/** `userId` is the signed-in learner, or null; `loading` while auth has not answered. */
export function useTrialReminderSync(userId: string | null, loading: boolean): void {
  const last = useRef<string | null>(null);
  // Before the next tree plans anything: a shared phone never keeps one
  // learner's trial reminder for the next.
  useLayoutEffect(() => {
    if (loading) return;
    const was = last.current;
    last.current = userId;
    if (accountLeft(was, userId)) void cancelTrialReminder();
  }, [userId, loading]);

  useEffect(() => {
    if (loading || userId === null) return;
    const owner = scopeGeneration();
    return startTrialReminderSync({
      userId,
      isCurrent: () => owner === scopeGeneration(),
      fetchStatus: fetchBillingStatus,
      storeFacts: (id) => purchases.trialFacts(id),
      sync: syncTrialReminder,
      now: Date.now,
      onForeground: (listener) => {
        const sub = AppState.addEventListener('change', (state) => { if (state === 'active') listener(); });
        return () => sub.remove();
      },
      onBillingChange,
      onStoreChange: (listener) => purchases.onStoreChange(listener),
    });
  }, [userId, loading]);
}
