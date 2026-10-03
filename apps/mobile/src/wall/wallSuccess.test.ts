import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLANS } from '@luvani/core';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { wallSuccess } from './wallSuccess.ts';

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
