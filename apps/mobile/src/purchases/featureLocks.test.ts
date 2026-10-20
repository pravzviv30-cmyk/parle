import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { BillingStatus } from './billingStatus.ts';
import { LOCKED_FEATURES, clearStanding, featureLockState, featureLockStateNow, featureLockedNow, invalidateStanding, lockedRouteGuard, lockedRouteFeature, onStandingChange, setStanding, standingFor, standingVersion } from './featureLocks.ts';

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

describe('the café lesson is sound practice (2026-10-20)', () => {
  test('Lesson is locked as sounds in spoken and typed mode', () => {
    assert.equal(lockedRouteFeature('Lesson'), 'sounds');
    assert.equal(lockedRouteFeature('Lesson', { textMode: true }), 'sounds');
    assert.equal(lockedRouteFeature('Lesson', { textMode: false }), 'sounds');
  });

  test('a lesson resumed after a purchase is not replaced by the wall from the old standing', async () => {
    clearStanding();
    setStanding('u1', FREE);
    // The purchase settles: billingChanged runs the hook's listener, which
    // invalidates synchronously before afterPurchase resets to the Lesson.
    const before = standingVersion();
    invalidateStanding('u1');
    assert.equal(standingFor('u1'), null, 'the old locked answer survived the billing change');
    assert.notEqual(standingVersion(), before, 'a pre-purchase read could still land its answer');
    let walls = 0; let reads = 0;
    const guard = lockedRouteGuard({
      route: () => ({ key: 'lesson-2', name: 'Lesson', params: undefined }),
      standing: () => standingFor('u1'),
      read: async () => { reads++; setStanding('u1', CORE); return CORE; },
      owner: () => 1,
      toWall: () => { walls++; },
    });
    await guard();
    assert.equal(reads, 1, 'the guard did not read the fresh answer');
    assert.equal(walls, 0, 'the resumed lesson was replaced by the wall');
    clearStanding();
  });

  test('invalidation leaves another account alone and bumps the version', () => {
    clearStanding();
    setStanding('u2', FREE);
    const v = standingVersion();
    invalidateStanding('u1');
    assert.equal(standingFor('u2'), FREE);
    assert.ok(standingVersion() > v);
    clearStanding();
  });
});
