/**
 * Whether this plan opens a revisit of a saved conversation with the tutor.
 *
 * One helper for the doors that are not the Tutor tab's own. The rule is the
 * one the Tutor tab already reads, `capabilitiesFor(...).continueArc`, which is
 * Max and not lapsed; nothing about plan economics is decided here. It exists
 * so Practice and the conversation library ask that rule the same way, through
 * one file, instead of each growing its own read of the plan table.
 *
 * Three answers. `null` while the status is being read, so a door is not drawn
 * and then taken away. `false` for a plan that does not open it, and also for a
 * status nobody could read: a door that opened because nobody could check is a
 * door that lies about the plan (capabilities.ts says the same of an unknown
 * plan). `true` only on a real answer that opens it.
 *
 * The server still meters minutes at /session/start and still checks that the
 * saved conversation belongs to this learner. This decides only which door to
 * draw.
 */

import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useLive } from '../app/LiveContext.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { capabilitiesFor } from './capabilities.ts';
import { fetchBillingStatus } from './client.ts';

export function useContinueArc(): boolean | null {
  const { live } = useLive();
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // No server, or nobody signed in: nothing to revisit with, so closed.
      if (!live || user === null) {
        setAllowed(false);
        return undefined;
      }
      void fetchBillingStatus(user.id)
        .then((status) => {
          if (!cancelled) setAllowed(status !== null && capabilitiesFor(status.plan, status.lapsed).continueArc);
        })
        .catch(() => {
          if (!cancelled) setAllowed(false);
        });
      return () => {
        cancelled = true;
      };
    }, [live, user]),
  );

  return allowed;
}
