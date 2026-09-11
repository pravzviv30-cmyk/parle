import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

import { PAID_PLANS, type PaidPlan, type PurchasesAdapter, type StoreAction, type StoreOffering, type StoreProduct } from './adapter.ts';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
const STARTER_PRODUCT = process.env.EXPO_PUBLIC_REVENUECAT_STARTER_PRODUCT_ID;
const REGULAR_PRODUCT = process.env.EXPO_PUBLIC_REVENUECAT_REGULAR_PRODUCT_ID;

/**
 * The store id for each paid tier, as this build was configured.
 *
 * Read once, at module load, and filtered to the ones actually set. A build that
 * names one product and not the other sells the one it has: that is a
 * misconfiguration rather than an impossibility, and refusing to sell anything
 * would turn a half-finished store setup into a dead purchase path with no sign
 * of why. The server maps both ids too, and F266 is the open item about nobody
 * checking the two configurations against each other.
 */
const PRODUCT_IDS: Readonly<Record<PaidPlan, string | undefined>> = {
  starter: STARTER_PRODUCT,
  regular: REGULAR_PRODUCT,
};

/** The tiers this build knows an id for, cheapest first. */
function configuredPlans(): readonly PaidPlan[] {
  return PAID_PLANS.filter((plan) => (PRODUCT_IDS[plan] ?? '').length > 0);
}

let configuredFor: string | null = null;

function apiKey(): string | null {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  if (Platform.OS === 'ios') return IOS_KEY ?? null;
  if (Platform.OS === 'android') return ANDROID_KEY ?? null;
  return null;
}

async function ready(userId: string): Promise<boolean> {
  const key = apiKey();
  // A key and at least one product. Either alone buys nothing: a key with no
  // product id has nothing to sell, and a product id with no key cannot reach
  // the store to ask about it.
  if (!key || configuredPlans().length === 0) return false;
  if (configuredFor === null) {
    Purchases.configure({ apiKey: key, appUserID: userId });
    configuredFor = userId;
  } else if (configuredFor !== userId) {
    await Purchases.logIn(userId);
    configuredFor = userId;
  }
  return true;
}

/**
 * Every configured tier the store actually has a package for, cheapest first.
 *
 * One call to `getOfferings`, not one per tier: the offering is a single network
 * answer describing everything on sale, and asking twice would be two round
 * trips to learn the same thing, with the second able to disagree with the first.
 */
async function paidPackages(userId: string): Promise<readonly { plan: PaidPlan; found: PurchasesPackage }[]> {
  if (!(await ready(userId))) return [];
  const offering = (await Purchases.getOfferings()).current;
  if (!offering) return [];
  const out: { plan: PaidPlan; found: PurchasesPackage }[] = [];
  for (const plan of configuredPlans()) {
    const id = PRODUCT_IDS[plan];
    const found = offering.availablePackages.find((candidate) => candidate.product.identifier === id);
    if (found) out.push({ plan, found });
  }
  return out;
}

/** The store's own words for one package, or null when it has no usable price. */
function productOf(plan: PaidPlan, found: PurchasesPackage): StoreProduct | null {
  const price = found.product.priceString.trim();
  if (!price) return null;
  return {
    plan,
    productId: found.product.identifier,
    title: found.product.title.trim() || found.product.identifier,
    localizedPrice: price,
  };
}

function actionFrom(error: unknown): StoreAction {
  const cancelled =
    typeof error === 'object' && error !== null && 'userCancelled' in error && error.userCancelled === true;
  return { ok: false, cancelled };
}

export const purchases: PurchasesAdapter = {
  async offering(userId): Promise<StoreOffering> {
    try {
      const products = (await paidPackages(userId))
        .map(({ plan, found }) => productOf(plan, found))
        .filter((product): product is StoreProduct => product !== null);
      // A price is what makes a product purchasable, so a tier the store priced
      // at nothing readable is dropped rather than drawn without one.
      if (products.length === 0) return { available: false };
      return { available: true, products };
    } catch {
      return { available: false };
    }
  },

  async purchase(userId, productId): Promise<StoreAction> {
    try {
      // Only a package this build offered a moment ago. An id from anywhere
      // else buys nothing, which is what keeps the purchase path to the two
      // tiers the store and the server both agree exist.
      const match = (await paidPackages(userId)).find((entry) => entry.found.product.identifier === productId);
      if (!match) return { ok: false, cancelled: false };
      await Purchases.purchasePackage(match.found);
      return { ok: true };
    } catch (error) {
      return actionFrom(error);
    }
  },

  async restore(userId): Promise<StoreAction> {
    try {
      if (!(await ready(userId))) return { ok: false, cancelled: false };
      await Purchases.restorePurchases();
      return { ok: true };
    } catch (error) {
      return actionFrom(error);
    }
  },

  // The sheet belongs to the store, so there is nothing to read back. On a
  // build with no key `ready` is false and this is unavailable, which is the
  // same answer the web half gives and the reason the row is drawn only when
  // an offering arrived.
  async manage(userId): Promise<StoreAction> {
    try {
      if (!(await ready(userId))) return { ok: false, cancelled: false };
      await Purchases.showManageSubscriptions();
      return { ok: true };
    } catch (error) {
      return actionFrom(error);
    }
  },
};
