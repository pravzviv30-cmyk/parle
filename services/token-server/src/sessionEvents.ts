import type { Entitlement } from '@luvani/core';
import type { EntitlementStore } from './store.ts';
import { insertProductEvent, parseProductEvent } from './productEvents.ts';

export interface EventSink { baseUrl: string; serviceRoleKey: string }

/** A service-only forward RPC, with analytics failure isolated from the trial. */
export async function claimTrialWithEvidence(
  store: EntitlementStore, sink: EventSink | null,
  userId: string, installationHash: string, userHash: string,
  allowed: unknown, request: typeof fetch = fetch,
): Promise<boolean> {
  if (!sink) return store.claimTrial(userId, installationHash, userHash);
  const response = await request(`${sink.baseUrl.replace(/\/+$/, '')}/rest/v1/rpc/claim_trial_with_evidence`, {
    method: 'POST',
    headers: { apikey: sink.serviceRoleKey, authorization: `Bearer ${sink.serviceRoleKey}`, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(5_000),
    body: JSON.stringify({ p_user_id: userId, p_installation_hash: installationHash, p_user_hash: userHash, p_analytics_allowed: allowed === true }),
  });
  // During a forward rollout the old worker can run before this RPC exists.
  // Only its exact missing-function code gets the unchanged trial boundary.
  if (!response.ok) {
    const error: unknown = await response.json().catch(() => null);
    if (response.status === 404 && error !== null && typeof error === 'object' && 'code' in error && error.code === 'PGRST202') {
      return store.claimTrial(userId, installationHash, userHash);
    }
    throw new Error(`trial claim failed (${response.status})`);
  }
  return (await response.json()) === true;
}

/** Required metering is independent; optional evidence can fail without changing a refusal. */
export async function recordMinutesRefusal(
  sink: EventSink | null, userId: string, allowed: unknown,
  entitlement: Entitlement, reason: string, request: typeof fetch = fetch,
): Promise<void> {
  if (!sink || allowed !== true) return;
  const event = parseProductEvent({ name: 'minutes_refused', properties: { plan: entitlement.plan, reason } }, 'server');
  if (!event) return;
  try { await insertProductEvent(sink.baseUrl, sink.serviceRoleKey, userId, event, request); }
  catch { /* Best effort, never a condition of use. No learner data in logs. */ }
}
