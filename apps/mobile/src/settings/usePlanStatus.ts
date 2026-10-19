/**
 * The plan, read from the server on focus and on Try again.
 *
 * Lifted out of `profile/PlanCard.tsx` so Profile's plan row, Settings' plan row
 * and the Subscription screen read it the same way: null until the read
 * answers, scoped to the account that asked, and `planStatusFor`'s honest
 * unknown when the server could not be reached.
 */

import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../auth/useAuth.tsx';
import { fetchBillingStatus } from '../purchases/client.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { planStatusFor, type PlanStatusView } from '../purchases/planStatus.ts';
import { scopeGeneration } from '../storage/scope.ts';

export interface PlanStatusRead {
  /** Null until the read answers. */
  view: PlanStatusView | null;
  /** The server's answer, or null when it gave none (or has not yet). */
  status: BillingStatus | null;
  /** Read again, for the Try again button. */
  retry: () => void;
}

export function usePlanStatus(): PlanStatusRead {
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [record, setRecord] = useState<{ owner: number; view: PlanStatusView; status: BillingStatus | null } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const owner = scopeGeneration();
      setRecord(null);
      if (user === null) return;
      void fetchBillingStatus(user.id)
        .then((status) => {
          if (!cancelled && owner === scopeGeneration()) setRecord({ owner, view: planStatusFor(status, Date.now()), status });
        })
        .catch(() => {
          // fetchBillingStatus answers null for every failure, so this is a
          // sign-out landing between focus and answer. Nothing to draw.
        });
      return () => {
        cancelled = true;
      };
    }, [user, attempt]),
  );

  const current = record !== null && record.owner === scopeGeneration() ? record : null;
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { view: current?.view ?? null, status: current?.status ?? null, retry };
}
