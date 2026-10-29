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
  // F733 (2026-10-05): paidPackages also reads the yearly ids. None is
  // configured here, so this still asks only about the monthly package.
  const bindings = { scopeGeneration: () => 1, ready: async () => true, configuredFor: 'owner',
    configuredPlans: () => ['regular'], PRODUCT_IDS: { regular: 'monthly' },
    WEEKLY_STARTER_PRODUCT: undefined, configuredYearlyPlans: () => [] as string[], YEARLY_PRODUCT_IDS: {},
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

// F908 (2026-10-29, founder decision 11): a store call that by definition charged
// nothing clears the fence; anything uncertain keeps it.
test('a store call that fails before any purchase clears the checkout fence', async () => {
  const { storeActionFromError } = await import('../purchases/storeError.ts');
  const { ownedStoreSettlement } = await import('../purchases/storeSettlement.ts');
  const { purchases: web } = await import('../purchases/adapter.ts');
  const paywallView = await import('../purchases/paywallView.ts') as Record<string, unknown>;
  // Web can never reach a store, so its purchase is a clean failure.
  assert.deepEqual(await web.purchase('someone', 'monthly'), { ok: false, cancelled: false, notStarted: true });
  assert.equal((web as { storeless?: boolean }).storeless, true);
  // Only the codes that mean no charge could happen; everything else stays uncertain.
  for (const code of ['3', '5']) assert.deepEqual(storeActionFromError({ code, userCancelled: false }), { ok: false, cancelled: false, notStarted: true });
  for (const code of ['0', '2', '4', '8', '10', '23', '35', undefined]) assert.deepEqual(storeActionFromError({ code, userCancelled: false }), { ok: false, cancelled: false }, `code ${code} read as not charged`);
  const outcome = await ownedStoreSettlement(async () => ({ ok: false, cancelled: false, notStarted: true } as never), async () => { throw new Error('must not refresh'); }, () => true);
  assert.deepEqual(outcome, { kind: 'not-charged' });
  // An account change still wins over a clean failure.
  assert.deepEqual(await ownedStoreSettlement(async () => ({ ok: false, cancelled: false, notStarted: true } as never), async () => null, () => false), { kind: 'store-trouble' });
  const line = (paywallView.restoreTrouble as (o: unknown) => string | null)(outcome);
  assert.equal(line, "The purchase didn't go through. Nothing was charged. You can try again.");
  assert.equal(paywallView.PURCHASE_NOT_CHARGED, line);
  // The wall clears its fence and stays on the plans page, with no pending page.
  const a = actions(Promise.resolve({ kind: 'not-charged' }));
  await a.buy();
  assert.equal(a.checkout(), null, 'a clean failure left the checkout fence up');
  assert.deepEqual(a.accepted, []);
  // Uncertain failures keep it.
  for (const kind of ['store-trouble', 'refresh-trouble']) {
    const b = actions(Promise.resolve({ kind })); await b.buy();
    assert.notEqual(b.checkout(), null, `${kind} cleared the fence`);
  }
  // A stale marker on web clears on open and on Start again; native answers are untouched.
  const { resolvePendingCheckout } = await import('../purchases/pendingPurchase.ts');
  const stale = { plan: 'regular' as const, productId: 'monthly', before: { plan: 'trial' as const, periodEnd: null } };
  for (const trigger of ['open', 'start-again'] as const) {
    assert.equal(resolvePendingCheckout(stale as never, 'storeless', null, trigger), 'clear');
    assert.equal(resolvePendingCheckout(stale as never, 'unknown', null, trigger), 'unknown');
    assert.equal(resolvePendingCheckout(stale as never, 'active', null, trigger), 'wait');
  }
  assert.equal(resolvePendingCheckout(stale as never, 'none', null, 'open'), 'wait');
  assert.match(source, /purchases\.storeless === true \? 'storeless' as const : purchases\.storeHolds\(id, false\)/);
  assert.match(source, /purchases\.storeless === true \? 'storeless' as const : await purchases\.storeHolds\(user\.id, true\)/);
});

test('the pending page never says nothing was changed and do not buy again together', async () => {
  const { pendingDetail } = await import('./trialPaywall.ts') as unknown as { pendingDetail?: (message: string | null) => string | null };
  const { PURCHASE_TROUBLE, PURCHASE_AWAITING_APPROVAL, REFRESH_TROUBLE } = await import('../purchases/paywallView.ts');
  assert.equal(typeof pendingDetail, 'function', 'the pending page has no filter for its detail line');
  assert.equal(pendingDetail!(PURCHASE_TROUBLE), null);
  assert.equal(pendingDetail!(PURCHASE_AWAITING_APPROVAL), null);
  assert.equal(pendingDetail!(REFRESH_TROUBLE), REFRESH_TROUBLE);
  assert.equal(pendingDetail!(null), null);
  const page = source.slice(source.indexOf('  if (pendingPurchase !== null) return ('), source.indexOf('  // A missing native store'));
  assert.match(page, /Please do not buy again/);
  assert.match(page, /pendingDetail\(message\)/);
  assert.doesNotMatch(page, /message !== null &&/, 'the pending page prints the raw message');
});

test('the pending page never says nothing was charged while the fence still stands', async () => {
  const { pendingDetail } = await import('./trialPaywall.ts');
  const { PURCHASE_NOT_CHARGED } = await import('../purchases/paywallView.ts') as unknown as { PURCHASE_NOT_CHARGED: string };
  assert.equal(pendingDetail(PURCHASE_NOT_CHARGED), null, 'the pending page printed "Nothing was charged" under "do not buy again"');
});
