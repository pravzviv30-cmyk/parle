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

/**
 * A store free trial, as the store describes it (founder decision D16).
 *
 * Every field is the store's own: the app never computes a trial length or a
 * price. How many minutes the trial holds is the server's answer, not this.
 */
export interface StoreIntroOffer {
  /** The store's formatted price for the offer period, exactly as it wrote it. */
  priceString: string;
  periodUnit: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
  periodNumberOfUnits: number;
  /** How many offer periods the store grants. */
  cycles: number;
}

export interface StoreProduct {
  plan: PaidPlan;
  productId: string;
  title: string;
  localizedPrice: string;
  /**
   * How often the store bills it, read from the store's own subscription
   * period and never assumed from an id. A product whose period is not exactly
   * one month or one year is not offered at all.
   */
  period: 'month' | 'year';
  /**
   * A yearly product's price per month, as the store itself works it out and
   * formats it (`pricePerMonthString`), for the plans page's "about ... a
   * month". Display only: nothing is bought, granted or metered by it. Null, or
   * absent, when the product is monthly or the store did not say, and then the
   * page names only the yearly price rather than dividing one itself.
   */
  localizedPricePerMonth?: string | null;
  /**
   * The store's free trial on this product, or null. A paid introductory price
   * is not a free trial and reads as null, so nothing can call it one.
   */
  intro: StoreIntroOffer | null;
  /**
   * Whether the store says this account can still take that offer. Unknown
   * reads as false, which shows the plain price: the honest answer when the
   * store could not say.
   */
  introEligible: boolean;
}

/**
 * What the store is offering, as a list rather than a single product.
 *
 * This carried one product, and `plan` was the literal `'starter'`, so the
 * second tier the server has always known about had no way to be bought from
 * the app at all. A list also makes the partial answer expressible: a store
 * that knows one of the two products is a real state on a misconfigured
 * account, and it should sell the one it has rather than nothing.
 *
 * `products` holds the monthly products only, which is every price the plans
 * page says "per month" beside. Yearly products (D16) travel apart in `yearly`
 * so no screen built for monthly prices can draw a yearly one as a month;
 * absent or empty means none is on sale. A screen offers one only once it
 * says "a year".
 */
export type StoreOffering =
  | { available: false }
  | { available: true; products: readonly StoreProduct[]; yearly?: readonly StoreProduct[] };

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
