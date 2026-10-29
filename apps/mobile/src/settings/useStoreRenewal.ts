/**
 * The store's renewal date and price for the plan this account holds (F909).
 *
 * The held plan is read on focus (`purchases.heldPlan`); the offering is the
 * one the Subscription screen already read, so the store is asked once. Joined
 * to the server's plan by `renewalLines`. Only the Subscription screen uses
 * this: Profile and Settings rows say the minutes line and ask the store nothing. Display only: nothing here
 * grants, buys or decides whether a session may start. On web, and on a build
 * with no store, both reads answer nothing and the line is the store pointer.
 * A preview build (`WALL_PREVIEW=store`) uses the preview fixtures instead.
 */

import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../auth/useAuth.tsx';
import { purchases, type StoreHeldPlan, type StoreOffering } from '../purchases/adapter.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { renewalLines, type StorePlatform } from '../purchases/planStatus.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { previewHeldPlan, previewOffering } from '../wall/preview.ts';
import type { RenewalLines } from './profileView.ts';

function platform(): StorePlatform {
  return Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
}

export function useStoreRenewal(status: BillingStatus | null, storeOffering: StoreOffering | null): RenewalLines {
  const { user } = useAuth();
  const [read, setRead] = useState<{ owner: number; held: StoreHeldPlan | null } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const owner = scopeGeneration();
      setRead(null);
      if (user === null) return;
      void purchases.heldPlan(user.id)
        .then((held) => { if (!cancelled && owner === scopeGeneration()) setRead({ owner, held }); })
        .catch(() => { /* No store answer: the pointer. */ });
      return () => { cancelled = true; };
    }, [user]),
  );

  const current = read !== null && read.owner === scopeGeneration() ? read : null;
  const offering = storeOffering?.available ? storeOffering : (previewOffering() ?? storeOffering);
  const held = current?.held ?? previewHeldPlan(status);
  return renewalLines(status, offering, held, platform());
}
