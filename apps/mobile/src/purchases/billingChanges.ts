/** Invalidation only: listeners must read server status, never infer a grant. */
export interface BillingChange { userId: string; owner: number }
const listeners = new Set<(change: BillingChange) => void>();
export function onBillingChange(listener: (change: BillingChange) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function billingChanged(change: BillingChange): void {
  for (const listener of listeners) {
    try { listener(change); } catch { /* A view cannot change the store settlement result. */ }
  }
}
