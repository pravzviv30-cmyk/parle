/** A local checkout fence, written before the native sheet can accept payment. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userKey, scopeGeneration, setItemInUserScope, writeInUserScope } from '../storage/scope.ts';
import { readOwnedCache } from '../storage/ownedRead.ts';
import type { BillingStatus } from './billingStatus.ts';
import type { PaidPlan } from './contract.ts';

/**
 * `startedAt` is when the fence went up (ISO), null for a version 1 record written before it was kept.
 * `deferred` marks a checkout the store is holding for approval (Ask to Buy), so the page says so after a reopen.
 */
export interface PendingPurchase {
  plan: PaidPlan; productId: string; before: Pick<BillingStatus, 'plan' | 'periodEnd'>;
  startedAt?: string | null; deferred?: true;
}
interface Envelope { version: 1 | 2; purchase: PendingPurchase }
const isoTime = (value: unknown): boolean => typeof value === 'string' && Number.isFinite(Date.parse(value));
function readable(value: unknown): value is Envelope {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Partial<Envelope>, purchase = row.purchase;
  if (row.version !== 1 && row.version !== 2) return false;
  return purchase !== undefined && purchase !== null &&
    (purchase.plan === 'starter' || purchase.plan === 'regular') &&
    typeof purchase.productId === 'string' && purchase.productId.length > 0 && purchase.productId.length <= 200 &&
    typeof purchase.before === 'object' && purchase.before !== null &&
    ['trial', 'starter', 'regular'].includes(purchase.before.plan) &&
    (purchase.before.periodEnd === null || isoTime(purchase.before.periodEnd)) &&
    (row.version === 1 ? purchase.startedAt === undefined : purchase.startedAt === null || isoTime(purchase.startedAt)) &&
    (purchase.deferred === undefined || purchase.deferred === true);
}
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(work: (key: string, owner: number) => Promise<T>): Promise<T> {
  const key = userKey('pendingPurchase'), owner = scopeGeneration();
  const run = () => work(key, owner), next = chain.then(run, run);
  chain = next.catch(() => {}); return next;
}
async function read(key: string): Promise<PendingPurchase | null> {
  const row = readOwnedCache(await AsyncStorage.getItem(key), readable);
  if (row === null) return null;
  return row.version === 1 ? { ...row.purchase, startedAt: null } : row.purchase;
}
const envelope = (purchase: PendingPurchase): Envelope => ({ version: 2, purchase });
export function loadPendingPurchase(): Promise<PendingPurchase | null> { return read(userKey('pendingPurchase')); }
/** An existing or unread record cannot be replaced by another checkout. */
export function beginPendingPurchase(purchase: PendingPurchase): Promise<boolean> {
  return serial(async (key, owner) => {
    const { plan, productId, before } = purchase;
    const fresh = envelope({ plan, productId, before, startedAt: new Date().toISOString() });
    if (!readable(fresh)) return false;
    if (await read(key) !== null) return false;
    await setItemInUserScope(owner, key, JSON.stringify(fresh));
    return true;
  });
}
/** Clear only the exact checkout after cancellation or matching verified paid grant. */
export function clearPendingPurchase(expected: PendingPurchase): Promise<boolean> {
  return serial(async (key, owner) => {
    const current = await read(key);
    if (current === null) return true;
    if (current.productId !== expected.productId || current.plan !== expected.plan) return false;
    return writeInUserScope(owner, () => AsyncStorage.removeItem(key));
  });
}
/** Mark the exact checkout as held by the store for approval. The fence itself does not move. */
export function markPendingDeferred(expected: PendingPurchase): Promise<boolean> {
  return serial(async (key, owner) => {
    const current = await read(key);
    if (current === null || current.productId !== expected.productId || current.plan !== expected.plan) return false;
    const marked = envelope({ ...current, startedAt: current.startedAt ?? null, deferred: true });
    if (!readable(marked)) return false;
    await setItemInUserScope(owner, key, JSON.stringify(marked));
    return true;
  });
}

/** Existing same-tier access alone does not prove an interrupted checkout settled. */
export function confirmsPendingPurchase(purchase: PendingPurchase, status: BillingStatus | null): boolean {
  if (status === null || status.lapsed || status.plan !== purchase.plan || status.periodEnd === null) return false;
  if (purchase.before.plan !== purchase.plan) return true;
  if (purchase.before.periodEnd === null) return false;
  return Date.parse(status.periodEnd) > Date.parse(purchase.before.periodEnd);
}

/** What the store itself holds for this account, after `PurchasesAdapter.storeHolds`. Never a grant. */
export type StoreHolding = 'active' | 'none' | 'unknown' | 'storeless';

/**
 * Whether a checkout fence may come down. The fence exists to stop a second store transaction while an accepted one
 * waits for the server, so it clears only when the server confirms, or the store shows there is no purchase to
 * duplicate after the learner taps Start again (never on open). An active store answer always waits (a server grant clears only through `confirmsPendingPurchase`); an unknown store answer never clears.
 */
export function resolvePendingCheckout(purchase: PendingPurchase, store: StoreHolding, server: BillingStatus | null, trigger: 'open' | 'start-again'): 'clear' | 'wait' | 'unknown' {
  if (confirmsPendingPurchase(purchase, server)) return 'clear';
  // F908: no store exists here (web), so no store purchase can stand behind the fence.
  if (store === 'storeless') return 'clear';
  // On open the store was not synced and a pending Ask to Buy also reads as none, so an empty answer only waits.
  if (store === 'none') return trigger === 'start-again' ? 'clear' : 'wait';
  // An existing same-tier subscription also reads as active, so active store access alone never clears.
  if (store === 'active') return 'wait';
  return 'unknown';
}
