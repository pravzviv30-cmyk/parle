import { timingSafeEqual } from 'node:crypto';

import { PLANS, lapsedEntitlement, type Entitlement } from '@luvani/core';
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
export type SubscriberProjection =
  | { kind: 'active'; entitlement: Entitlement }
  | { kind: 'lapsed'; entitlement: Entitlement }
  | { kind: 'unchanged'; reason: 'not-paid' | 'unknown-product'; entitlement: Entitlement };

/**
 * Project the vendor's current subscriber state, never the webhook event itself.
 * A later period or a changed plan resets usage; a repeat of the same projection
 * preserves it. Unknown products fail closed and are made loud by the caller.
 */
export function projectSubscriber(
  body: RevenueCatSubscriberBody,
  current: Entitlement,
  config: RevenueCatConfiguration,
  now: Date = new Date(),
): SubscriberProjection {
  const vendor = body.subscriber?.entitlements?.[config.entitlementId];
  if (vendor) {
    const productId = typeof vendor.product_identifier === 'string' ? vendor.product_identifier : '';
    const plan = paidPlan(productId, config.products);
    if (plan === null) return { kind: 'unchanged', reason: 'unknown-product', entitlement: current };
    const periodEnd = typeof vendor.expires_date === 'string' ? new Date(vendor.expires_date) : null;
    if (periodEnd && Number.isFinite(periodEnd.getTime()) && periodEnd.getTime() > now.getTime()) {
      // A new PERIOD grants a new allowance. A change of plan inside a period does
      // not, and the difference is money. This read `current.plan === plan && ...`,
      // so any crossgrade reset the counter to zero: on a store that keeps the
      // expiry date through a plan change, moving between the two paid tiers was a
      // fresh allowance every time, as often as the learner cared to switch. The
      // period is the thing that was paid for, so the period is what is compared,
      // and seconds already spent are carried over and clamped to the new cap.
      const newPeriod = current.periodEnd?.getTime() !== periodEnd.getTime();
      return {
        kind: 'active',
        entitlement: {
          plan,
          secondsUsed: newPeriod ? 0 : Math.min(current.secondsUsed, PLANS[plan].secondsPerPeriod),
          periodEnd,
          lapsed: false,
        },
      };
    }
  }

  if (current.plan === 'starter' || current.plan === 'regular') {
    return { kind: 'lapsed', entitlement: lapsedEntitlement() };
  }
  return { kind: 'unchanged', reason: 'not-paid', entitlement: current };
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
  } = {},
): Promise<SubscriberProjection> {
  const [current, body] = await Promise.all([
    store.get(userId),
    fetchSubscriber(userId, config, options.request),
  ]);
  const projection = projectSubscriber(body, current, config, options.now);
  if (projection.kind === 'unchanged') {
    if (projection.reason === 'unknown-product') {
      (options.logger ?? console).error('[luvani] REVENUECAT_UNKNOWN_PRODUCT', { userId });
    }
    return projection;
  }
  await store.save(userId, projection.entitlement);
  return projection;
}
