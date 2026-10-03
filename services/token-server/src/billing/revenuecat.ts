import { applyBillingSnapshot, type BillingSnapshot, type BillingProjection } from './state.ts';
import { timingSafeEqual } from 'node:crypto';

import { type Entitlement } from '@luvani/core';
import type { EntitlementStore } from '../store.ts';

export interface RevenueCatConfiguration {
  secretApiKey: string;
  webhookSecret: string;
  entitlementId: string;
  products: Readonly<Record<'starter' | 'regular', string>>;
}

export interface BillingEnvironment {
  REVENUECAT_SECRET_API_KEY?: string;
  LUVANI_REVENUECAT_WEBHOOK_SECRET?: string;
  REVENUECAT_ENTITLEMENT_ID?: string;
  REVENUECAT_STARTER_PRODUCT_ID?: string;
  REVENUECAT_REGULAR_PRODUCT_ID?: string;
}

const BILLING_KEYS = [
  'REVENUECAT_SECRET_API_KEY',
  'LUVANI_REVENUECAT_WEBHOOK_SECRET',
  'REVENUECAT_ENTITLEMENT_ID',
  'REVENUECAT_STARTER_PRODUCT_ID',
  'REVENUECAT_REGULAR_PRODUCT_ID',
] as const;

/** No keys means the purchase path is deliberately dark; a partial set is unsafe. */
export function revenueCatConfiguration(env: BillingEnvironment): RevenueCatConfiguration | null {
  const present = BILLING_KEYS.filter((key) => Boolean(env[key]));
  if (present.length === 0) return null;
  if (present.length !== BILLING_KEYS.length) {
    throw new Error('incomplete RevenueCat billing configuration');
  }
  return {
    secretApiKey: env.REVENUECAT_SECRET_API_KEY!,
    webhookSecret: env.LUVANI_REVENUECAT_WEBHOOK_SECRET!,
    entitlementId: env.REVENUECAT_ENTITLEMENT_ID!,
    products: {
      starter: env.REVENUECAT_STARTER_PRODUCT_ID!,
      regular: env.REVENUECAT_REGULAR_PRODUCT_ID!,
    },
  };
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
}

interface RevenueCatSubscriberBody {
  subscriber?: {
    entitlements?: Record<string, RevenueCatEntitlement>;
  };
}

function paidPlan(productId: string, products: RevenueCatConfiguration['products']): 'starter' | 'regular' | null {
  if (productId === products.starter) return 'starter';
  if (productId === products.regular) return 'regular';
  return null;
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

function subscriberSnapshot(body: RevenueCatSubscriberBody, config: RevenueCatConfiguration, now = new Date()): BillingSnapshot {
  if (!body.subscriber || !body.subscriber.entitlements || typeof body.subscriber.entitlements !== 'object' || Array.isArray(body.subscriber.entitlements)) {
    throw new Error('RevenueCat subscriber entitlements are invalid');
  }
  const vendor = body.subscriber.entitlements[config.entitlementId];
  if (vendor) {
    const product = typeof vendor.product_identifier === 'string' ? vendor.product_identifier : null;
    const plan = product ? paidPlan(product, config.products) : null;
    if (!plan) return { kind: 'unknown-product' };
    const end = typeof vendor.expires_date === 'string' ? new Date(vendor.expires_date) : null;
    if (end && Number.isFinite(end.getTime()) && end > now) return { kind: 'active', plan, periodEnd: end };
  }
  return { kind: 'inactive' };
}

export function projectSubscriber(body: RevenueCatSubscriberBody, current: Entitlement, config: RevenueCatConfiguration, now = new Date()): SubscriberProjection {
  return applyBillingSnapshot(current, subscriberSnapshot(body, config, now));
}

export async function fetchSubscriber(
  userId: string,
  config: RevenueCatConfiguration,
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
  config: RevenueCatConfiguration,
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
