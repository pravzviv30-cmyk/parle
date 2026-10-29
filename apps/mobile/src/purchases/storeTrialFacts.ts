/**
 * The store's own facts about the configured entitlement, shaped for the
 * trial-ending reminder (`reminders/trialReminder.ts` `StoreTrialFacts`).
 *
 * Pure on purpose, so a Node test can ask it questions without loading
 * RevenueCat. `adapter.native.ts` hands it `Purchases.getCustomerInfo()`.
 *
 * Display and notification input only. Nothing here grants, extends or
 * changes a plan, minutes or entitlement: the server's projection, settled at
 * token issuance, is the only authority on what a learner may spend. These
 * facts can only take a reminder away or leave it where it is.
 *
 * Unknown is null, never a guess: no entitlement id configured, no record of
 * the entitlement on this customer, or a body that does not read.
 */

import type { StoreTrialFacts } from '../reminders/trialReminder.ts';
import type { StoreHeldPlan } from './contract.ts';

/** The slice of RevenueCat's `CustomerInfo` this reads. */
export interface CustomerInfoLike {
  entitlements?: {
    all?: Record<string, EntitlementLike | undefined>;
    active?: Record<string, EntitlementLike | undefined>;
  };
}

export interface EntitlementLike {
  isActive?: unknown;
  willRenew?: unknown;
  periodType?: unknown;
  expirationDate?: unknown;
  expirationDateMillis?: unknown;
  productIdentifier?: unknown;
  /** Android only: the base plan, which the offering joins to the product as `product:basePlan`. */
  productPlanIdentifier?: unknown;
}

/** RevenueCat's period types. Only TRIAL is a free trial; INTRO is a paid introductory price. */
const KNOWN_PERIODS = ['NORMAL', 'INTRO', 'TRIAL', 'PREPAID'] as const;

function expiryOf(info: EntitlementLike): number | null {
  if (typeof info.expirationDateMillis === 'number' && Number.isFinite(info.expirationDateMillis)) return info.expirationDateMillis;
  if (typeof info.expirationDate === 'string') {
    const at = new Date(info.expirationDate).getTime();
    if (Number.isFinite(at)) return at;
  }
  return null;
}

export function storeTrialFactsFrom(customer: CustomerInfoLike | null | undefined, entitlementId: string | undefined): StoreTrialFacts | null {
  if (!entitlementId || !customer || typeof customer !== 'object') return null;
  const info = customer.entitlements?.active?.[entitlementId] ?? customer.entitlements?.all?.[entitlementId];
  if (!info || typeof info !== 'object') return null;
  const willRenew = typeof info.willRenew === 'boolean' ? info.willRenew : null;
  const expiresAt = expiryOf(info);
  // An entitlement the store still lists but no longer holds active is not in
  // any trial: the trial ended, converted and lapsed, or was refunded.
  if (info.isActive === false) return { inTrial: false, willRenew, expiresAt };
  if (info.isActive !== true) return { inTrial: null, willRenew, expiresAt };
  const period = typeof info.periodType === 'string' ? info.periodType.toUpperCase() : null;
  const inTrial = period !== null && (KNOWN_PERIODS as readonly string[]).includes(period) ? period === 'TRIAL' : null;
  return { inTrial, willRenew, expiresAt };
}

/**
 * The held subscription (F909): the active entitlement's product, with the same
 * renewal facts as above. Null unless the store lists the entitlement as active
 * with a product id, so a lapsed or unread entitlement never gets a date.
 */
export function storeHeldPlanFrom(customer: CustomerInfoLike | null | undefined, entitlementId: string | undefined): StoreHeldPlan | null {
  if (!entitlementId || !customer || typeof customer !== 'object') return null;
  const info = customer.entitlements?.active?.[entitlementId];
  if (!info || typeof info !== 'object' || info.isActive !== true) return null;
  const bare = typeof info.productIdentifier === 'string' ? info.productIdentifier.trim() : '';
  const basePlan = typeof info.productPlanIdentifier === 'string' ? info.productPlanIdentifier.trim() : '';
  // Google Play: the offering's product id is "product:basePlan" (as `storeHolds`
  // reads activeSubscriptions), so the held id is joined the same way. Matching
  // the bare id alone could pick a sibling base plan and its price.
  const productId = bare.length > 0 && basePlan.length > 0 && !bare.includes(':') ? `${bare}:${basePlan}` : bare;
  const facts = storeTrialFactsFrom(customer, entitlementId);
  if (productId.length === 0 || facts === null) return null;
  return { productId, expiresAt: facts.expiresAt, willRenew: facts.willRenew, inTrial: facts.inTrial };
}
