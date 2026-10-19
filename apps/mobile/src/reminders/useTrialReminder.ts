/**
 * The trial-ending reminder for a screen: the paywall's timeline reads
 * `promised` (before purchase) and the Settings row reads `onRecord` (whether
 * to show the switch at all), `trialEndsAt`, `enabled`, `available` and
 * `scheduled`. Reads once on mount, again after a change,
 * and again when the app comes back to the foreground (the learner may have
 * just allowed notifications in iOS Settings); `refresh` re-reads after the
 * caller has asked for permission. A read that lands after unmount or after
 * the account changed is dropped (review P3 #10).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { scopeGeneration } from '../storage/scope.ts';
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
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const owner = scopeGeneration();
    let next: TrialReminderState;
    try {
      next = await trialReminderState();
    } catch {
      next = UNKNOWN;
    }
    if (!mounted.current || owner !== scopeGeneration()) return;
    setState(next);
    setLoaded(true);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => {
      mounted.current = false;
      sub.remove();
    };
  }, [refresh]);

  const setEnabled = useCallback(
    async (value: boolean) => {
      const owner = scopeGeneration();
      await setTrialReminderEnabled(value, Date.now()).catch(() => false);
      if (!mounted.current || owner !== scopeGeneration()) return;
      await refresh();
    },
    [refresh],
  );

  return { ...state, loaded, setEnabled, refresh };
}
