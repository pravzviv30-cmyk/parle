import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { LAPSE_GRACE_SEC, PLANS, canStartSession, secondsRemaining, type Entitlement } from '@luvani/core';
import { InMemoryEntitlementStore } from '../store.ts';
import {
  projectSubscriber,
  refreshSubscriber,
  renewSubscriber,
  revenueCatConfiguration,
  revenueCatReadConfiguration,
  webhookAuthorised,
  type RevenueCatConfiguration,
} from './revenuecat.ts';
import { withheldSeconds } from './state.ts';

const config: RevenueCatConfiguration = {
  secretApiKey: 'secret-api-key',
  webhookSecret: 'Bearer webhook-secret',
  entitlementId: 'luvani',
  products: { starter: 'luvani_starter_monthly', regular: 'luvani_regular_monthly' },
};
const now = new Date('2026-08-30T12:00:00.000Z');
// F733 (2026-10-05): RevenueCat's subscriber record names each product's
// period_type beside the entitlement, and the projection now reads it, so the
// fixture carries the record a real paid month has. Every assertion that used
// this fixture before still reads a normal paid period.
const subscriber = (product: string, expires = '2026-09-30T12:00:00.000Z', periodType = 'normal', purchased = '2026-08-30T12:00:00.000Z') => ({
  subscriber: {
    entitlements: { luvani: { product_identifier: product, expires_date: expires, purchase_date: purchased } },
    subscriptions: { [product]: { period_type: periodType, expires_date: expires, purchase_date: purchased } },
  },
});

describe('RevenueCat subscriber projection — F247', () => {
  test('an active starter subscriber projects to a fresh starter period', () => {
    const result = projectSubscriber(subscriber('luvani_starter_monthly'), { plan: 'trial', secondsUsed: 300 }, config, now);
    assert.equal(result.kind, 'active');
    if (result.kind !== 'active') return;
    assert.equal(result.entitlement.plan, 'starter');
    assert.equal(result.entitlement.secondsUsed, 0);
    assert.equal(result.entitlement.periodEnd?.toISOString(), '2026-09-30T12:00:00.000Z');
    assert.equal(result.entitlement.lapsed, false);
  });

  test('the same paid period preserves usage and a renewed period resets it', () => {
    const current: Entitlement = {
      plan: 'starter',
      secondsUsed: 1200,
      periodEnd: new Date('2026-09-30T12:00:00.000Z'),
    };
    const repeat = projectSubscriber(subscriber('luvani_starter_monthly'), current, config, now);
    assert.equal(repeat.kind === 'active' && repeat.entitlement.secondsUsed, 1200);
    const renewed = projectSubscriber(subscriber('luvani_starter_monthly', '2026-10-30T12:00:00.000Z'), current, config, now);
    assert.equal(renewed.kind === 'active' && renewed.entitlement.secondsUsed, 0);
  });

  test('a lapsed subscriber projects to an exhausted trial', () => {
    const current: Entitlement = {
      plan: 'starter',
      secondsUsed: 900,
      periodEnd: new Date('2026-08-01T00:00:00.000Z'),
    };
    const result = projectSubscriber({ subscriber: { entitlements: {} } }, current, config, now);
    assert.equal(result.kind, 'lapsed');
    if (result.kind !== 'lapsed') return;
    // The title predates D24 and is kept because the ledger names it. A lapse
    // now lands on a fresh weekly taste (core's lapsedEntitlement), still
    // marked lapsed so it never reads as a new learner's welcome.
    assert.deepEqual(result.entitlement, {
      plan: 'trial',
      secondsUsed: 0,
      lapsed: true,
      weeklyTaste: true,
    });
  });

  test('an unknown product identifier changes nothing and is logged loudly', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const store = new InMemoryEntitlementStore('starter');
    await store.save('5a18f595-9d67-4e34-b620-d410ba4335b1', {
      plan: 'starter',
      secondsUsed: 450,
      periodEnd: new Date('2026-09-30T12:00:00.000Z'),
    });
    const errors: unknown[][] = [];
    const result = await refreshSubscriber('5a18f595-9d67-4e34-b620-d410ba4335b1', store, config, {
      now,
      logger: { error: (...args: unknown[]) => errors.push(args) },
      request: async () => new Response(JSON.stringify(subscriber('some_future_plan')), { status: 200 }),
    });
    // The projection carries the entitlement that stands, so this can assert the
    // row came back untouched rather than only that the kind said so.
    assert.deepEqual(result, {
      kind: 'unchanged',
      reason: 'unknown-product',
      entitlement: { plan: 'starter', secondsUsed: 450, periodEnd: new Date('2026-09-30T12:00:00.000Z') },
    });
    assert.equal(errors.length, 1);
    assert.match(String(errors[0]?.[0]), /UNKNOWN_PRODUCT/);
    assert.equal((await store.get('5a18f595-9d67-4e34-b620-d410ba4335b1')).secondsUsed, 450);
  });
});

describe('billing configuration and webhook authentication', () => {
  test('no billing keys leaves the purchase path dark and a partial set is refused', () => {
    assert.equal(revenueCatConfiguration({}), null);
    assert.throws(() => revenueCatConfiguration({ REVENUECAT_SECRET_API_KEY: 'only-one' }), /incomplete/);
    assert.deepEqual(revenueCatConfiguration({
      REVENUECAT_SECRET_API_KEY: 'api',
      LUVANI_REVENUECAT_WEBHOOK_SECRET: 'hook',
      REVENUECAT_ENTITLEMENT_ID: 'luvani',
      REVENUECAT_STARTER_PRODUCT_ID: 'starter',
      REVENUECAT_REGULAR_PRODUCT_ID: 'regular',
    })?.products, { starter: 'starter', regular: 'regular' });
  });

  test('the webhook secret must match in full', () => {
    assert.equal(webhookAuthorised('Bearer webhook-secret', config.webhookSecret), true);
    assert.equal(webhookAuthorised('Bearer webhook-secreu', config.webhookSecret), false);
    assert.equal(webhookAuthorised(undefined, config.webhookSecret), false);
  });
});

describe('the refresh endpoint reports what it did — F265', () => {
  const server = readFileSync(path.join(import.meta.dirname, '..', 'server.ts'), 'utf8');

  test('a refresh that granted nothing does not report success', async () => {
    const userId = '9f2c1d4e-3b5a-4c6d-8e7f-0a1b2c3d4e5f';
    const store = new InMemoryEntitlementStore('trial');
    const before = await store.get(userId);

    // Nobody home at the vendor: this learner owns nothing and never did.
    const result = await refreshSubscriber(userId, store, config, {
      now,
      request: async () => new Response(JSON.stringify({ subscriber: { entitlements: {} } }), { status: 200 }),
    });

    assert.equal(result.kind, 'unchanged', 'a learner who owns nothing has had nothing granted');
    assert.equal(result.kind === 'unchanged' && result.reason, 'not-paid');
    // The entitlement rides along, so a caller can answer with the plan that stands
    // rather than inferring one from an HTTP status.
    assert.equal(result.entitlement.plan, before.plan);
    assert.deepEqual(await store.get(userId), before, 'nothing was written');

    // And the handler answers from that kind rather than from having run at all.
    // `return json(res, 200, { refreshed: true })` was the whole defect: a learner
    // was told their speaking time was ready and the paywall then hid the buy and
    // restore buttons behind that sentence.
    const opens = server.indexOf("url.pathname === '/billing/refresh'");
    assert.ok(opens > 0, 'there is no /billing/refresh handler');
    // Comments stripped: the handler's own comment quotes the defect it fixed, and a
    // scan that reads prose would be satisfied by an apology for the bug.
    const handler = server.slice(opens, server.indexOf('\n    if (req.method', opens)).replace(/\/\/[^\n]*/g, '');
    assert.match(handler, /refreshed: projection\.kind === 'active'/);
    assert.doesNotMatch(handler, /refreshed: true/, 'the endpoint claims success without asking what it did');
  });

  test('the grant carries the plan catalogue, so a learner need not be refused to learn the price', () => {
    assert.match(server, /return json\(res, 200, \{ \.\.\.result\.grant, livekitUrl, plans: PLANS \}/);
  });
});

describe('a plan change inside a paid period is not a new allowance', () => {
  const periodEnd = new Date('2026-09-30T12:00:00.000Z');

  test('crossgrading with the period untouched carries the seconds over rather than clearing them', () => {
    // 250 minutes of a 300-minute Max month already spent, then a move to Starter
    // that leaves the expiry where it was. This read `current.plan === plan`, so any
    // change of tier reset the counter: on a store whose proration keeps the expiry,
    // switching tiers was a fresh allowance, as often as a learner cared to switch.
    const current: Entitlement = { plan: 'regular', secondsUsed: 15_000, periodEnd };
    const result = projectSubscriber(subscriber('luvani_starter_monthly'), current, config, now);

    assert.equal(result.kind, 'active');
    if (result.kind !== 'active') return;
    assert.equal(result.entitlement.plan, 'starter');
    assert.notEqual(result.entitlement.secondsUsed, 0, 'a crossgrade inside a paid period is not a refill');
    assert.equal(
      result.entitlement.secondsUsed,
      PLANS.starter.secondsPerPeriod,
      'seconds already spent carry over, clamped to the cap of the plan now held',
    );
  });

  test('the same move at a new expiry does grant the new allowance, because that period was paid for', () => {
    const current: Entitlement = { plan: 'regular', secondsUsed: 15_000, periodEnd };
    const result = projectSubscriber(
      subscriber('luvani_starter_monthly', '2026-10-30T12:00:00.000Z'),
      current,
      config,
      now,
    );
    assert.equal(result.kind === 'active' && result.entitlement.secondsUsed, 0);
  });

  test('a first purchase from the trial grants a full allowance', () => {
    const current: Entitlement = { plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod };
    const result = projectSubscriber(subscriber('luvani_regular_monthly'), current, config, now);
    assert.equal(result.kind === 'active' && result.entitlement.plan, 'regular');
    assert.equal(result.kind === 'active' && result.entitlement.secondsUsed, 0, 'a trial has no period to be inside');
  });
});


test('a webhook whose projection fails does not consume the event id', async () => {
  const store = new InMemoryEntitlementStore();
  const save = store.save.bind(store);
  store.save = async () => { throw new Error('unavailable'); };
  const options = { now: new Date('2026-10-02'), eventId: 'retry-after-failure', request: async () => new Response(JSON.stringify(subscriber('luvani_regular_monthly', '2027-01-01T00:00:00Z'))) };
  await assert.rejects(refreshSubscriber('learner', store, config, options), /unavailable/);
  assert.equal(await store.billingEventComplete(options.eventId), false);
  store.save = save;
  assert.equal((await refreshSubscriber('learner', store, config, options)).kind, 'active');
  assert.equal(await store.billingEventComplete(options.eventId), true);
});

test('a same-period precision difference or earlier expiry never refills usage', () => {
  const current = { plan: 'regular' as const, secondsUsed: 1200, periodEnd: new Date('2027-01-01T00:00:00.987Z') };
  for (const end of ['2027-01-01T00:00:00.001Z', '2026-12-31T00:00:00Z']) {
    assert.equal(projectSubscriber(subscriber('luvani_regular_monthly', end), current, config, new Date('2026-10-02')).entitlement.secondsUsed, 1200);
  }
});

test('a later refresh with an older active expiry cannot shorten the paid period', () => {
  const current = { plan: 'regular' as const, secondsUsed: 600, periodEnd: new Date('2027-02-01') };
  const result = projectSubscriber(subscriber('luvani_starter_monthly', '2027-01-01'), current, config, new Date('2026-10-02'));
  assert.deepEqual(result, { kind: 'unchanged', reason: 'superseded', entitlement: current });
});

test('an invalid vendor response cannot lapse a paid learner or finish its event', async () => {
  const store = new InMemoryEntitlementStore();
  await store.save('learner', { plan: 'regular', secondsUsed: 1200, periodEnd: new Date('2027-01-01') });
  await assert.rejects(refreshSubscriber('learner', store, config, { eventId: 'bad-body', request: async () => new Response('{}') }), /entitlements are invalid/);
  assert.equal(await store.billingEventComplete('bad-body'), false);
  assert.equal((await store.get('learner')).plan, 'regular');
});


test('a refresh cannot revert a debit that landed while it was in flight', async () => {
  const store = new InMemoryEntitlementStore();
  await store.save('learner', { plan: 'regular', secondsUsed: 1000, periodEnd: new Date('2027-01-01') });
  let release!: () => void; let started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  const delayed = new Promise<void>(resolve => { release = resolve; });
  const refreshing = refreshSubscriber('learner', store, config, { now: new Date('2026-10-02'), request: async () => { started(); await delayed; return new Response(JSON.stringify(subscriber('luvani_regular_monthly', '2027-01-01T00:00:00.001Z'))); } });
  await entered;
  assert.equal(await store.recordSessionGrant('learner', 'once', await store.get('learner')), true);
  await store.consume('learner', 600, 'once');
  release();
  assert.equal((await refreshing).entitlement.secondsUsed,1600);
  assert.equal((await store.get('learner')).secondsUsed,1600);
});

describe('a store free trial and a yearly plan grant what D16 decided, on the server (F733)', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const yearly: RevenueCatConfiguration = {
    ...config,
    yearlyProducts: { starter: 'luvani_starter_yearly', regular: 'luvani_regular_yearly' },
  };

  test("a store trial grants a week of the plan's minutes and no more", async (t) => {
    const trialEnd = '2026-09-06T12:00:00.000Z';
    for (const [plan, product, minutes] of [['starter', 'luvani_starter_monthly', 42], ['regular', 'luvani_regular_monthly', 70]] as const) {
      // A learner still holding some of the weekly free taste starts the store's free week.
      const started = projectSubscriber(subscriber(product, trialEnd, 'trial'), { plan: 'trial', secondsUsed: 120, weeklyTaste: true }, config, now);
      assert.equal(started.kind, 'active');
      assert.equal(started.entitlement.plan, plan);
      assert.equal(
        secondsRemaining(started.entitlement),
        minutes * 60,
        `a ${plan} trial granted ${secondsRemaining(started.entitlement) / 60} minutes, not a week of the plan`,
      );
      assert.equal(started.entitlement.periodEnd?.toISOString(), trialEnd, 'the trial allowance ends with the trial');
      // The webhook spells the period in capitals. It is the same trial.
      const shouted = projectSubscriber(subscriber(product, trialEnd, 'TRIAL'), { plan: 'trial', secondsUsed: 0 }, config, now);
      assert.equal(secondsRemaining(shouted.entitlement), minutes * 60);
    }

    // Through the store and the meter: the week is spent, then refused, and a
    // repeat read of the same trial never refills it.
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const userId = '7c1e0a52-4b0d-4c55-9a3f-2f6f0a1b2c3d';
    const store = new InMemoryEntitlementStore('trial');
    const trial = async () => new Response(JSON.stringify(subscriber('luvani_starter_monthly', trialEnd, 'trial')));
    assert.equal((await refreshSubscriber(userId, store, config, { now, request: trial })).kind, 'active');
    await store.consume(userId, 40 * 60);
    assert.equal(canStartSession(await store.get(userId)).allowed, true, 'two minutes left is still one short session');
    await store.consume(userId, 15 * 60);
    const spent = await store.get(userId);
    assert.equal(secondsRemaining(spent), 0, 'usage ran past the trial week');
    const refused = canStartSession(spent);
    assert.equal(refused.allowed === false && refused.reason, 'exhausted');
    await refreshSubscriber(userId, store, config, { now, request: trial });
    assert.equal(secondsRemaining(await store.get(userId)), 0, 'reading the same trial again handed the week back');

    // The trial converts: the store's first paid month is the whole allowance.
    const paid = async () => new Response(JSON.stringify(subscriber('luvani_starter_monthly', '2026-10-06T12:00:00.000Z', 'normal', trialEnd)));
    assert.equal((await refreshSubscriber(userId, store, config, { now, request: paid })).kind, 'active');
    assert.equal(secondsRemaining(await store.get(userId)), PLANS.starter.secondsPerPeriod);
  });

  test('a yearly plan refills the monthly allowance every thirty days', () => {
    const bought = now;
    const yearEnd = new Date(bought.getTime() + 365 * DAY);
    const at = (day: number, extraMs = 0) => new Date(bought.getTime() + day * DAY + extraMs);
    const year = () => subscriber('luvani_regular_yearly', yearEnd.toISOString(), 'normal', bought.toISOString());

    // Day one: one month of Max, in a window ending thirty days in. The paid
    // year is the period, so that is what a plan lapses from (F733 review).
    const first = projectSubscriber(year(), { plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod }, yearly, at(0));
    assert.equal(first.kind, 'active');
    assert.equal(first.entitlement.plan, 'regular');
    assert.equal(secondsRemaining(first.entitlement), PLANS.regular.secondsPerPeriod, 'a yearly plan granted something other than one month');
    assert.equal(first.entitlement.windowEnd?.toISOString(), at(30).toISOString(), 'the first allowance runs to the end of the year, not the window');
    assert.equal(first.entitlement.periodEnd?.toISOString(), yearEnd.toISOString(), 'the window was recorded as the paid period');

    // Most of the month spent, read again inside the window: nothing comes back.
    const spent: Entitlement = { ...first.entitlement, secondsUsed: 250 * 60 };
    const again = projectSubscriber(year(), spent, yearly, at(12));
    assert.equal(again.entitlement.secondsUsed, 250 * 60);
    assert.equal(again.entitlement.windowEnd?.toISOString(), at(30).toISOString());

    // The window ends and the next read refills one month, no more.
    const next = projectSubscriber(year(), spent, yearly, at(30, 60_000));
    assert.equal(next.entitlement.secondsUsed, 0);
    assert.equal(next.entitlement.windowEnd?.toISOString(), at(60).toISOString());

    // An older window read late moves nothing back.
    assert.equal(projectSubscriber(year(), next.entitlement, yearly, at(29)).kind, 'unchanged');

    // A learner who spends every minute every day of the paid year is refilled
    // twelve times, each time with one month, and the last window ends with the year.
    let row: Entitlement = { plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod };
    let refills = 0;
    for (let day = 0; day < 365; day += 1) {
      const used: Entitlement = row.plan === 'trial' ? row : { ...row, secondsUsed: PLANS.regular.secondsPerPeriod };
      const result = projectSubscriber(year(), used, yearly, at(day, 60 * 60 * 1000));
      assert.equal(result.kind, 'active');
      assert.ok(secondsRemaining(result.entitlement) <= PLANS.regular.secondsPerPeriod, 'a yearly plan granted more than a month at once');
      if (result.entitlement.secondsUsed === 0) refills += 1;
      row = result.entitlement;
    }
    assert.equal(refills, 12, `a paid year refilled ${refills} times`);
    assert.equal(row.periodEnd?.toISOString(), yearEnd.toISOString());
    assert.equal(row.windowEnd, undefined, 'the last window ends with the year, so it is the period itself');

    // After the paid year nothing is granted; the store renews it or it ends.
    assert.equal(projectSubscriber(year(), row, yearly, at(366)).kind, 'lapsed');
  });

  test('a yearly learner whose window ended a day ago is not lapsed by a read, and the next refresh grants window two', async (t) => {
    // F733 review (2026-10-05): the window used to be the period on record, so
    // a read a day after a window the sweep missed lapsed a paying learner, and
    // with them their streak protection, until the year renewed.
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const userId = '0b8e6a0c-1d2f-4e3a-9b4c-5d6e7f8a9b0c';
    const store = new InMemoryEntitlementStore('trial');
    const yearEnd = new Date(now.getTime() + 365 * DAY).toISOString();
    const year = async () => new Response(JSON.stringify(subscriber('luvani_regular_yearly', yearEnd, 'normal', now.toISOString())));
    assert.equal((await refreshSubscriber(userId, store, yearly, { now, request: year })).kind, 'active');
    await store.consume(userId, PLANS.regular.secondsPerPeriod);

    // No sweep runs. Twenty-five hours after window one ended, the learner reads.
    const late = new Date(now.getTime() + 30 * DAY + 25 * 60 * 60 * 1000);
    t.mock.timers.setTime(late.getTime());
    const held = await store.get(userId);
    assert.equal(held.plan, 'regular', 'a read lapsed a paying yearly learner');
    assert.notEqual(held.lapsed, true);
    assert.equal(held.periodEnd?.toISOString(), yearEnd, 'a read moved the paid year');
    assert.equal(secondsRemaining(held), 0, 'a read refilled minutes no vendor read granted');
    const refused = canStartSession(held);
    assert.equal(refused.allowed === false && refused.reason, 'exhausted', 'an unrefilled window is a paid plan out of minutes, not a lapse');

    // A refresh (the sweep, or the learner restoring) grants window two in full.
    assert.equal((await refreshSubscriber(userId, store, yearly, { now: late, request: year })).kind, 'active');
    const refilled = await store.get(userId);
    assert.equal(secondsRemaining(refilled), PLANS.regular.secondsPerPeriod);
    assert.equal(refilled.windowEnd?.toISOString(), new Date(now.getTime() + 60 * DAY).toISOString());
  });

  test('a purchase the server cannot classify is refused, never guessed', () => {
    const current: Entitlement = { plan: 'starter', secondsUsed: 450, periodEnd: new Date('2026-09-15T12:00:00.000Z') };
    const unnamed = { subscriber: { entitlements: { luvani: { product_identifier: 'luvani_starter_monthly', expires_date: '2026-09-30T12:00:00.000Z' } } } };
    assert.deepEqual(projectSubscriber(unnamed, current, config, now), { kind: 'unchanged', reason: 'unknown-product', entitlement: current },
      'a period the vendor did not name was guessed');
    assert.equal(projectSubscriber(subscriber('luvani_starter_monthly', undefined, 'promotional'), current, config, now).kind, 'unchanged');
    // A yearly product this server was not configured for is an unknown product.
    assert.equal(projectSubscriber(subscriber('luvani_regular_yearly'), current, config, now).kind, 'unchanged');
    // A yearly product with no start cannot be cut into windows, so it grants nothing rather than a year.
    const startless = subscriber('luvani_regular_yearly', '2027-08-30T12:00:00.000Z');
    delete (startless.subscriber.entitlements.luvani as { purchase_date?: string }).purchase_date;
    delete (startless.subscriber.subscriptions['luvani_regular_yearly'] as { purchase_date?: string }).purchase_date;
    assert.equal(projectSubscriber(startless, current, yearly, now).kind, 'unchanged');
  });

  test('a grant outside the plan allowance is refused before it reaches a row', () => {
    for (const grant of [0, -60, 1.5, PLANS.starter.secondsPerPeriod + 1, Number.NaN]) {
      assert.throws(() => withheldSeconds('starter', grant), RangeError, `a grant of ${grant} seconds was accepted`);
    }
    assert.equal(withheldSeconds('starter', PLANS.starter.secondsPerPeriod), 0, 'a paid month withholds nothing');
    assert.equal(withheldSeconds('regular', 70 * 60), PLANS.regular.secondsPerPeriod - 70 * 60);
  });

  test('yearly product ids are optional one by one, and a partial or ambiguous set is refused', () => {
    const five = {
      REVENUECAT_SECRET_API_KEY: 'api',
      LUVANI_REVENUECAT_WEBHOOK_SECRET: 'hook',
      REVENUECAT_ENTITLEMENT_ID: 'luvani',
      REVENUECAT_STARTER_PRODUCT_ID: 'starter',
      REVENUECAT_REGULAR_PRODUCT_ID: 'regular',
    };
    assert.deepEqual(revenueCatConfiguration(five)?.yearlyProducts, {}, 'no yearly key means no yearly product, not a refusal');
    assert.deepEqual(revenueCatConfiguration({ ...five, REVENUECAT_REGULAR_YEARLY_PRODUCT_ID: 'regular_year' })?.yearlyProducts, { regular: 'regular_year' });
    assert.throws(() => revenueCatConfiguration({ REVENUECAT_STARTER_YEARLY_PRODUCT_ID: 'starter_year' }), /incomplete/);
    assert.throws(() => revenueCatConfiguration({ ...five, REVENUECAT_STARTER_YEARLY_PRODUCT_ID: 'starter' }), /ambiguous/);
    assert.throws(() => revenueCatConfiguration({ ...five, REVENUECAT_STARTER_YEARLY_PRODUCT_ID: 'year', REVENUECAT_REGULAR_YEARLY_PRODUCT_ID: 'year' }), /ambiguous/);

    // The maintenance worker reads subscribers without the webhook secret. The
    // secret alone, which it holds for privacy erasure, leaves the sweep off.
    assert.equal(revenueCatReadConfiguration({ REVENUECAT_SECRET_API_KEY: 'api' }), null);
    assert.throws(() => revenueCatReadConfiguration({ REVENUECAT_SECRET_API_KEY: 'api', REVENUECAT_ENTITLEMENT_ID: 'luvani' }), /incomplete/);
    const { LUVANI_REVENUECAT_WEBHOOK_SECRET: _hook, ...read } = five;
    assert.deepEqual(revenueCatReadConfiguration({ ...read, REVENUECAT_STARTER_YEARLY_PRODUCT_ID: 'starter_year' }), {
      secretApiKey: 'api', entitlementId: 'luvani', products: { starter: 'starter', regular: 'regular' }, yearlyProducts: { starter: 'starter_year' },
    });
  });

  test('a renewal check grants the next window and lapses nothing still inside its slack', async (t) => {
    const later = new Date(now.getTime() + 30 * DAY + 5 * 60 * 1000);
    t.mock.timers.enable({ apis: ['Date'], now: later.getTime() });
    const store = new InMemoryEntitlementStore();
    const errors: unknown[][] = [];
    const logger = { error: (...args: unknown[]) => errors.push(args) };
    const yearEnd = new Date(now.getTime() + 365 * DAY).toISOString();
    const windowEnd = new Date(now.getTime() + 30 * DAY);

    // A yearly learner who spent the whole first window gets the second the moment it opens.
    // F733 review: the row holds the paid year as its period and the window beside it.
    await store.save('yearly', { plan: 'regular', secondsUsed: PLANS.regular.secondsPerPeriod, periodEnd: new Date(yearEnd), windowEnd });
    const year = async () => new Response(JSON.stringify(subscriber('luvani_regular_yearly', yearEnd, 'normal', now.toISOString())));
    assert.equal(await renewSubscriber('yearly', windowEnd, store, yearly, { now: later, request: year }), 'renewed');
    const refilled = await store.get('yearly');
    assert.equal(refilled.secondsUsed, 0);
    assert.equal(refilled.windowEnd?.toISOString(), new Date(now.getTime() + 60 * DAY).toISOString());
    assert.equal(refilled.periodEnd?.toISOString(), yearEnd);

    // The vendor holds nothing yet, an hour after a monthly period ended: that is the slack's job.
    const hourAgo = new Date(later.getTime() - 60 * 60 * 1000);
    const monthly: Entitlement = { plan: 'starter', secondsUsed: 600, periodEnd: hourAgo };
    await store.save('monthly', monthly);
    const nothing = async () => new Response(JSON.stringify({ subscriber: { entitlements: {} } }));
    assert.equal(await renewSubscriber('monthly', hourAgo, store, yearly, { now: later, request: nothing }), 'waiting');
    assert.deepEqual(await store.get('monthly'), monthly, 'a period inside its slack was taken away');

    // Past the slack, the same answer lapses it, exactly as a read would.
    const dayAndMore = new Date(later.getTime() - LAPSE_GRACE_SEC * 1000 - 60_000);
    await store.save('ended', { plan: 'starter', secondsUsed: 600, periodEnd: dayAndMore });
    assert.equal(await renewSubscriber('ended', dayAndMore, store, yearly, { now: later, request: nothing }), 'lapsed');
    assert.equal((await store.get('ended')).lapsed, true);

    // A product nobody configured waits, loudly, and writes nothing.
    await store.save('odd', { plan: 'starter', secondsUsed: 10, periodEnd: hourAgo });
    const odd = async () => new Response(JSON.stringify(subscriber('some_future_plan', yearEnd)));
    assert.equal(await renewSubscriber('odd', hourAgo, store, yearly, { now: later, request: odd, logger }), 'waiting');
    assert.equal((await store.get('odd')).secondsUsed, 10);
    assert.match(String(errors[0]?.[0]), /UNKNOWN_PRODUCT/);
  });

  // F733 second review (2026-10-06). Apple applies an upgrade at once, whatever
  // its length, and refunds the rest of the old plan. Starter yearly to Max
  // monthly therefore arrives with an end eleven months before the year on
  // record, and ordering answers by end alone kept the learner on Starter with
  // no refill. Answers are ordered by when their period started first.
  const bought = new Date(now.getTime() - 45 * DAY);
  const starterYearEnd = new Date(bought.getTime() + 365 * DAY);
  const starterYear = () => subscriber('luvani_starter_yearly', starterYearEnd.toISOString(), 'normal', bought.toISOString());
  const upgradedAt = new Date(now.getTime() - 60_000);
  const maxMonthEnd = new Date(now.getTime() + 30 * DAY);
  const maxMonth = () => subscriber('luvani_regular_monthly', maxMonthEnd.toISOString(), 'normal', upgradedAt.toISOString());
  const onStarterYear = (): Entitlement => {
    const held = projectSubscriber(starterYear(), { plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod }, yearly, now);
    assert.equal(held.kind, 'active');
    return { ...held.entitlement, secondsUsed: 10_200 };
  };

  test('a Starter yearly learner who upgrades to Max monthly is granted Max at once', () => {
    const max = projectSubscriber(maxMonth(), onStarterYear(), yearly, now);
    assert.equal(max.kind, 'active', `the upgrade was answered ${max.kind}`);
    assert.equal(max.entitlement.plan, 'regular');
    assert.equal(max.entitlement.secondsUsed, 0, 'the upgrade did not grant the Max month');
    assert.equal(max.entitlement.periodEnd?.toISOString(), maxMonthEnd.toISOString());
    assert.equal(max.entitlement.windowEnd, undefined, 'a monthly plan kept the old year\'s window');
    assert.equal(max.entitlement.periodStart?.toISOString(), upgradedAt.toISOString());
  });

  test('a stale read of the old year after that upgrade moves nothing', () => {
    const max = projectSubscriber(maxMonth(), onStarterYear(), yearly, now);
    const spent: Entitlement = { ...max.entitlement, secondsUsed: 600 };
    assert.deepEqual(projectSubscriber(starterYear(), spent, yearly, now), { kind: 'unchanged', reason: 'superseded', entitlement: spent },
      'a late read of the refunded year moved the learner back to Starter');
    // Max renews a month later: a later start is a new period, whatever its end.
    const renewal = subscriber('luvani_regular_monthly', new Date(maxMonthEnd.getTime() + 30 * DAY).toISOString(), 'normal', maxMonthEnd.toISOString());
    assert.equal(projectSubscriber(renewal, spent, yearly, new Date(maxMonthEnd.getTime() + 60_000)).entitlement.secondsUsed, 0);
  });

  test('a renewal check that finds a newer answer already applied says so while the store holds a plan', async () => {
    const errors: unknown[][] = [];
    const logger = { error: (...args: unknown[]) => errors.push(args) };
    const held: Entitlement = { plan: 'regular', secondsUsed: 0, periodEnd: maxMonthEnd };
    const store = {
      beginBillingRefresh: async () => 1,
      applyBilling: async () => ({ kind: 'unchanged' as const, reason: 'superseded' as const, entitlement: held }),
    };
    const request = async () => new Response(JSON.stringify(maxMonth()));
    assert.equal(await renewSubscriber('upgraded', bought, store, yearly, { now, request, logger }), 'waiting');
    assert.equal(errors.length, 1, 'a superseded answer for a learner the store says is paid was swallowed');
    assert.match(String(errors[0]?.[0]), /BILLING_RENEWAL_SUPERSEDED/);
    // A superseded answer that says the learner holds nothing is the slack's business, and quiet.
    errors.length = 0;
    const nothing = async () => new Response(JSON.stringify({ subscriber: { entitlements: {} } }));
    await renewSubscriber('gone', new Date(now.getTime() - 2 * LAPSE_GRACE_SEC * 1000), store, yearly, { now, request: nothing, logger });
    assert.deepEqual(errors, []);
  });

  test('a period read first as a trial and then as paid at the same end gives the payer the whole allowance', () => {
    // F733 second review: RevenueCat's period_type can lag a conversion. The
    // withheld part of the window is kept beside it, so the fuller answer for
    // the same window gives it back.
    const start = '2026-08-29T12:00:00.000Z';
    const end = '2026-09-29T12:00:00.000Z';
    const trial = projectSubscriber(subscriber('luvani_regular_monthly', end, 'trial', start), { plan: 'trial', secondsUsed: 1800 }, config, now);
    const spent: Entitlement = { ...trial.entitlement, secondsUsed: trial.entitlement.secondsUsed + 1000 };
    const paid = projectSubscriber(subscriber('luvani_regular_monthly', end, 'normal', start), spent, config, now);
    assert.equal(paid.kind, 'active');
    assert.equal(secondsRemaining(paid.entitlement), PLANS.regular.secondsPerPeriod - 1000, 'the payer stayed short by the trial\'s withheld minutes');
    const lag = projectSubscriber(subscriber('luvani_regular_monthly', end, 'trial', start), paid.entitlement, config, now);
    assert.equal(secondsRemaining(lag.entitlement), 70 * 60 - 1000, 'a lagging trial read handed back more than the week');
  });

  test('a worker whose entitlement id matches nothing the store holds waits, and never lapses a payer', async (t) => {
    // F733 second review: the maintenance worker is configured on its own. A
    // typo in its entitlement id used to read as "holds nothing" and lapse
    // every yearly learner a day after their next window.
    const later = new Date(now.getTime() + 2 * DAY);
    t.mock.timers.enable({ apis: ['Date'], now: later.getTime() });
    const typo = { ...yearly, entitlementId: 'luvanni' };
    const errors: unknown[][] = [];
    const logger = { error: (...args: unknown[]) => errors.push(args) };
    const store = new InMemoryEntitlementStore();
    const windowEnded = new Date(now.getTime() - 30 * DAY);
    const row: Entitlement = { plan: 'regular', secondsUsed: 18_000, periodEnd: new Date(now.getTime() + 300 * DAY), windowEnd: new Date(later.getTime() - 26 * 60 * 60 * 1000) };
    await store.save('typo', row);
    const year = async () => new Response(JSON.stringify(subscriber('luvani_regular_yearly', row.periodEnd!.toISOString(), 'normal', windowEnded.toISOString())));
    assert.equal(await renewSubscriber('typo', row.windowEnd!, store, typo, { now: later, request: year, logger }), 'waiting');
    assert.equal((await store.get('typo')).plan, 'regular', 'a misconfigured entitlement id lapsed a paying learner');
    assert.match(String(errors[0]?.[0]), /REVENUECAT_ENTITLEMENT_MISSING/);
    // An unexpired subscription to a configured product with no entitlement at all waits too.
    const bare = { subscriber: { entitlements: {}, subscriptions: { luvani_regular_yearly: { period_type: 'normal', expires_date: row.periodEnd!.toISOString() } } } };
    assert.equal(projectSubscriber(bare, row, yearly, later).kind, 'unchanged');
    // Another active entitlement under any name waits as well.
    const other = { subscriber: { entitlements: { premium: { product_identifier: 'luvani_regular_yearly', expires_date: row.periodEnd!.toISOString() } } } };
    assert.equal(projectSubscriber(other, row, typo, later).kind, 'unchanged');
    // A learner whose subscriptions have all ended still lapses.
    const ended = { subscriber: { entitlements: { luvani: { product_identifier: 'luvani_regular_monthly', expires_date: '2026-08-01T00:00:00Z' } },
      subscriptions: { luvani_regular_monthly: { period_type: 'normal', expires_date: '2026-08-01T00:00:00Z' } } } };
    assert.equal(projectSubscriber(ended, row, yearly, later).kind, 'lapsed');
  });

  test('a store billing grace period grants nothing new and is logged', async (t) => {
    // F733 second review: grace periods are off in the console, and the server
    // no longer relies on that. A renewal or a trial conversion whose payment
    // failed is not a new paid month.
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const errors: unknown[][] = [];
    const logger = { error: (...args: unknown[]) => errors.push(args) };
    const store = new InMemoryEntitlementStore();
    const trialEnd = new Date(now.getTime() - 60 * 60 * 1000);
    const trialRow: Entitlement = { plan: 'starter', secondsUsed: PLANS.starter.secondsPerPeriod, periodEnd: trialEnd, withheldSeconds: PLANS.starter.secondsPerPeriod - 42 * 60 };
    await store.save('grace', trialRow);
    const graceEnd = new Date(now.getTime() + 16 * DAY).toISOString();
    for (const periodType of ['normal', 'trial']) {
      const body = subscriber('luvani_starter_monthly', graceEnd, periodType, trialEnd.toISOString());
      (body.subscriber.entitlements.luvani as Record<string, unknown>).grace_period_expires_date = graceEnd;
      const result = await refreshSubscriber('grace', store, config, { now, request: async () => new Response(JSON.stringify(body)), logger });
      assert.equal(result.kind, 'unchanged', `a ${periodType} answer in a grace period granted a month nobody paid for`);
      assert.deepEqual(await store.get('grace'), trialRow);
    }
    assert.match(String(errors[0]?.[0]), /REVENUECAT_GRACE_PERIOD/);
    // Once the payment lands the store moves the expiry a period on, past the old grace, and the month is granted.
    const recovered = subscriber('luvani_starter_monthly', new Date(trialEnd.getTime() + 30 * DAY).toISOString(), 'normal', trialEnd.toISOString());
    (recovered.subscriber.entitlements.luvani as Record<string, unknown>).grace_period_expires_date = graceEnd;
    assert.equal((await refreshSubscriber('grace', store, config, { now, request: async () => new Response(JSON.stringify(recovered)), logger })).kind, 'active');
    assert.equal(secondsRemaining(await store.get('grace')), PLANS.starter.secondsPerPeriod);
  });
});
