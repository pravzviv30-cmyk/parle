/**
 * How many days the learner has practised, ever, for Profile's Progress row.
 *
 * The same read `progress/DayCount.tsx` makes, on focus and scoped to the
 * account that asked, folded to a count rather than a sentence so the row can
 * say it beside the level. Null until the read answers and when it cannot be
 * read, and then the row simply says less.
 */

import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../auth/useAuth.tsx';
import { loadActiveDays } from '../progress/activity.ts';
import { scopeGeneration } from '../storage/scope.ts';

export function usePracticeDays(): number | null {
  const { user } = useAuth();
  const [value, setValue] = useState<{ owner: number; count: number } | null>(null);
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    const owner = scopeGeneration();
    void loadActiveDays()
      .then((days) => { if (!cancelled && owner === scopeGeneration()) setValue({ owner, count: new Set(days).size }); })
      .catch(() => { if (!cancelled && owner === scopeGeneration()) setValue(null); });
    return () => { cancelled = true; };
  }, [user?.id]));
  return value !== null && value.owner === scopeGeneration() ? value.count : null;
}
