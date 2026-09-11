/**
 * A tier somebody can actually buy.
 *
 * The trial is not one of these and never appears here. It is granted by the
 * server on a first session and cannot be purchased, so a type that admitted it
 * would let a purchase event report the free tier as a sale.
 */
export type PaidPlan = 'starter' | 'regular';

/**
 * The paid tiers, cheapest first.
 *
 * The order is the offer, so it is written down once rather than sorted at each
 * call site. It cannot be derived from `localizedPrice`, which is a formatted
 * string in the store's own currency and is not a number, and deriving it from
 * the allowance would make the display order depend on a value this layer has
 * no business reading.
 */
export const PAID_PLANS: readonly PaidPlan[] = ['starter', 'regular'];

export interface StoreProduct {
  plan: PaidPlan;
  productId: string;
  title: string;
  localizedPrice: string;
}

/**
 * What the store is offering, as a list rather than a single product.
 *
 * This carried one product, and `plan` was the literal `'starter'`, so the
 * second tier the server has always known about had no way to be bought from
 * the app at all. A list also makes the partial answer expressible: a store
 * that knows one of the two products is a real state on a misconfigured
 * account, and it should sell the one it has rather than nothing.
 */
export type StoreOffering =
  | { available: false }
  | { available: true; products: readonly StoreProduct[] };

export type StoreAction =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false };

export interface PurchasesAdapter {
  offering(userId: string): Promise<StoreOffering>;
  purchase(userId: string, productId: string): Promise<StoreAction>;
  restore(userId: string): Promise<StoreAction>;
  /**
   * Hand the learner to the store's own subscription sheet.
   *
   * Apple asks any app selling an auto renewing subscription for a way out of
   * it (Guideline 3.1.1), and the way out is theirs, not ours: cancelling,
   * changing tier and billing all belong to the account, not to this app. So
   * this opens a sheet and answers whether it opened, and nothing here reads
   * or reports subscription state.
   */
  manage(userId: string): Promise<StoreAction>;
}

/** Web and Expo's node tests have no native store. Metro selects adapter.native on devices. */
export const purchases: PurchasesAdapter = {
  async offering() {
    return { available: false };
  },
  async purchase() {
    return { ok: false, cancelled: false };
  },
  async restore() {
    return { ok: false, cancelled: false };
  },
  async manage() {
    return { ok: false, cancelled: false };
  },
};
