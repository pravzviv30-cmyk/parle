/**
 * The purchase moment, built from the server's confirmed grant (README Part
 * 5.G: "check + PurchaseConfirmed only after a confirmed entitlement").
 *
 * The client never sees a store transaction id, so the moment is keyed by what
 * the server confirmed: the paid plan and the end of the period it granted.
 * That names one purchase the same way on every device, so the synced `seen`
 * list plays it once however many phones confirm it. A grant with no period end
 * (the trial, which is never a purchase) has no key, and so no moment. Pure.
 */

import type { BillingStatus } from '../purchases/billingStatus.ts';
import { celebrationKey, type CelebrationEvent } from './events.ts';

/** The confirmed grant's own name for the purchase, or null when it has none to give. */
export function purchaseTransactionId(grant: Pick<BillingStatus, 'plan' | 'periodEnd'>): string | null {
  if (grant.plan === 'trial' || grant.periodEnd === null) return null;
  const end = Date.parse(grant.periodEnd);
  if (!Number.isSafeInteger(end) || end <= 0) return null;
  return `${grant.plan}.${end}`;
}

/** The purchase-confirmed moment for a confirmed grant, or null when the grant names no purchase. */
export function purchaseMoment(grant: Pick<BillingStatus, 'plan' | 'periodEnd'>, at: number): CelebrationEvent | null {
  const transactionId = purchaseTransactionId(grant);
  if (transactionId === null) return null;
  return { type: 'purchase-confirmed', key: celebrationKey.purchase(transactionId), origin: 'account', at, data: { transactionId } };
}
