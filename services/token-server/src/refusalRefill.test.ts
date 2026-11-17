import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { PLANS, canStartSession, type Entitlement } from '@luvani/core';
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

  test('a thin or spent window gets the same refill from the token server as from core', () => {
    const thin: Entitlement = { plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod - 30, periodEnd };
    const spent: Entitlement = { plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod, periodEnd };
    const thinCore = canStartSession(thin);
    const spentCore = canStartSession(spent);
    assert.equal(refusalRefillsAt('insufficient-for-session', thin), !thinCore.allowed ? thinCore.refillsAt?.toISOString() : 'core admitted');
    assert.equal(refusalRefillsAt('exhausted', spent), !spentCore.allowed ? spentCore.refillsAt?.toISOString() : 'core admitted');
    // The database decides the reason; a thin refusal still carries the refill when
    // this entitlement snapshot alone would have admitted the learner.
    const fresh: Entitlement = { plan: 'trial', secondsUsed: 0, periodEnd };
    assert.equal(canStartSession(fresh).allowed, true);
    assert.equal(refusalRefillsAt('insufficient-for-session', fresh), periodEnd.toISOString());
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
