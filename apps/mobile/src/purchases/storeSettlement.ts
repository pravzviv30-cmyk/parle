import type { StoreAction } from './adapter.ts';
import type { BillingRefresh } from './client.ts';
import type { RestoreOutcome } from './restore.ts';

/** A store sheet cannot hand its result to an account that arrived afterwards. */
export async function ownedStoreSettlement(
  operation: () => Promise<StoreAction>,
  refresh: () => Promise<BillingRefresh | null>,
  current: () => boolean,
): Promise<RestoreOutcome> {
  if (!current()) return { kind: 'store-trouble' };
  const action = await operation();
  if (!current()) return { kind: 'store-trouble' };
  if (!action.ok) return { kind: action.cancelled ? 'cancelled' : 'store-trouble' };
  const result = await refresh();
  if (!current() || result === null) return { kind: 'refresh-trouble' };
  return result.granted ? { kind: 'done', plan: result.plan } : { kind: 'nothing-granted' };
}
