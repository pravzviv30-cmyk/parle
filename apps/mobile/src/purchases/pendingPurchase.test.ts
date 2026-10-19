import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearActiveUserData, setActiveUser } from '../storage/scope.ts';
import { beginPendingPurchase, clearPendingPurchase, confirmsPendingPurchase, loadPendingPurchase, markPendingDeferred, resolvePendingCheckout } from './pendingPurchase.ts';
import { pendingCheckoutNotice } from '../wall/trialPaywall.ts';
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
  const saved = await loadPendingPurchase();
  assert.ok(saved !== null && typeof saved.startedAt === 'string' && Number.isFinite(Date.parse(saved.startedAt)), 'the fence forgot when it started');
  assert.deepEqual({ ...saved, startedAt: undefined }, { ...checkout, startedAt: undefined });
  assert.equal(await beginPendingPurchase({ ...checkout, plan: 'starter', productId: 'other' }), false);
  assert.equal(await clearPendingPurchase({ ...checkout, plan: 'starter', productId: 'other' }), false);
  assert.deepEqual(await loadPendingPurchase(), saved);
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

const server = (plan: 'trial' | 'starter' | 'regular', periodEnd: string | null, lapsed = false) =>
  ({ plan, periodEnd, secondsRemaining: 100, lapsed, canStart: true, reason: null }) as const;

test('a declined or expired Ask to Buy request can be cleared once the store holds no purchase', async () => {
  assert.equal(await beginPendingPurchase(checkout), true);
  assert.equal(await markPendingDeferred(checkout), true);
  const record = (await loadPendingPurchase())!;
  assert.equal(record.deferred, true);
  // The server still shows the trial and could not be read at all: the store's "none" alone clears.
  assert.equal(resolvePendingCheckout(record, 'none', server('trial', null)), 'clear');
  assert.equal(resolvePendingCheckout(record, 'none', null), 'clear');
  assert.equal(await clearPendingPurchase(record), true);
  assert.equal(await loadPendingPurchase(), null);
  assert.equal(await beginPendingPurchase(checkout), true, 'a cleared fence still blocks buying');
});

test('a stuck checkout never clears while the store shows the purchase as active and the server has not granted it', () => {
  const record = { ...checkout, startedAt: '2026-10-19T00:00:00Z' };
  assert.equal(resolvePendingCheckout(record, 'active', null), 'wait');
  assert.equal(resolvePendingCheckout(record, 'active', server('trial', null)), 'wait');
  assert.equal(resolvePendingCheckout(record, 'active', server('starter', '2026-12-01T00:00:00Z')), 'wait');
  assert.equal(resolvePendingCheckout(record, 'active', server('regular', '2026-12-01T00:00:00Z', true)), 'wait');
  // Store proof plus the server's grant of the same plan clears, even same-tier with no prior period end.
  const sameTier = { ...record, before: { plan: 'regular', periodEnd: null } } as const;
  assert.equal(confirmsPendingPurchase(sameTier, server('regular', '2026-12-01T00:00:00Z')), false);
  assert.equal(resolvePendingCheckout(sameTier, 'active', server('regular', '2026-12-01T00:00:00Z')), 'clear');
});

test('an unknown store answer never clears the checkout', () => {
  const record = { ...checkout, startedAt: null, deferred: true } as const;
  assert.equal(resolvePendingCheckout(record, 'unknown', null), 'unknown');
  assert.equal(resolvePendingCheckout(record, 'unknown', server('trial', null)), 'unknown');
  assert.equal(resolvePendingCheckout(record, 'unknown', server('regular', null)), 'unknown');
  assert.equal(resolvePendingCheckout(record, 'unknown', server('regular', '2026-12-01T00:00:00Z', true)), 'unknown');
  // Only the server's own confirmation clears without the store, as before.
  assert.equal(resolvePendingCheckout(record, 'unknown', server('regular', '2026-12-01T00:00:00Z')), 'clear');
});

test('a version 1 pending record still loads and still fences', async () => {
  const key = `luvani.u.pending-${uid}.pendingPurchase`;
  disk.set(key, JSON.stringify({ version: 1, purchase: checkout }));
  assert.deepEqual(await loadPendingPurchase(), { ...checkout, startedAt: null });
  assert.equal(await beginPendingPurchase({ ...checkout, plan: 'starter', productId: 'other' }), false);
  assert.equal(await markPendingDeferred(checkout), true);
  assert.equal((await loadPendingPurchase())?.deferred, true);
  disk.set(key, JSON.stringify({ version: 1, purchase: { ...checkout, deferred: 'yes' } }));
  await assert.rejects(loadPendingPurchase());
  await assert.rejects(beginPendingPurchase(checkout));
});

test('the waiting for approval notice survives a reopen and a check again', async () => {
  assert.equal(await beginPendingPurchase(checkout), true);
  assert.equal(await markPendingDeferred({ ...checkout, productId: 'other' }), false, 'marked a different checkout');
  assert.equal((await loadPendingPurchase())?.deferred, undefined);
  assert.equal(await markPendingDeferred(checkout), true);
  // A reopen is a fresh read; the title comes from the record, not from screen memory.
  const reopened = (await loadPendingPurchase())!;
  const notice = pendingCheckoutNotice(reopened.deferred === true);
  assert.equal(notice?.title, 'Waiting for approval');
  assert.equal(notice?.body, 'Someone who manages purchases on this account needs to approve it. If it was declined, you can start again.');
  assert.doesNotMatch(`${notice?.title} ${notice?.body}`, /\u2014/);
  assert.equal(pendingCheckoutNotice.length, 1, 'the notice still reads a screen message');
  assert.equal(pendingCheckoutNotice(false), null);
  const screen = readFileSync(new URL('../wall/WallScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /pendingCheckoutNotice\(pendingPurchase\.deferred === true\)/);
});
