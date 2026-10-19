import type { StoreAction } from './contract.ts';

/**
 * RevenueCat's PAYMENT_PENDING_ERROR, as react-native-purchases 10.8.1 defines
 * it (@revenuecat/purchases-typescript-internal dist/generated/error-codes.d.ts).
 * `purchasePackage` rejects with it, `userCancelled` false, when StoreKit defers
 * a transaction for Ask to Buy or the store otherwise holds it as pending.
 * Written as the literal so this stays importable without the native SDK.
 */
export const PAYMENT_PENDING_ERROR = '20';

/** A store rejection, read as the outcome the wall can word. */
export function storeActionFromError(error: unknown): StoreAction {
  if (typeof error !== 'object' || error === null) return { ok: false, cancelled: false };
  if ('userCancelled' in error && error.userCancelled === true) return { ok: false, cancelled: true };
  if ('code' in error && String(error.code) === PAYMENT_PENDING_ERROR) return { ok: false, cancelled: false, deferred: true };
  return { ok: false, cancelled: false };
}
