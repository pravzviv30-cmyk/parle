import { billingChanged } from './billingChanges.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { billingPairMatches } from './billingReadiness.ts';
import type { Plan } from '@luvani/core';

import { auth, authHeaders } from '../auth/adapter.ts';
import { TOKEN_SERVER } from '../live/serverUrl.ts';
import { billingStatusIn, type BillingStatus } from './billingStatus.ts';

/** The plan ids the server is allowed to answer with. Anything else is a wire fault. */
const PLAN_IDS: readonly string[] = ['trial', 'starter', 'regular'];

/** What the refresh did, as the server reported it. */
export interface BillingRefresh {
  /** True only when verified subscriber state actually granted something. */
  granted: boolean;
  /** The plan standing after the refresh, granted or not. */
  plan: Plan;
}

/**
 * Ask the token server to project verified current subscriber state.
 *
 * `null` means the request failed or the answer could not be read. That is a
 * different event from the server answering plainly that nothing was granted,
 * and keeping them apart is the whole point of this shape: it returned
 * `response.ok`, so a learner who owned nothing produced the same `true` as a
 * learner whose subscription had just been verified, and the paywall told both
 * of them their speaking time was ready (F265).
 *
 * The body is validated rather than trusted. A malformed answer reads as null,
 * because a purchase surface that guesses is the failure this function exists
 * to stop.
 */
export async function refreshBilling(userId: string, owner = scopeGeneration()): Promise<BillingRefresh | null> {
  try {
    if (owner !== scopeGeneration() || (await auth.getSession())?.id !== userId) return null;
    const headers = await authHeaders();
    if (owner !== scopeGeneration() || (await auth.getSession())?.id !== userId) return null;
    const response = await fetch(`${TOKEN_SERVER}/billing/refresh`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (owner !== scopeGeneration() || (await auth.getSession())?.id !== userId) return null;
    if (typeof body !== 'object' || body === null) return null;
    const { refreshed, plan } = body as { refreshed?: unknown; plan?: unknown };
    if (typeof refreshed !== 'boolean') return null;
    if (typeof plan !== 'string' || !PLAN_IDS.includes(plan)) return null;
    billingChanged({ userId, owner });
    return { granted: refreshed, plan: plan as Plan };
  } catch {
    return null;
  }
}

/**
 * What this learner holds right now, or null when the server could not say.
 *
 * The read F377 waited for. It mirrors the start's own request shape, an
 * asserted `userId` in the body beside the bearer, so a local mock account can
 * still see its plan; the server honours the asserted id only under its
 * local-development opt-in and takes the bearer everywhere else. `null` covers
 * a failed request and an unreadable body alike, and the card that draws this
 * says the plan could not be checked rather than guessing one.
 */
export async function fetchBillingStatus(userId: string): Promise<BillingStatus | null> {
  try {
    const response = await fetch(`${TOKEN_SERVER}/billing/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) return null;
    return billingStatusIn(await response.json());
  } catch {
    return null;
  }
}


/** Rechecked before each store operation; cached readiness cannot outlive deploys. */
export async function serverBillingReady(userId: string): Promise<boolean> {
  const owner = scopeGeneration();
  try {
    if ((await auth.getSession())?.id !== userId) return false;
    const headers = await authHeaders();
    if (!headers.authorization || owner !== scopeGeneration() || (await auth.getSession())?.id !== userId) return false;
    const response = await fetch(`${TOKEN_SERVER}/billing/readiness`, {
      method: 'POST', headers, signal: AbortSignal.timeout(5000),
    });
    if (!response.ok || owner !== scopeGeneration() || (await auth.getSession())?.id !== userId) return false;
    const body: unknown = await response.json();
    if (owner !== scopeGeneration() || (await auth.getSession())?.id !== userId) return false;
    return billingPairMatches(body, {
      entitlementId: process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID,
      products: { starter: process.env.EXPO_PUBLIC_REVENUECAT_STARTER_PRODUCT_ID, regular: process.env.EXPO_PUBLIC_REVENUECAT_REGULAR_PRODUCT_ID },
      weeklyStarterProduct: process.env.EXPO_PUBLIC_REVENUECAT_STARTER_WEEKLY_PRODUCT_ID,
      yearly: { starter: process.env.EXPO_PUBLIC_REVENUECAT_STARTER_YEARLY_PRODUCT_ID, regular: process.env.EXPO_PUBLIC_REVENUECAT_REGULAR_YEARLY_PRODUCT_ID },
    });
  } catch { return false; }
}
