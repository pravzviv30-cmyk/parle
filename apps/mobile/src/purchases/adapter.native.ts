import { scopeGeneration } from '../storage/scope.ts';
import { serverBillingReady } from './client.ts';
import { auth } from '../auth/adapter.ts';
import { storeQueue } from './storeQueue.ts';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

import { PAID_PLANS, type PaidPlan, type PurchasesAdapter, type StoreAction, type StoreIntroOffer, type StoreOffering, type StoreProduct } from './contract.ts';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
const STARTER_PRODUCT = process.env.EXPO_PUBLIC_REVENUECAT_STARTER_PRODUCT_ID;
const REGULAR_PRODUCT = process.env.EXPO_PUBLIC_REVENUECAT_REGULAR_PRODUCT_ID;
const STARTER_YEARLY_PRODUCT = process.env.EXPO_PUBLIC_REVENUECAT_STARTER_YEARLY_PRODUCT_ID;
const REGULAR_YEARLY_PRODUCT = process.env.EXPO_PUBLIC_REVENUECAT_REGULAR_YEARLY_PRODUCT_ID;

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

/**
 * The yearly store id for each tier (D16), each optional on its own. A tier
 * with none is simply not sold yearly. The server must name the same id at
 * readiness, or nothing is sold at all (`billingReadiness.ts`).
 */
const YEARLY_PRODUCT_IDS: Readonly<Record<PaidPlan, string | undefined>> = {
  starter: STARTER_YEARLY_PRODUCT,
  regular: REGULAR_YEARLY_PRODUCT,
};

/** The tiers this build knows an id for, cheapest first. */
function configuredPlans(): readonly PaidPlan[] {
  return PAID_PLANS.filter((plan) => (PRODUCT_IDS[plan] ?? '').length > 0);
}

/** The tiers this build sells yearly, cheapest first. */
function configuredYearlyPlans(): readonly PaidPlan[] {
  return PAID_PLANS.filter((plan) => (YEARLY_PRODUCT_IDS[plan] ?? '').length > 0);
}

let configuredFor: string | null = null;
const serial = storeQueue();

function apiKey(): string | null {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  if (Platform.OS === 'ios') return IOS_KEY ?? null;
  if (Platform.OS === 'android') return ANDROID_KEY ?? null;
  return null;
}

async function ready(userId: string): Promise<boolean> {
  const owner = scopeGeneration();
  const key = apiKey();
  // A key and at least one product. Either alone buys nothing: a key with no
  // product id has nothing to sell, and a product id with no key cannot reach
  // the store to ask about it.
  if (!key || configuredPlans().length === 0) return false;
  if ((await auth.getSession())?.id !== userId || owner !== scopeGeneration()) return false;
  if (configuredFor === null) {
    Purchases.configure({ apiKey: key, appUserID: userId });
    configuredFor = userId;
  } else if (configuredFor !== userId) {
    await Purchases.logIn(userId);
    configuredFor = userId;
  }
  const available = await serverBillingReady(userId);
  return available && owner === scopeGeneration() && configuredFor === userId;
}

/**
 * Every configured tier the store actually has a package for, cheapest first.
 *
 * One call to `getOfferings`, not one per tier: the offering is a single network
 * answer describing everything on sale, and asking twice would be two round
 * trips to learn the same thing, with the second able to disagree with the first.
 */
async function paidPackages(userId: string): Promise<readonly { plan: PaidPlan; found: PurchasesPackage }[]> {
  const owner = scopeGeneration();
  if (!(await ready(userId))) return [];
  const offering = (await Purchases.getOfferings()).current;
  if (owner !== scopeGeneration() || configuredFor !== userId) return [];
  if (!offering) return [];
  const out: { plan: PaidPlan; found: PurchasesPackage }[] = [];
  for (const plan of configuredPlans()) {
    const id = PRODUCT_IDS[plan];
    const found = offering.availablePackages.find((candidate) => candidate.product.identifier === id);
    // Approved plan copy is monthly. Unknown or incompatible periods are not
    // offered or bought, even when a configured identifier matches.
    if (found?.product.subscriptionPeriod === 'P1M') out.push({ plan, found });
  }
  // A yearly id sells a one-year period and nothing else, by the same rule.
  for (const plan of configuredYearlyPlans()) {
    const id = YEARLY_PRODUCT_IDS[plan];
    const found = offering.availablePackages.find((candidate) => candidate.product.identifier === id);
    if (found?.product.subscriptionPeriod === 'P1Y') out.push({ plan, found });
  }
  return out;
}

/** The store's own words for one package, or null when it has no usable price. */
function productOf(plan: PaidPlan, found: PurchasesPackage, eligible: ReadonlySet<string>): StoreProduct | null {
  const price = found.product.priceString.trim();
  if (!price) return null;
  const intro = freeTrialOf(found);
  return {
    plan,
    productId: found.product.identifier,
    title: found.product.title.trim() || found.product.identifier,
    localizedPrice: price,
    period: found.product.subscriptionPeriod === 'P1Y' ? 'year' : 'month',
    localizedPricePerMonth: found.product.subscriptionPeriod === 'P1Y' ? found.product.pricePerMonthString?.trim() || null : null,
    intro,
    introEligible: intro !== null && eligible.has(found.product.identifier),
  };
}

const INTRO_UNITS: readonly StoreIntroOffer['periodUnit'][] = ['DAY', 'WEEK', 'MONTH', 'YEAR'];

/**
 * The store's free trial on a package, or null.
 *
 * Only a free offer: a paid introductory price is a discount, and calling it a
 * trial would be the app inventing a promise. Every field must be one the store
 * actually filled in; a half-described offer reads as none.
 */
function freeTrialOf(found: PurchasesPackage): StoreIntroOffer | null {
  const offer = found.product.introPrice;
  if (!offer || offer.price !== 0) return null;
  const unit = INTRO_UNITS.find((candidate) => candidate === offer.periodUnit);
  const priceString = offer.priceString.trim();
  if (!unit || !priceString || !Number.isInteger(offer.periodNumberOfUnits) || offer.periodNumberOfUnits < 1
    || !Number.isInteger(offer.cycles) || offer.cycles < 1) return null;
  return { priceString, periodUnit: unit, periodNumberOfUnits: offer.periodNumberOfUnits, cycles: offer.cycles };
}

/**
 * The products this account may still take a free trial on, by the store's
 * own answer. iOS answers; Android and any failure answer nothing, and nothing
 * here guesses yes: an unknown status shows the plain price.
 */
async function introEligibleIds(packages: readonly { found: PurchasesPackage }[]): Promise<ReadonlySet<string>> {
  const ids = packages.filter(({ found }) => freeTrialOf(found) !== null).map(({ found }) => found.product.identifier);
  if (ids.length === 0) return new Set();
  try {
    const answers = await Purchases.checkTrialOrIntroductoryPriceEligibility(ids);
    return new Set(ids.filter((id) => answers[id]?.status === Purchases.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE));
  } catch {
    return new Set();
  }
}

function actionFrom(error: unknown): StoreAction {
  const cancelled =
    typeof error === 'object' && error !== null && 'userCancelled' in error && error.userCancelled === true;
  return { ok: false, cancelled };
}

export const purchases: PurchasesAdapter = {
  async offering(userId): Promise<StoreOffering> {
    return serial(async () => {
    try {
      const owner = scopeGeneration();
      const packages = await paidPackages(userId);
      const eligible = await introEligibleIds(packages);
      if (owner !== scopeGeneration() || configuredFor !== userId) return { available: false };
      const priced = packages
        .map(({ plan, found }) => productOf(plan, found, eligible))
        .filter((product): product is StoreProduct => product !== null);
      // A price is what makes a product purchasable, so a tier the store priced
      // at nothing readable is dropped rather than drawn without one. Yearly
      // products travel apart (contract.ts), so a monthly screen never draws one.
      const products = priced.filter((product) => product.period === 'month');
      const yearly = priced.filter((product) => product.period === 'year');
      if (products.length === 0) return { available: false };
      return { available: true, products, yearly };
    } catch {
      return { available: false };
    }
    });
  },

  async purchase(userId, productId): Promise<StoreAction> {
    const owner = scopeGeneration();
    return serial(async () => {
    try {
      // Only a package this build offered a moment ago. An id from anywhere
      // else buys nothing, which is what keeps the purchase path to the two
      // tiers the store and the server both agree exist.
      const match = (await paidPackages(userId)).find((entry) => entry.found.product.identifier === productId);
      if (!match || configuredFor !== userId || owner !== scopeGeneration()) return { ok: false, cancelled: false };
      await Purchases.purchasePackage(match.found);
      if (configuredFor !== userId || owner !== scopeGeneration()) return { ok: false, cancelled: false };
      return { ok: true };
    } catch (error) {
      return actionFrom(error);
    }
    });
  },

  async restore(userId): Promise<StoreAction> {
    const owner = scopeGeneration();
    return serial(async () => {
    try {
      if (!(await ready(userId))) return { ok: false, cancelled: false };
      if (configuredFor !== userId || owner !== scopeGeneration()) return { ok: false, cancelled: false };
      await Purchases.restorePurchases();
      if (configuredFor !== userId || owner !== scopeGeneration()) return { ok: false, cancelled: false };
      return { ok: true };
    } catch (error) {
      return actionFrom(error);
    }
    });
  },

  // The sheet belongs to the store, so there is nothing to read back. On a
  // build with no key `ready` is false and this is unavailable, which is the
  // same answer the web half gives and the reason the row is drawn only when
  // an offering arrived.
  async manage(userId): Promise<StoreAction> {
    const owner = scopeGeneration();
    return serial(async () => {
    try {
      if (!(await ready(userId))) return { ok: false, cancelled: false };
      if (configuredFor !== userId || owner !== scopeGeneration()) return { ok: false, cancelled: false };
      await Purchases.showManageSubscriptions();
      if (configuredFor !== userId || owner !== scopeGeneration()) return { ok: false, cancelled: false };
      return { ok: true };
    } catch (error) {
      return actionFrom(error);
    }
    });
  },
};
