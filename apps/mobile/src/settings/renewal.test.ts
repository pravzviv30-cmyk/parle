/**
 * F909 (2026-10-29, founder decision 9): a subscriber sees the store's own
 * renewal date and price, and the minutes refresh apart from it. This reverses
 * the earlier no-numbers rule for paid plans on purpose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { BillingStatus } from '../purchases/billingStatus.ts';
import { planStatusFor } from '../purchases/planStatus.ts';
import { previewOffering } from '../wall/preview.ts';

const PREVIEW = { EXPO_PUBLIC_LUVANI_WALL_PREVIEW: 'store', EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT: '1', NODE_ENV: 'development' };
const NOW = new Date(2026, 9, 29, 12).getTime();
const NOV_27 = new Date(2026, 10, 27, 12).getTime();
const NOV_3 = new Date(2026, 10, 3, 12).getTime();

function status(over: Partial<BillingStatus> = {}): BillingStatus {
  return { plan: 'starter', secondsRemaining: 10800, periodEnd: new Date(NOV_27).toISOString(), lapsed: false, canStart: true, reason: null, ...over };
}

type Lines = { full: string; short: string | null } | null;
async function api() {
  const plan = await import('../purchases/planStatus.ts') as Record<string, unknown>;
  const view = await import('./profileView.ts') as Record<string, unknown>;
  assert.equal(typeof plan.renewalLines, 'function', 'there is no renewal line read from the store');
  return {
    renewalLines: plan.renewalLines as (s: BillingStatus | null, o: unknown, h: unknown, p: 'ios' | 'android' | 'web') => Lines,
    subscriptionView: view.subscriptionView as (v: unknown, r?: Lines) => Record<string, unknown>,
    planRow: view.planRow as (v: unknown, r?: Lines) => { label: string; sub: string },
  };
}

test("a subscriber's plan screen shows the renewal date and price from the store", async () => {
  const { renewalLines, subscriptionView, planRow } = await api();
  const offering = previewOffering(PREVIEW);
  const held = { productId: 'luvani_starter_yearly_preview', expiresAt: NOV_27, willRenew: true, inTrial: false };
  const core = status();
  const lines = renewalLines(core, offering, held, 'ios');
  assert.deepEqual(lines, { full: 'Core, yearly, £119.99. Renews on 27 November.', short: 'Renews on 27 November.' });
  assert.equal(renewalLines(core, offering, { ...held, willRenew: false }, 'ios')?.full, 'Core, yearly, £119.99. Ends on 27 November.');
  assert.equal(renewalLines(core, offering, { ...held, expiresAt: NOV_3, inTrial: true }, 'ios')?.full, 'Free until 3 November, then £119.99 a year.');
  // No store answer, a product the store did not offer, or a different tier: a pointer, never a date.
  const pointers = {
    ios: 'Your renewal date is in your App Store subscriptions.',
    android: 'Your renewal date is in your Google Play subscriptions.',
    web: 'Your renewal date is in the App Store or Google Play, wherever you subscribed.',
  } as const;
  for (const platform of ['ios', 'android', 'web'] as const) {
    assert.deepEqual(renewalLines(core, { available: false }, null, platform), { full: pointers[platform], short: null });
    assert.equal(renewalLines(core, offering, { ...held, productId: 'someone_else' }, platform)?.full, pointers[platform]);
    assert.equal(renewalLines(status({ plan: 'regular' }), offering, held, platform)?.full, pointers[platform]);
    assert.equal(renewalLines(core, offering, { ...held, willRenew: null }, platform)?.full, pointers[platform]);
  }
  // Free, lapsed and unread plans have no renewal at all.
  assert.equal(renewalLines(status({ plan: 'trial' }), offering, held, 'ios'), null);
  assert.equal(renewalLines(status({ lapsed: true }), offering, held, 'ios'), null);
  assert.equal(renewalLines(null, offering, held, 'ios'), null);
  // The screen and the Profile row.
  const view = planStatusFor(core, NOW);
  const screen = subscriptionView(view, lines);
  assert.equal(screen.kind, 'paid');
  assert.equal(screen.renewal, 'Core, yearly, £119.99. Renews on 27 November.');
  // F935 (founder decision 21): the paid band says the pool with numbers.
  assert.match(planRow(view, lines).sub, /^\d+ of 300 minutes left\. Renews on 27 November\.$/);
  assert.doesNotMatch(JSON.stringify([screen, planRow(view, lines)]), /coming weeks/);
  // The web preview's held plan is preview-only, gated like the fixture offering.
  const preview = await import('../wall/preview.ts') as Record<string, unknown>;
  const heldFixture = preview.previewHeldPlan as (s: BillingStatus | null, env?: unknown, now?: number) => unknown;
  assert.equal(typeof heldFixture, 'function');
  assert.ok(renewalLines(core, offering, heldFixture(core, PREVIEW, NOW), 'web')?.full.startsWith('Core, yearly, £119.99. Renews on '));
  assert.equal(heldFixture(core, { ...PREVIEW, NODE_ENV: 'production' }, NOW), null);
  assert.equal(heldFixture(core, { NODE_ENV: 'development' }, NOW), null);
  assert.equal(heldFixture(status({ plan: 'trial' }), PREVIEW, NOW), null);
  // The native read reuses storeTrialFacts and takes the product from the entitlement.
  const facts = await import('../purchases/storeTrialFacts.ts') as Record<string, unknown>;
  const heldFrom = facts.storeHeldPlanFrom as (c: unknown, id: string | undefined) => unknown;
  assert.equal(typeof heldFrom, 'function');
  const info = { entitlements: { active: { pro: { isActive: true, willRenew: true, periodType: 'NORMAL', expirationDateMillis: NOV_27, productIdentifier: 'luvani_starter_yearly' } } } };
  assert.deepEqual(heldFrom(info, 'pro'), { productId: 'luvani_starter_yearly', expiresAt: NOV_27, willRenew: true, inTrial: false });
  assert.equal(heldFrom(info, undefined), null);
  assert.equal(heldFrom({ entitlements: { active: {} } }, 'pro'), null);
  const { purchases: web } = await import('../purchases/adapter.ts');
  assert.equal(await (web as unknown as { heldPlan: (id: string) => Promise<unknown> }).heldPlan('someone'), null);
  // The renewal line is drawn once on the Subscription screen.
  const source = readFileSync(new URL('./SubscriptionScreen.tsx', import.meta.url), 'utf8');
  assert.equal(source.split('view.renewal').length - 1, 1, 'the renewal line is drawn more than once');
});

test('the minutes refresh date is shown apart from the billing renewal date', async () => {
  const { renewalLines, subscriptionView } = await api();
  // A yearly plan: minutes refresh on 3 November, the store bills next on 27 November.
  const yearly = status({ periodEnd: new Date(NOV_3).toISOString() });
  const view = planStatusFor(yearly, NOW);
  assert.ok(view.known);
  if (view.known) assert.equal(view.periodLine, 'Fresh minutes on 3 November.');
  const lines = renewalLines(yearly, previewOffering(PREVIEW), { productId: 'luvani_starter_yearly_preview', expiresAt: NOV_27, willRenew: true, inTrial: false }, 'ios');
  const screen = subscriptionView(view, lines);
  assert.equal(screen.minutes, 'Fresh minutes on 3 November.');
  assert.equal(screen.renewal, 'Core, yearly, £119.99. Renews on 27 November.');
  assert.doesNotMatch(String(screen.renewal), /3 November/);
  const source = readFileSync(new URL('./SubscriptionScreen.tsx', import.meta.url), 'utf8');
  assert.match(source, /<PlanCard band=\{view\.band\} period=\{view\.minutes\} \/>/);
  assert.match(source, /label=\{NEXT_RENEWAL_ROW\} sub=\{view\.renewal\}/);
});

test('an Android subscription is dated from its own base plan and never borrows another price', async () => {
  const { renewalLines } = await api();
  const facts = await import('../purchases/storeTrialFacts.ts') as Record<string, unknown>;
  const heldFrom = facts.storeHeldPlanFrom as (c: unknown, id: string) => { productId: string } | null;
  // RevenueCat on Android: the entitlement names the bare subscription and its base plan apart.
  const android = { entitlements: { active: { pro: { isActive: true, willRenew: true, periodType: 'NORMAL', expirationDateMillis: NOV_27, productIdentifier: 'luvani_starter', productPlanIdentifier: 'yearly' } } } };
  const held = heldFrom(android, 'pro');
  assert.equal(held?.productId, 'luvani_starter:yearly');
  const offering = { available: true, products: [
    { plan: 'starter', productId: 'luvani_starter:monthly', title: 'Core', localizedPrice: '£14.99', period: 'month', intro: null, introEligible: false },
  ], yearly: [
    { plan: 'starter', productId: 'luvani_starter:yearly', title: 'Core', localizedPrice: '£119.99', period: 'year', intro: null, introEligible: false },
  ] };
  assert.equal(renewalLines(status(), offering, held, 'android')?.full, 'Core, yearly, £119.99. Renews on 27 November.');
  // A held base plan the offering does not list is the pointer, never the sibling plan's price.
  const other = heldFrom({ entitlements: { active: { pro: { ...android.entitlements.active.pro, productPlanIdentifier: 'weekly' } } } }, 'pro');
  assert.equal(renewalLines(status(), offering, other, 'android')?.full, 'Your renewal date is in your Google Play subscriptions.');
  // iOS has no plan id: the bare product id stands.
  assert.equal(heldFrom({ entitlements: { active: { pro: { ...android.entitlements.active.pro, productPlanIdentifier: null } } } }, 'pro')?.productId, 'luvani_starter');
});

test('the store is asked for the offering once per focus, and only the Subscription screen reads the held plan', () => {
  const src = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const hook = src('./useStoreRenewal.ts');
  const screen = src('./SubscriptionScreen.tsx');
  assert.doesNotMatch(hook, /purchases\.offering\(/, 'the renewal hook asks for a second offering');
  assert.equal(screen.split('purchases\n          .offering(').length + screen.split('purchases.offering(').length - 2, 1, 'the Subscription screen asks for the offering more than once');
  assert.match(screen, /useStoreRenewal\(plan\.status, offering\)/);
  // Profile and Settings keep the minutes line, with no store read on every focus.
  for (const path of ['../tabs/ProfileTab.tsx', './SettingsScreen.tsx']) assert.doesNotMatch(src(path), /useStoreRenewal/, `${path} reads the store on every focus`);
});
