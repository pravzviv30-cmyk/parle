import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { wallSuccess } from './wallSuccess.ts';
import { confirmsPendingPurchase } from '../purchases/pendingPurchase.ts';
import { PLANS } from '@luvani/core';

const source = readFileSync(new URL('./WallScreen.tsx', import.meta.url), 'utf8');
const handlers = source.slice(source.indexOf('  const settle = async ('), source.indexOf('  const forward = '));
function actions(outcome: Promise<{ kind: string; plan?: string }> = Promise.resolve({ kind: 'done', plan: 'regular' }), initialPending: { plan: string; productId: string; before: { plan: string; periodEnd: string | null } } | null = null, refuseFence = false, standingPlan = 'trial') {
  const calls: string[] = [], messages: unknown[] = [], pending: boolean[] = [], accepted: boolean[] = [];
  let generation = 1, checkout = initialPending;
  const storeGranted = { current: initialPending !== null }, storeActionInFlight = { current: false };
  const bindings = {
    user: { id: 'owner' }, chosen: { plan: 'regular', productId: 'monthly', name: 'Max', price: '$29' },
    confirmsPendingPurchase, fetchBillingStatus: async () => ({ plan: standingPlan, periodEnd: null, lapsed: false }),
    ownsWall: true, pendingRead: 'ready', busy: false, granted: false, storeGranted, storeActionInFlight,
    scopeGeneration: () => generation, trackProductEvent: () => {}, WALL_READY: 'confirmed',
    restoreTrouble: () => 'unavailable', setMessage: (value: unknown) => messages.push(value),
    setPendingRead: () => {}, setPendingPurchase: (value: typeof checkout) => { checkout = value; },
    beginPendingPurchase: async () => !refuseFence && checkout === null,
    clearPendingPurchase: async () => true,
    setPurchaseAccepted: (value: boolean) => accepted.push(value),
    refreshBilling: async () => { calls.push('check'); return null; },
    setGrantReadPending: (value: boolean) => pending.push(value), setBusy: () => {},
    settleStoreAction: async (_id: string, perform: () => Promise<unknown>) => { await perform(); return outcome; },
    purchases: { purchase: async () => { calls.push('purchase'); } },
    restorePurchases: async () => { calls.push('restore'); return outcome; },
  };
  function render() {
    const props = { ...bindings, pendingPurchase: checkout };
    return new Function(...Object.keys(props), stripTypeScriptTypes(handlers) + '\nreturn { buy, restore, checkAcceptedPurchase };')(...Object.values(props)) as { buy(): Promise<void>; restore(): Promise<void>; checkAcceptedPurchase(): Promise<void> };
  }
  return { buy: () => render().buy(), restore: () => render().restore(), checkAcceptedPurchase: () => render().checkAcceptedPurchase(),
    calls, messages, pending, accepted, checkout: () => checkout, move: () => { generation++; } };
}

test('a confirmed purchase or restore blocks another store action when the separate allowance read is unavailable', async () => {
  for (const initial of ['buy', 'restore'] as const) {
    const a = actions(); await a[initial]();
    assert.deepEqual(a.messages, [null, 'confirmed']);
    assert.deepEqual(a.pending, [true]);
    assert.equal(wallSuccess(null, PLANS), null, 'failed status read must not invent allowance totals');
    await a.buy(); await a.restore();
    assert.deepEqual(a.calls, [initial === 'buy' ? 'purchase' : 'restore']);
  }
  const recovery = source.slice(source.indexOf('\n  if (granted) {\n'), source.indexOf('  // A missing native store'));
  assert.match(recovery, /Back to practice/);
  assert.match(recovery, /Check my allowance again/);
  assert.doesNotMatch(recovery, /onPress=\{forward\}|void buy\(|void restore\(|HeroNumber/);
});

test('in-flight store actions admit one tap and an account change cannot settle their result', async () => {
  let release!: (value: { kind: string; plan?: string }) => void;
  const held = new Promise<{ kind: string; plan?: string }>(resolve => { release = resolve; });
  const a = actions(held), first = a.buy();
  await a.buy(); await a.restore();
  assert.deepEqual(a.calls, ['purchase']);
  a.move(); release({ kind: 'done', plan: 'regular' }); await first;
  assert.deepEqual(a.messages, [null]);
  assert.deepEqual(a.pending, []);
});

test('monthly plan copy is reachable only from a verified monthly native package', async () => {
  const native = readFileSync(new URL('../purchases/adapter.native.ts', import.meta.url), 'utf8');
  const projection = native.slice(native.indexOf('async function paidPackages'), native.indexOf("/** The store's own"));
  const bindings = { scopeGeneration: () => 1, ready: async () => true, configuredFor: 'owner',
    configuredPlans: () => ['regular'], PRODUCT_IDS: { regular: 'monthly' },
    Purchases: { getOfferings: async () => ({ current: { availablePackages: [] as unknown[] } }) },
  };
  const read = new Function(...Object.keys(bindings), stripTypeScriptTypes(projection) + '\nreturn paidPackages;')(...Object.values(bindings)) as (uid: string) => Promise<unknown[]>;
  for (const period of [null, 'P1W', 'P1Y', undefined, 'P1M']) {
    const candidate = { product: { identifier: 'monthly', subscriptionPeriod: period } };
    bindings.Purchases.getOfferings = async () => ({ current: { availablePackages: [candidate] } });
    assert.deepEqual(await read('owner'), period === 'P1M' ? [{ plan: 'regular', found: candidate }] : []);
  }
  assert.match(native.slice(native.indexOf('async purchase(')), /await paidPackages\(userId\)/);
});


test('an accepted store purchase with a delayed or failed grant can only recheck the server, never buy twice', async () => {
  for (const kind of ['refresh-trouble', 'nothing-granted']) {
    const a = actions(Promise.resolve({ kind }));
    await a.buy(); assert.deepEqual(a.accepted, [true]);
    await a.buy(); await a.restore(); assert.deepEqual(a.calls, ['purchase']);
    await a.checkAcceptedPurchase(); assert.deepEqual(a.calls, ['purchase', 'check']);
    assert.match(String(a.messages.at(-1)), /waiting for its matching paid plan/);
    await a.buy(); assert.deepEqual(a.calls, ['purchase', 'check']);
  }
  const recovery = source.slice(source.indexOf('  if (pendingPurchase !== null) return ('), source.indexOf('  // A missing native store'));
  assert.match(recovery, /Please do not buy again/);
  assert.match(recovery, /checkAcceptedPurchase/);
  assert.doesNotMatch(recovery, /buy\(|restore\(|HeroNumber/);
});


test('reopening with a persisted checkout or an unread fence cannot open a second purchase', async () => {
  const reopened = actions(undefined, { plan: 'regular', productId: 'monthly', before: { plan: 'trial', periodEnd: null } });
  await reopened.buy(); await reopened.checkAcceptedPurchase();
  assert.deepEqual(reopened.calls, ['check']);
  const failedWrite = actions(undefined, null, true); await failedWrite.buy();
  assert.deepEqual(failedWrite.calls, []);
  assert.match(source, /if \(pendingRead !== 'ready'\) return/);
});

test('a trial or different paid tier cannot clear a checkout for the selected plan', async () => {
  for (const plan of ['trial', 'starter', 'regular']) {
    const a = actions(Promise.resolve({ kind: 'done', plan })); await a.buy();
    assert.equal(a.checkout() === null, plan === 'regular');
    assert.equal(a.messages.at(-1) === 'confirmed', plan === 'regular');
  }
});


test('a currently active matching plan is checked before checkout and cannot open another store sheet', async () => {
  const a = actions(undefined, null, false, 'regular'); await a.buy();
  assert.deepEqual(a.calls, []); assert.equal(a.checkout(), null);
  assert.match(String(a.messages.at(-1)), /already have this plan/);
});
