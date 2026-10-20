import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { BillingStatus } from './billingStatus.ts';
import { LOCKED_FEATURES, clearStanding, featureLockState, featureLockStateNow, featureLockedNow, onStandingChange, setStanding, standingFor } from './featureLocks.ts';

const FREE: BillingStatus = { plan: 'trial', secondsRemaining: 300, periodEnd: null, lapsed: false, canStart: true, reason: null };
const CORE: BillingStatus = { plan: 'starter', secondsRemaining: 10800, periodEnd: '2026-11-05T00:00:00.000Z', lapsed: false, canStart: true, reason: null };
const MAX: BillingStatus = { ...CORE, plan: 'regular' };

describe('the D24 feature locks (featureLocks.ts)', () => {
  test('a read answer decides; an unread one is unknown, never locked', () => {
    for (const feature of LOCKED_FEATURES) {
      assert.equal(featureLockState(feature, FREE), 'locked');
      assert.equal(featureLockState(feature, { ...CORE, lapsed: true }), 'locked');
      assert.equal(featureLockState(feature, MAX), 'unlocked');
      assert.equal(featureLockState(feature, null), 'unknown');
      assert.equal(featureLockState(feature, CORE), feature === 'realMoment' || feature === 'continueArc' ? 'locked' : 'unlocked');
    }
  });

  test('the synchronous read fails open, follows the account, and clears on an account change', () => {
    clearStanding();
    for (const feature of LOCKED_FEATURES) assert.equal(featureLockedNow(feature), false, 'an unread standing locked a feature');
    let heard = 0;
    const stop = onStandingChange(() => { heard++; });
    setStanding('a', FREE);
    assert.equal(featureLockedNow('tutorMemory'), true);
    assert.equal(standingFor('a'), FREE);
    assert.equal(standingFor('b'), null, 'one account read another\'s standing');
    setStanding('a', null);
    assert.equal(featureLockStateNow('tutorMemory'), 'unknown');
    assert.equal(featureLockedNow('tutorMemory'), false);
    setStanding('a', CORE);
    assert.equal(featureLockedNow('tutorMemory'), false);
    assert.equal(featureLockedNow('realMoment'), true);
    clearStanding();
    assert.equal(featureLockedNow('realMoment'), false);
    assert.equal(standingFor('a'), null);
    assert.equal(heard, 4);
    stop();
  });
});
