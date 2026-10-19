import type { StoreTrialFacts } from '../reminders/trialReminder.ts';

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
  /** SDK price for this billing period, used only for a same-currency comparison. */
  price?: number;
  /** SDK ISO currency code. Never inferred from the localized price string. */
  currencyCode?: string;
  /**
   * How often the store bills it, read from the store's own subscription
   * period and never assumed from an id. A product whose period is not exactly
   * one month or one year is not offered at all.
   */
  period: 'week' | 'month' | 'year';
  /**
   * A yearly product's price per month, as RevenueCat works it out on the
   * device (the yearly price over twelve) and formats it in the store's
   * currency (`pricePerMonthString`), for the plans page's "about ... a
   * month": an approximation, which "about" says. Display only: nothing is
   * bought, granted or metered by it. Null, or absent, when the product is
   * monthly or RevenueCat did not say, and then the page names only the yearly
   * price rather than dividing one itself.
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
  | { available: true; products: readonly StoreProduct[]; yearly?: readonly StoreProduct[]; weekly?: readonly StoreProduct[] };

/**
 * What the store said. `deferred` is StoreKit's Ask to Buy (or any purchase
 * the store holds as pending): nobody has paid yet, so it carries no grant, no
 * trial and no plan. Entitlement still arrives only from the server's verified
 * state, if and when the store later completes the transaction.
 */
export type StoreAction =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; deferred?: true };

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
  /**
   * The store's facts about the configured entitlement (in a free trial,
   * renewing, when it expires), for the trial-ending reminder only. Null when
   * the store could not say. Never a grant: minutes, plan and entitlement are
   * the server's (`storeTrialFacts.ts`).
   */
  trialFacts(userId: string): Promise<StoreTrialFacts | null>;
  /**
   * Whether the store itself holds a Luvani purchase for this account, so a stuck
   * checkout fence can come down when there is nothing to buy twice
   * (`resolvePendingCheckout`). Read only and never a grant: minutes, plan and
   * entitlement are the server's. `sync` asks the store to sync first, which may
   * prompt for an Apple ID, so it is set only when the learner taps. Any doubt,
   * error or account mismatch answers `unknown`, which never clears a fence.
   */
  storeHolds(userId: string, sync: boolean): Promise<'active' | 'none' | 'unknown'>;
  /** Called when the store reports new customer info. Returns the unsubscribe. */
  onStoreChange(listener: () => void): () => void;
}
