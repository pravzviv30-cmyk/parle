import type { StoreAction } from './contract.ts';

/**
 * RevenueCat's PAYMENT_PENDING_ERROR, as react-native-purchases 10.8.1 defines
 * it (@revenuecat/purchases-typescript-internal dist/generated/error-codes.d.ts).
 * `purchasePackage` rejects with it, `userCancelled` false, when StoreKit defers
 * a transaction for Ask to Buy or the store otherwise holds it as pending.
 * Written as the literal so this stays importable without the native SDK.
 */
export const PAYMENT_PENDING_ERROR = '20';

/**
 * RevenueCat codes (10.8.1 error-codes.d.ts) that mean the store refused before
 * any transaction began, so nothing can have been charged (F908):
 * PURCHASE_NOT_ALLOWED_ERROR ("3", the device or account may not buy) and
 * PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR ("5", the store would not sell it).
 * Everything else, including network, store problem, receipt and configuration
 * errors, is uncertain and keeps the checkout fence.
 */
export const NOT_STARTED_ERRORS: readonly string[] = ['3', '5'];

/** A store rejection, read as the outcome the wall can word. */
export function storeActionFromError(error: unknown): StoreAction {
  if (typeof error !== 'object' || error === null) return { ok: false, cancelled: false };
  if ('userCancelled' in error && error.userCancelled === true) return { ok: false, cancelled: true };
  if ('code' in error && String(error.code) === PAYMENT_PENDING_ERROR) return { ok: false, cancelled: false, deferred: true };
  if ('code' in error && NOT_STARTED_ERRORS.includes(String(error.code))) return { ok: false, cancelled: false, notStarted: true };
  return { ok: false, cancelled: false };
}
