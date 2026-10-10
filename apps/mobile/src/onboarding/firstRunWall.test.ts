/**
 * The first-run offer's trigger (come alive, README Part 5.C row 12; Part 6
 * "Wall entry": `path-complete` with a `pendingWall` trigger).
 *
 * Run with fakes for the server, the store and the navigator: the offer opens
 * once, after a kept practice, only once the server has said this account holds
 * no paid plan and the store has plans to sell, and never otherwise. The App
 * wiring is read as source, because there is no renderer in this suite.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evidence } from '../../test/evidence.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { firstRunWallDue, flushFirstRunWall, type FirstRunWallDeps } from './firstRunWall.ts';

const FREE: BillingStatus = { plan: 'trial', secondsRemaining: 1500, periodEnd: null, lapsed: false, canStart: true, reason: null };
const PAID: BillingStatus = { plan: 'starter', secondsRemaining: 10800, periodEnd: '2026-11-05T00:00:00.000Z', lapsed: false, canStart: true, reason: null };

/** A pending flag, the answers, and a record of what opened. */
function harness(pending: boolean, status: BillingStatus | null | Error, plans: boolean | Error, here = true) {
  const state = { pending, opened: 0, asked: 0 };
  const deps: FirstRunWallDeps = {
    take: () => {
      const due = state.pending;
      state.pending = false;
      return due;
    },
    status: async () => {
      state.asked += 1;
      if (status instanceof Error) throw status;
      return status;
    },
    storeHasPlans: async () => {
      if (plans instanceof Error) throw plans;
      return plans;
    },
    stillHere: () => here,
    open: () => {
      state.opened += 1;
    },
  };
  return { state, deps };
}

describe('the first-run offer', () => {
  test('the first-run offer opens once, only after the server says no paid plan is held and the store has plans', async () => {
    // The rule.
    assert.equal(firstRunWallDue(FREE, true), true);
    assert.equal(firstRunWallDue({ ...PAID, lapsed: true }, true), true, 'a lapsed plan holds nothing paid');
    assert.equal(firstRunWallDue(PAID, true), false, 'a paying learner is sold to');
    assert.equal(firstRunWallDue({ ...PAID, plan: 'regular' }, true), false);
    assert.equal(firstRunWallDue(null, true), false, 'an unread status was taken as a no');
    assert.equal(firstRunWallDue(FREE, false), false, 'the offer opens with nothing to sell');

    // Pending and due: it opens, once.
    const due = harness(true, FREE, true);
    assert.equal(await flushFirstRunWall(due.deps), true);
    assert.equal(due.state.opened, 1);
    assert.equal(await flushFirstRunWall(due.deps), false, 'the offer opened a second time');
    assert.equal(due.state.opened, 1);

    // Not pending (Start fresh, or no hand-off at all): nothing is even asked.
    const none = harness(false, FREE, true);
    assert.equal(await flushFirstRunWall(none.deps), false);
    assert.deepEqual([none.state.opened, none.state.asked], [0, 0]);

    // Every reason not to: a paid plan, an unread status, no store, a failure,
    // or an account or navigator that changed meanwhile. Each drops the
    // pending offer for good rather than waiting to show it later.
    for (const [why, run] of [
      ['a paid plan', harness(true, PAID, true)],
      ['an unread status', harness(true, null, true)],
      ['no plans in the store', harness(true, FREE, false)],
      ['a status read that threw', harness(true, new Error('offline'), true)],
      ['a store read that threw', harness(true, FREE, new Error('store'))],
      ['an account that changed', harness(true, FREE, true, false)],
    ] as const) {
      assert.equal(await flushFirstRunWall(run.deps), false, `the offer opened with ${why}`);
      assert.equal(run.state.opened, 0, `the offer opened with ${why}`);
      assert.equal(run.state.pending, false, `the offer waits to open later after ${why}`);
    }

    // The wiring: set only by a kept practice at the hand-off, taken once when
    // the navigator is ready and after the first-run reset, opening the
    // existing wall at its path-complete door.
    const app = evidence('apps/mobile/App.tsx');
    assert.match(app, /onDone=\{\(kept\) => \{ if \(kept && !newlyCreated\) pendingWall\.current = true; onPreAccountDraftConsumed\(\); \}\}/, 'something other than a kept existing-account practice sets the offer');
    assert.equal((app.match(/pendingWall\.current = true/g) ?? []).length, 1);
    assert.match(app, /const newlyCreated = newAccountUserId === user\.id;/, 'automatic signup adoption must be bound to the verified new account');
    assert.match(app, /newlyCreated=\{newlyCreated\}/);
    assert.match(app, /onReady=\{\(\) => \{ openFirstRun\(\); openPendingInvite\(\); \}\}/, 'the navigator no longer settles before the first-run navigation');
    const firstRun = app.slice(app.indexOf('const openFirstRun = useCallback('), app.indexOf('}, [justOnboarded, navigationRef, openPendingWall]);'));
    assert.ok(firstRun.length > 0, 'openFirstRun moved; this check reads nothing');
    assert.ok(firstRun.indexOf('navigationRef.resetRoot(') < firstRun.indexOf('openPendingWall();'), 'the offer opens before the first-run reset, which would wipe it');
    assert.match(firstRun, /if \(!navigationRef\.isReady\(\)\) return;/);
    assert.equal((app.match(/openPendingWall\(\);/g) ?? []).length, 1, 'the offer is flushed from somewhere other than the ready navigator');
    assert.match(app, /status: \(\) => fetchBillingStatus\(user\.id\)/, 'the offer does not wait for the server\'s answer');
    assert.match(app, /storeHasPlans: async \(\) => paywallSurface\(await purchases\.offering\(user\.id\)\) !== null/, 'the offer reads the store some other way than the wall does');
    assert.match(app, /stillHere: \(\) => owner === scopeGeneration\(\) && navigationRef\.isReady\(\)/);
    assert.match(app, /open: \(\) => navigationRef\.navigate\('Wall', \{ entry: 'path-complete' \}\)/);
    assert.equal((app.match(/navigate\('Wall'/g) ?? []).length, 1, 'App opens the wall from somewhere else');
    assert.doesNotMatch(app, /pendingWall[^;]*(AsyncStorage|setItem|userKey)/, 'the offer is remembered on the disk and could show again');
    // The hand-off says whether the practice was kept.
    const handoff = evidence('apps/mobile/src/onboarding/GuestAccountHandoff.tsx');
    assert.match(handoff, /onDone: \(kept: boolean\) => void;/);
    assert.match(handoff, /setGuest\(null\); onDone\(saved\);/);
  });
});
