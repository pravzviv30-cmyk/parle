import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PLANS, storeTrialSeconds } from '@luvani/core';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { planStatusFor } from '../purchases/planStatus.ts';
import { SUCCESS_MONTH, SUCCESS_TRIAL, trialMinutes } from './wallCopy.ts';
import { purchasePill, wallSuccess } from './wallSuccess.ts';

const granted: BillingStatus = { plan: 'regular', secondsRemaining: 18000, periodEnd: '2027-01-01T00:00:00Z', lapsed: false, canStart: true, reason: null };

test('a finished purchase names only the refreshed server plan and its catalogue allowance', () => {
  assert.deepEqual(wallSuccess(granted, PLANS), { name: PLANS.regular.label, minutes: 300, perWeek: 7 });
  assert.equal(wallSuccess({ ...granted, plan: 'starter' }, PLANS)?.minutes, 180);
  const changed = { ...PLANS, regular: { ...PLANS.regular, secondsPerPeriod: 240 * 60 } };
  assert.equal(wallSuccess(granted, changed)?.minutes, 240);
});

test('an absent, trial, lapsed or unstartable grant cannot draw paid-plan success', () => {
  assert.equal(wallSuccess(null, PLANS), null);
  assert.equal(wallSuccess(granted, null), null);
  assert.equal(wallSuccess({ ...granted, plan: 'trial' }, PLANS), null);
  assert.equal(wallSuccess({ ...granted, lapsed: true }, PLANS), null);
  assert.equal(wallSuccess({ ...granted, canStart: false, reason: 'insufficient-for-session' }, PLANS), null);
});

// ── a store trial is a week (F742) ───────────────────────────────────────────

const NOW = Date.parse('2026-10-07T09:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const screen = readFileSync(new URL('./WallScreen.tsx', import.meta.url), 'utf8');

test('a store trial is described as a week of minutes, never a month', () => {
  // What the server answers on a store trial's first day: the plan itself,
  // a week of its allowance, ending when the trial ends (F733).
  const trial: BillingStatus = {
    plan: 'starter', secondsRemaining: storeTrialSeconds('starter'), periodEnd: new Date(NOW + 7 * DAY).toISOString(), lapsed: false, canStart: true, reason: null,
  };

  // The success page after a trial bought on the wall: the server's own week.
  assert.deepEqual(wallSuccess(trial, PLANS, true), { name: 'Starter', minutes: 42, perWeek: null, trial: true });
  assert.equal(wallSuccess({ ...trial, plan: 'regular', secondsRemaining: storeTrialSeconds('regular') }, PLANS, true)?.minutes, 70);
  // A trial the store did not apply in the end is a paid month on the server, and is said as one.
  assert.deepEqual(wallSuccess({ ...trial, secondsRemaining: PLANS.starter.secondsPerPeriod }, PLANS, true), { name: 'Starter', minutes: 180, perWeek: 4 });
  // The words under the number: a month only for a month.
  assert.doesNotMatch(SUCCESS_TRIAL, /month/i, 'the trial is described as a month');
  assert.match(SUCCESS_MONTH, /each month/);
  assert.match(screen, /\{success\.trial \? SUCCESS_TRIAL : SUCCESS_MONTH\}/, 'the success page says a month whatever was bought');
  assert.doesNotMatch(screen, /Your speaking time each month\./, 'the month line is written into the page rather than chosen');
  assert.match(screen, /wallSuccess\(confirmedGrant, latestCatalogue\(\), boughtTrial\.current\)/);
  assert.match(screen, /boughtTrial\.current = chosen\.trialDays !== null;/, 'the wall does not remember that it bought a trial');
  // And the timeline's line about the minutes never says a month.
  assert.doesNotMatch(trialMinutes(42), /month/);

  // The plan card on a trial's first day: plenty, measured against the week
  // the trial is, not "a little" of a month it never was.
  const first = planStatusFor(trial, NOW);
  assert.ok(first.known && first.band === 'plenty', 'a fresh store trial reads as a little speaking time');
  // Most of the week spent is a little, of the week.
  const late = planStatusFor({ ...trial, secondsRemaining: 5 * 60, periodEnd: new Date(NOW + 2 * DAY).toISOString() }, NOW);
  assert.ok(late.known && late.band === 'a-little');
  // A month with weeks to run is still measured against the month.
  const month = planStatusFor({ ...trial, secondsRemaining: 40 * 60, periodEnd: new Date(NOW + 20 * DAY).toISOString() }, NOW);
  assert.ok(month.known && month.band === 'a-little');
  const fresh = planStatusFor({ ...trial, secondsRemaining: PLANS.starter.secondsPerPeriod, periodEnd: new Date(NOW + 30 * DAY).toISOString() }, NOW);
  assert.ok(fresh.known && fresh.band === 'plenty');
});

// ── the purchase moment and the pill's check ─────────────────────────────────

test("the purchase moment and the pill's check come only from a confirmed entitlement, and a restore stays quiet", () => {
  const confirmed = wallSuccess(granted, PLANS);
  // The pill: busy while the store and the server answer, the check only once
  // the server confirmed what the success page names, after a purchase.
  const pill = (over: Partial<Parameters<typeof purchasePill>[0]>) => purchasePill({
    closing: true, busy: false, granted: false, purchaseAccepted: false, grantReadPending: false, success: null, ...over,
  });
  assert.equal(pill({ closing: false, busy: true }), 'idle', 'a wait the pill did not start turned it');
  assert.equal(pill({ busy: true }), 'busy');
  assert.equal(pill({ granted: true, purchaseAccepted: true, grantReadPending: true }), 'busy', 'the check drew before the server confirmed');
  assert.equal(pill({ granted: true, purchaseAccepted: true, success: confirmed }), 'done');
  assert.equal(pill({ granted: true, purchaseAccepted: false, success: confirmed }), 'idle', 'a restore drew the check');
  assert.equal(pill({ granted: true, purchaseAccepted: true, success: null }), 'idle', 'an allowance nobody could read drew the check');
  assert.equal(pill({}), 'idle', 'a cancel kept the pill waiting');

  // The pill keeps its tag in the footer and takes that state.
  const footer = screen.slice(screen.lastIndexOf('footer={'));
  assert.match(footer, /<PillButton\s+label=\{label\}[\s\S]*?state=\{morph\}/);
  assert.match(screen, /const morph = purchasePill\(\{ closing, busy, granted, purchaseAccepted, grantReadPending, success \}\);/);

  // The moment is published by the one effect, above every early return, and
  // only where the success page shows: not while the pill holds its check, not
  // after a restore, not before the server confirmed.
  const start = screen.indexOf('    if (holding || !ownsWall');
  const end = screen.indexOf('  }, [ownsWall, pendingRead, granted, purchaseAccepted, confirmedGrant, holding]);');
  assert.ok(start > 0 && end > start && end < screen.indexOf('if (!ownsWall) return ('), 'the purchase moment moved below an early return');
  assert.match(screen, /if \(success !== null && !holding\) \{/, 'the success page shows under another condition than the moment');
  const body = screen.slice(start, end);
  const run = (over: Record<string, unknown>) => {
    const published: unknown[] = [];
    const world: Record<string, unknown> = {
      holding: false, ownsWall: true, pendingRead: 'ready', granted: true, purchaseAccepted: true, confirmedGrant: granted,
      wallSuccess, latestCatalogue: () => PLANS, purchaseMoment: (grant: BillingStatus) => ({ key: `purchase:${grant.plan}`, type: 'purchase-confirmed' }),
      Date, celebrated: { current: null }, publishCelebrations: (moments: unknown) => published.push(moments), ...over,
    };
    new Function(...Object.keys(world), body)(...Object.values(world));
    return published.length;
  };
  assert.equal(run({}), 1);
  assert.equal(run({ holding: true }), 0, 'the moment opened over the pill\'s check');
  assert.equal(run({ purchaseAccepted: false }), 0, 'a restore was celebrated');
  assert.equal(run({ confirmedGrant: null }), 0, 'a purchase was celebrated before the server confirmed it');
  assert.equal(run({ latestCatalogue: () => null }), 0, 'a purchase was celebrated without the entitlement the success page names');
  assert.equal(run({ granted: false }), 0);
});
