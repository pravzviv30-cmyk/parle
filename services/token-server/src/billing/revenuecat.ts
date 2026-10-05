import { applyBillingSnapshot, type BillingSnapshot, type BillingProjection } from './state.ts';
import { timingSafeEqual } from 'node:crypto';

import { LAPSE_GRACE_SEC, PLANS, allowanceWindowEnd, storeTrialSeconds, type BillingPeriod, type Entitlement, type PaidTier } from '@luvani/core';
import type { EntitlementStore } from '../store.ts';

export interface RevenueCatConfiguration {
  secretApiKey: string;
  webhookSecret: string;
  entitlementId: string;
  /** The monthly product id for each tier. Both are required to sell anything. */
  products: Readonly<Record<'starter' | 'regular', string>>;
  /**
   * The yearly product id for each tier, when the founder sells one (D16).
   * A tier missing here is simply not sold yearly, and a yearly purchase of it
   * is refused as an unknown product, exactly as any other unknown id is.
   */
  yearlyProducts?: Readonly<Partial<Record<'starter' | 'regular', string>>>;
}

/** What reading a subscriber needs. The maintenance worker never holds the webhook secret. */
export type RevenueCatReadConfiguration = Pick<RevenueCatConfiguration, 'secretApiKey' | 'entitlementId' | 'products' | 'yearlyProducts'>;

export interface BillingEnvironment {
  REVENUECAT_SECRET_API_KEY?: string;
  LUVANI_REVENUECAT_WEBHOOK_SECRET?: string;
  REVENUECAT_ENTITLEMENT_ID?: string;
  REVENUECAT_STARTER_PRODUCT_ID?: string;
  REVENUECAT_REGULAR_PRODUCT_ID?: string;
  REVENUECAT_STARTER_YEARLY_PRODUCT_ID?: string;
  REVENUECAT_REGULAR_YEARLY_PRODUCT_ID?: string;
}

const BILLING_KEYS = [
  'REVENUECAT_SECRET_API_KEY',
  'LUVANI_REVENUECAT_WEBHOOK_SECRET',
  'REVENUECAT_ENTITLEMENT_ID',
  'REVENUECAT_STARTER_PRODUCT_ID',
  'REVENUECAT_REGULAR_PRODUCT_ID',
] as const;

/** Optional, each on its own: absent means that tier is not sold yearly. */
const YEARLY_KEYS = ['REVENUECAT_STARTER_YEARLY_PRODUCT_ID', 'REVENUECAT_REGULAR_YEARLY_PRODUCT_ID'] as const;

/** What the maintenance worker needs to re-read a subscriber, without the webhook secret. */
const READ_KEYS = [
  'REVENUECAT_SECRET_API_KEY',
  'REVENUECAT_ENTITLEMENT_ID',
  'REVENUECAT_STARTER_PRODUCT_ID',
  'REVENUECAT_REGULAR_PRODUCT_ID',
] as const;

function yearlyFrom(env: BillingEnvironment): Partial<Record<'starter' | 'regular', string>> {
  return {
    ...(env.REVENUECAT_STARTER_YEARLY_PRODUCT_ID ? { starter: env.REVENUECAT_STARTER_YEARLY_PRODUCT_ID } : {}),
    ...(env.REVENUECAT_REGULAR_YEARLY_PRODUCT_ID ? { regular: env.REVENUECAT_REGULAR_YEARLY_PRODUCT_ID } : {}),
  };
}

/**
 * Every configured product id names exactly one tier and one period.
 *
 * A yearly id equal to a monthly one would make the same purchase both a
 * month and a year, and which allowance it granted would depend on the order
 * of an if. Refused at startup rather than decided at a learner's expense.
 */
function distinctProducts(config: RevenueCatReadConfiguration): RevenueCatReadConfiguration {
  const ids = [config.products.starter, config.products.regular, ...Object.values(config.yearlyProducts ?? {})];
  if (new Set(ids).size !== ids.length) throw new Error('ambiguous RevenueCat product configuration');
  return config;
}

/** No keys means the purchase path is deliberately dark; a partial set is unsafe. */
export function revenueCatConfiguration(env: BillingEnvironment): RevenueCatConfiguration | null {
  const present = BILLING_KEYS.filter((key) => Boolean(env[key]));
  const yearly = YEARLY_KEYS.filter((key) => Boolean(env[key]));
  if (present.length === 0 && yearly.length === 0) return null;
  if (present.length !== BILLING_KEYS.length) {
    throw new Error('incomplete RevenueCat billing configuration');
  }
  const config: RevenueCatConfiguration = {
    secretApiKey: env.REVENUECAT_SECRET_API_KEY!,
    webhookSecret: env.LUVANI_REVENUECAT_WEBHOOK_SECRET!,
    entitlementId: env.REVENUECAT_ENTITLEMENT_ID!,
    products: {
      starter: env.REVENUECAT_STARTER_PRODUCT_ID!,
      regular: env.REVENUECAT_REGULAR_PRODUCT_ID!,
    },
    yearlyProducts: yearlyFrom(env),
  };
  distinctProducts(config);
  return config;
}

/**
 * The subscriber-reading half of the configuration, for the maintenance worker.
 *
 * The secret key alone is what that worker has always held, for privacy
 * erasure, and it still means no renewal sweep: null. The entitlement and
 * product ids beside it turn the sweep on, all of them or none.
 */
export function revenueCatReadConfiguration(env: BillingEnvironment): RevenueCatReadConfiguration | null {
  const mapping = READ_KEYS.slice(1).filter((key) => Boolean(env[key]));
  const yearly = YEARLY_KEYS.filter((key) => Boolean(env[key]));
  if (mapping.length === 0 && yearly.length === 0) return null;
  if (READ_KEYS.some((key) => !env[key])) throw new Error('incomplete RevenueCat billing configuration');
  return distinctProducts({
    secretApiKey: env.REVENUECAT_SECRET_API_KEY!,
    entitlementId: env.REVENUECAT_ENTITLEMENT_ID!,
    products: { starter: env.REVENUECAT_STARTER_PRODUCT_ID!, regular: env.REVENUECAT_REGULAR_PRODUCT_ID! },
    yearlyProducts: yearlyFrom(env),
  });
}

/** Compare the complete configured header without leaking the matching prefix. */
export function webhookAuthorised(value: string | undefined, secret: string): boolean {
  if (!value) return false;
  const actual = Buffer.from(value);
  const expected = Buffer.from(secret);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

interface RevenueCatEntitlement {
  expires_date?: unknown;
  product_identifier?: unknown;
  purchase_date?: unknown;
}

interface RevenueCatSubscription {
  period_type?: unknown;
  purchase_date?: unknown;
}

interface RevenueCatSubscriberBody {
  subscriber?: {
    entitlements?: Record<string, RevenueCatEntitlement>;
    subscriptions?: Record<string, RevenueCatSubscription>;
  };
}

/** The tier and the period a configured product id sells, or null for an id we never configured. */
function soldProduct(productId: string, config: RevenueCatReadConfiguration): { plan: PaidTier; period: BillingPeriod } | null {
  if (productId === config.products.starter) return { plan: 'starter', period: 'month' };
  if (productId === config.products.regular) return { plan: 'regular', period: 'month' };
  if (config.yearlyProducts?.starter && productId === config.yearlyProducts.starter) return { plan: 'starter', period: 'year' };
  if (config.yearlyProducts?.regular && productId === config.yearlyProducts.regular) return { plan: 'regular', period: 'year' };
  return null;
}

/**
 * The store's word for the current period: a free trial, or a paid one.
 *
 * RevenueCat's subscriber record says so per product as `period_type`, and the
 * webhook says it in capitals, so case is folded. `normal` and `intro` (a paid
 * introductory price) and `prepaid` are periods somebody paid for. Anything
 * else, or nothing at all, is a purchase this server cannot classify, and it is
 * refused like an unknown product rather than guessed: guessing paid hands a
 * trialist the month, and guessing trial shorts a payer.
 */
function periodKind(subscription: RevenueCatSubscription | undefined): 'trial' | 'paid' | null {
  const type = typeof subscription?.period_type === 'string' ? subscription.period_type.toLowerCase() : null;
  if (type === 'trial') return 'trial';
  if (type === 'normal' || type === 'intro' || type === 'prepaid') return 'paid';
  return null;
}

function instant(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/**
 * Every variant carries the entitlement that stands after the projection.
 *
 * `unchanged` used to carry only a reason, and the refresh endpoint answered
 * `{ refreshed: true }` whatever came back, so a learner who owned nothing was
 * told their speaking time was ready (F265). A caller cannot report what it did
 * from a value that does not say, so the value says.
 */
export type SubscriberProjection = BillingProjection;

/**
 * What the vendor's subscriber record grants right now (D16, 2026-10-05).
 *
 * A store trial grants a week of the plan's allowance until the trial ends. A
 * monthly product grants the plan's allowance until its store period ends. A
 * yearly product grants the same monthly allowance until the end of the
 * current 30-day window inside its paid year, never the year at once; the next
 * window is granted by the next read of the vendor, through the same ticketed
 * projection (the renewal sweep makes that read on time).
 */
function subscriberSnapshot(body: RevenueCatSubscriberBody, config: RevenueCatReadConfiguration, now = new Date()): BillingSnapshot {
  if (!body.subscriber || !body.subscriber.entitlements || typeof body.subscriber.entitlements !== 'object' || Array.isArray(body.subscriber.entitlements)) {
    throw new Error('RevenueCat subscriber entitlements are invalid');
  }
  const vendor = body.subscriber.entitlements[config.entitlementId];
  if (vendor) {
    const product = typeof vendor.product_identifier === 'string' ? vendor.product_identifier : null;
    const sold = product ? soldProduct(product, config) : null;
    if (!product || !sold) return { kind: 'unknown-product' };
    const end = instant(vendor.expires_date);
    if (end && end > now) {
      const subscriptions = body.subscriber.subscriptions;
      const subscription = subscriptions && typeof subscriptions === 'object' && !Array.isArray(subscriptions) && Object.hasOwn(subscriptions, product)
        ? subscriptions[product] : undefined;
      const kind = periodKind(subscription);
      if (kind === null) return { kind: 'unknown-product' };
      if (kind === 'trial') return { kind: 'active', plan: sold.plan, periodEnd: end, grantSeconds: storeTrialSeconds(sold.plan) };
      const allowance = PLANS[sold.plan].secondsPerPeriod;
      if (sold.period === 'month') return { kind: 'active', plan: sold.plan, periodEnd: end, grantSeconds: allowance };
      const start = instant(vendor.purchase_date) ?? instant(subscription?.purchase_date);
      const windowEnd = start ? allowanceWindowEnd(start, end, now) : null;
      if (!windowEnd) return { kind: 'unknown-product' };
      return { kind: 'active', plan: sold.plan, periodEnd: windowEnd, grantSeconds: allowance };
    }
  }
  return { kind: 'inactive' };
}

export function projectSubscriber(body: RevenueCatSubscriberBody, current: Entitlement, config: RevenueCatReadConfiguration, now = new Date()): SubscriberProjection {
  return applyBillingSnapshot(current, subscriberSnapshot(body, config, now));
}

export async function fetchSubscriber(
  userId: string,
  config: Pick<RevenueCatReadConfiguration, 'secretApiKey'>,
  request: typeof fetch = fetch,
): Promise<RevenueCatSubscriberBody> {
  const response = await request(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${config.secretApiKey}`,
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`RevenueCat subscriber fetch failed (${response.status})`);
  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null) throw new Error('RevenueCat subscriber response was not an object');
  return body as RevenueCatSubscriberBody;
}

export async function refreshSubscriber(
  userId: string,
  store: EntitlementStore,
  config: RevenueCatReadConfiguration,
  options: {
    request?: typeof fetch;
    now?: Date;
    logger?: Pick<Console, 'error'>;
    eventId?: string;
  } = {},
): Promise<SubscriberProjection> {
  const ticket = await store.beginBillingRefresh(userId);
  const body = await fetchSubscriber(userId, config, options.request);
  const snapshot = subscriberSnapshot(body, config, options.now);
  const projection = await store.applyBilling(userId, ticket, snapshot, options.eventId);
  if (projection.kind === 'unchanged' && projection.reason === 'unknown-product') {
    (options.logger ?? console).error('[luvani] REVENUECAT_UNKNOWN_PRODUCT', { userId });
  }
  return projection;
}

/** What one renewal check did. */
export type RenewalOutcome = 'renewed' | 'lapsed' | 'waiting';

/**
 * Re-read one subscriber whose period on record has ended, and move the row
 * only in the two directions a read is allowed to.
 *
 * Forward, when the vendor holds a newer paid period or a yearly product's next
 * window: that is a verified receipt doing the renewing, through the same
 * ticketed projection a webhook uses, which is the only way minutes are ever
 * granted. And to a lapse, when the vendor holds nothing and the period on
 * record is already past the twenty-four hours a lazy read would wait anyway.
 * Inside those hours a vendor that holds nothing is left alone, because a
 * renewal that has not landed yet is exactly what the slack is for.
 */
export async function renewSubscriber(
  userId: string,
  periodEnd: Date,
  store: Pick<EntitlementStore, 'beginBillingRefresh' | 'applyBilling'>,
  config: RevenueCatReadConfiguration,
  options: { request?: typeof fetch; now?: Date; logger?: Pick<Console, 'error'> } = {},
): Promise<RenewalOutcome> {
  const now = options.now ?? new Date();
  const ticket = await store.beginBillingRefresh(userId);
  const snapshot = subscriberSnapshot(await fetchSubscriber(userId, config, options.request), config, now);
  if (snapshot.kind === 'unknown-product') {
    (options.logger ?? console).error('[luvani] REVENUECAT_UNKNOWN_PRODUCT', { userId });
    return 'waiting';
  }
  if (snapshot.kind === 'inactive' && now.getTime() <= periodEnd.getTime() + LAPSE_GRACE_SEC * 1000) return 'waiting';
  const projection = await store.applyBilling(userId, ticket, snapshot);
  if (projection.kind === 'active') return 'renewed';
  // A row a read had already lapsed is as finished as one this lapsed. A
  // superseded ticket means a newer read got there first; ask again later.
  if (projection.kind === 'lapsed' || (projection.kind === 'unchanged' && projection.reason === 'not-paid')) return 'lapsed';
  return 'waiting';
}
