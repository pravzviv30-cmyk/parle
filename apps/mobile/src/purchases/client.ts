import type { Plan } from '@luvani/core';

import { authHeaders } from '../auth/adapter.ts';
import { TOKEN_SERVER } from '../live/serverUrl.ts';

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
export async function refreshBilling(): Promise<BillingRefresh | null> {
  try {
    const response = await fetch(`${TOKEN_SERVER}/billing/refresh`, {
      method: 'POST',
      headers: await authHeaders(),
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null) return null;
    const { refreshed, plan } = body as { refreshed?: unknown; plan?: unknown };
    if (typeof refreshed !== 'boolean') return null;
    if (typeof plan !== 'string' || !PLAN_IDS.includes(plan)) return null;
    return { granted: refreshed, plan: plan as Plan };
  } catch {
    return null;
  }
}
