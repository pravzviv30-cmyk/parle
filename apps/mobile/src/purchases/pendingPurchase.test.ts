import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearActiveUserData, setActiveUser } from '../storage/scope.ts';
import { beginPendingPurchase, clearPendingPurchase, confirmsPendingPurchase, loadPendingPurchase } from './pendingPurchase.ts';
const checkout = { plan: 'regular', productId: 'monthly', before: { plan: 'trial', periodEnd: null } } as const;
let disk: Map<string, string>, uid = 0;
beforeEach(() => {
  disk = new Map(); setActiveUser(`pending-${++uid}`);
  AsyncStorage.getItem = async key => disk.get(key) ?? null;
  AsyncStorage.setItem = async (key, value) => { disk.set(key, value); };
  AsyncStorage.removeItem = async key => { disk.delete(key); };
  AsyncStorage.multiRemove = async keys => { keys.forEach(key => disk.delete(key)); };
});
test('a checkout fence survives a fresh read and refuses a second checkout for the same account', async () => {
  assert.equal(await loadPendingPurchase(), null);
  assert.equal(await beginPendingPurchase(checkout), true);
  assert.deepEqual(await loadPendingPurchase(), checkout);
  assert.equal(await beginPendingPurchase({ ...checkout, plan: 'starter', productId: 'other' }), false);
  assert.equal(await clearPendingPurchase({ ...checkout, plan: 'starter', productId: 'other' }), false);
  assert.deepEqual(await loadPendingPurchase(), checkout);
  assert.equal(await clearPendingPurchase(checkout), true);
  assert.equal(await loadPendingPurchase(), null);
});
test('unread checkout data stays unknown and native write refusal cannot open checkout', async () => {
  const key = `luvani.u.pending-${uid}.pendingPurchase`;
  disk.set(key, '{bad'); await assert.rejects(loadPendingPurchase());
  await assert.rejects(beginPendingPurchase(checkout)); assert.equal(disk.get(key), '{bad');
  disk.delete(key); AsyncStorage.setItem = async () => { throw new Error('full'); };
  await assert.rejects(beginPendingPurchase(checkout));
});
test('a dispatched checkout fence drains before account deletion and never reaches the next account', async () => {
  let release!: () => void, entered!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  AsyncStorage.setItem = async (key, value) => { entered(); await held; disk.set(key, value); };
  const saving = beginPendingPurchase(checkout); await started;
  const reset = clearActiveUserData({ sweepAudio: () => ({ removed: 0, failed: 0 }) });
  release(); await saving.catch(() => {}); await reset;
  assert.equal(disk.size, 0);
  setActiveUser('next-account'); assert.equal(await loadPendingPurchase(), null);
});


test('an unchanged same-tier subscription cannot clear an interrupted checkout fence', () => {
  const before = { plan: 'regular', periodEnd: '2026-11-01T00:00:00Z' } as const;
  const pending = { ...checkout, before };
  const status = { plan: 'regular', periodEnd: before.periodEnd, secondsRemaining: 100, lapsed: false, canStart: true, reason: null } as const;
  assert.equal(confirmsPendingPurchase(pending, status), false);
  assert.equal(confirmsPendingPurchase(pending, { ...status, secondsRemaining: 18000 }), false);
  assert.equal(confirmsPendingPurchase(pending, { ...status, periodEnd: '2026-10-01T00:00:00Z' }), false);
  assert.equal(confirmsPendingPurchase(pending, { ...status, periodEnd: '2026-12-01T00:00:00Z' }), true);
  assert.equal(confirmsPendingPurchase(pending, { ...status, lapsed: true, periodEnd: '2026-12-01T00:00:00Z' }), false);
  assert.equal(confirmsPendingPurchase(checkout, status), true);
});
