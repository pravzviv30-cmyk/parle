/**
 * What Settings › Subscription › Restore says, and whether the plan is read
 * again (review P2 #4). The rule is pure; the wiring is read.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { REFRESH_TROUBLE, PURCHASE_TROUBLE, PURCHASE_AWAITING_APPROVAL } from '../purchases/paywallView.ts';
import { RESTORE_DONE } from '../purchases/subscription.ts';
import { RESTORE_NOTHING_FOUND, SUBSCRIPTION_RESTORE_COPY, restoreResult } from './subscriptionRestore.ts';

describe('subscription restore', () => {
  test('a restore that finds nothing says so rather than claiming the store has it', () => {
    const nothing = restoreResult({ kind: 'nothing-granted' });
    assert.equal(nothing.message, RESTORE_NOTHING_FOUND);
    assert.notEqual(nothing.message, RESTORE_DONE);
    assert.equal(nothing.refreshPlan, false);
    assert.equal(RESTORE_NOTHING_FOUND, "We checked the store and didn't find a subscription for this Apple ID.");
    assert.deepEqual(restoreResult({ kind: 'store-trouble' }), { message: PURCHASE_TROUBLE, refreshPlan: false });
    assert.deepEqual(restoreResult({ kind: 'awaiting-approval' }), { message: PURCHASE_AWAITING_APPROVAL, refreshPlan: false });
    assert.deepEqual(restoreResult({ kind: 'refresh-trouble' }), { message: REFRESH_TROUBLE, refreshPlan: true });
  });

  test('a successful restore refreshes the plan on the subscription screen', () => {
    assert.deepEqual(restoreResult({ kind: 'done', plan: 'monthly' as never }), { message: RESTORE_DONE, refreshPlan: true });
    const screen = readFileSync(new URL('./SubscriptionScreen.tsx', import.meta.url), 'utf8');
    assert.match(screen, /restoreResult\(/, 'the screen decides what a restore means itself');
    assert.match(screen, /plan\.retry\(\)/, 'a restore never re-reads the plan');
    assert.ok(!/nothing-granted/.test(screen), 'the screen still reads restore outcomes itself');
  });

  test('restore copy has no em dashes', () => {
    for (const line of SUBSCRIPTION_RESTORE_COPY) assert.ok(!line.includes('—'), line);
  });
});
