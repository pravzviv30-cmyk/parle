/** A local checkout fence, written before the native sheet can accept payment. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userKey, scopeGeneration, setItemInUserScope, writeInUserScope } from '../storage/scope.ts';
import { readOwnedCache } from '../storage/ownedRead.ts';
import type { BillingStatus } from './billingStatus.ts';
import type { PaidPlan } from './contract.ts';

export interface PendingPurchase { plan: PaidPlan; productId: string; before: Pick<BillingStatus, 'plan' | 'periodEnd'> }
interface Envelope { version: 1; purchase: PendingPurchase }
function readable(value: unknown): value is Envelope {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Partial<Envelope>, purchase = row.purchase;
  return row.version === 1 && purchase !== undefined &&
    (purchase.plan === 'starter' || purchase.plan === 'regular') &&
    typeof purchase.productId === 'string' && purchase.productId.length > 0 && purchase.productId.length <= 200 &&
    typeof purchase.before === 'object' && purchase.before !== null &&
    ['trial', 'starter', 'regular'].includes(purchase.before.plan) &&
    (purchase.before.periodEnd === null || (typeof purchase.before.periodEnd === 'string' && Number.isFinite(Date.parse(purchase.before.periodEnd))));
}
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(work: (key: string, owner: number) => Promise<T>): Promise<T> {
  const key = userKey('pendingPurchase'), owner = scopeGeneration();
  const run = () => work(key, owner), next = chain.then(run, run);
  chain = next.catch(() => {}); return next;
}
async function read(key: string): Promise<PendingPurchase | null> {
  return readOwnedCache(await AsyncStorage.getItem(key), readable)?.purchase ?? null;
}
export function loadPendingPurchase(): Promise<PendingPurchase | null> { return read(userKey('pendingPurchase')); }
/** An existing or unread record cannot be replaced by another checkout. */
export function beginPendingPurchase(purchase: PendingPurchase): Promise<boolean> {
  return serial(async (key, owner) => {
    if (!readable({ version: 1, purchase })) return false;
    if (await read(key) !== null) return false;
    await setItemInUserScope(owner, key, JSON.stringify({ version: 1, purchase }));
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


/** Existing same-tier access alone does not prove an interrupted checkout settled. */
export function confirmsPendingPurchase(purchase: PendingPurchase, status: BillingStatus | null): boolean {
  if (status === null || status.lapsed || status.plan !== purchase.plan || status.periodEnd === null) return false;
  if (purchase.before.plan !== purchase.plan) return true;
  if (purchase.before.periodEnd === null) return false;
  return Date.parse(status.periodEnd) > Date.parse(purchase.before.periodEnd);
}
