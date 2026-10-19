/**
 * The trial-ending reminder for a screen: the paywall's timeline reads
 * `promised` (before purchase) and the Settings row reads `onRecord` (whether
 * to show the switch at all), `trialEndsAt`, `enabled`, `available` and
 * `scheduled`. Reads once on mount and again after a change;
 * `refresh` re-reads after the caller has asked for permission.
 */

import { useCallback, useEffect, useState } from 'react';

import { setTrialReminderEnabled, trialReminderState, type TrialReminderState } from './trialReminderSync.ts';

export interface UseTrialReminder extends TrialReminderState {
  /** False until the first read has finished. Until then nothing is promised. */
  loaded: boolean;
  setEnabled(value: boolean): Promise<void>;
  refresh(): Promise<void>;
}

const UNKNOWN: TrialReminderState = { scheduled: false, enabled: true, available: false, permission: 'denied', promised: false, onRecord: false, trialEndsAt: null };

export function useTrialReminder(): UseTrialReminder {
  const [state, setState] = useState<TrialReminderState>(UNKNOWN);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setState(await trialReminderState());
    } catch {
      setState(UNKNOWN);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setEnabled = useCallback(
    async (value: boolean) => {
      await setTrialReminderEnabled(value, Date.now()).catch(() => false);
      await refresh();
    },
    [refresh],
  );

  return { ...state, loaded, setEnabled, refresh };
}
