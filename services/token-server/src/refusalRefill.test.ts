import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { PLANS, type Entitlement } from '@luvani/core';
import { refusalRefillsAt } from './refusalRefill.ts';

const periodEnd = new Date('2026-10-22T05:00:00.000Z');

describe('the refill instant on a 402', () => {
  test('an insufficient-for-session refusal carries when the next free conversation is ready', () => {
    const thin: Entitlement = { plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod - 30, periodEnd };
    assert.equal(refusalRefillsAt('insufficient-for-session', thin), periodEnd.toISOString());
  });

  test('a spent free conversation still carries its refill', () => {
    const spent: Entitlement = { plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod, periodEnd };
    assert.equal(refusalRefillsAt('exhausted', spent), periodEnd.toISOString());
  });

  test('no window yet, or a paid plan, sends no refill rather than inventing one', () => {
    const before: Entitlement = { plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod - 30 };
    assert.equal(refusalRefillsAt('insufficient-for-session', before), undefined);
    for (const plan of ['starter', 'regular'] as const) {
      assert.equal(refusalRefillsAt('insufficient-for-session', { plan, secondsUsed: PLANS[plan].secondsPerPeriod - 30, periodEnd }), undefined);
      assert.equal(refusalRefillsAt('exhausted', { plan, secondsUsed: PLANS[plan].secondsPerPeriod, periodEnd }), undefined);
    }
  });
});
