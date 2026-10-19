import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { BillingStatus } from './billingStatus.ts';
import type { StoreTrialFacts } from '../reminders/trialReminder.ts';
import { accountLeft, startTrialReminderSync, type TrialWiringDeps } from './trialReminderWiring.ts';

const STATUS: BillingStatus = { plan: 'starter', secondsRemaining: 2520, periodEnd: '2026-10-26T12:00:00.000Z', lapsed: false, canStart: true, reason: null };
const FACTS: StoreTrialFacts = { inTrial: true, willRenew: false, expiresAt: 1 };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function rig(over: Partial<TrialWiringDeps> = {}) {
  const fire: { foreground?: () => void; billing?: (c: { userId: string }) => void; store?: () => void } = {};
  const synced: { status: BillingStatus | null; storeFacts: StoreTrialFacts | null; now: number }[] = [];
  let current = true;
  const offs: string[] = [];
  const stop = startTrialReminderSync({
    userId: 'u1',
    isCurrent: () => current,
    fetchStatus: async () => structuredClone(STATUS),
    storeFacts: async () => ({ ...FACTS }),
    sync: async (facts) => { synced.push(facts); return true; },
    now: () => 42,
    onForeground: (l) => { fire.foreground = l; return () => offs.push('fg'); },
    onBillingChange: (l) => { fire.billing = l; return () => offs.push('billing'); },
    onStoreChange: (l) => { fire.store = l; return () => offs.push('store'); },
    ...over,
  });
  return { fire, synced, stop, offs, leave: () => { current = false; } };
}

test('syncs on launch with the server status and the store facts', async () => {
  const r = rig();
  await tick();
  assert.deepEqual(r.synced, [{ status: STATUS, storeFacts: FACTS, now: 42 }]);
  r.stop();
});

test('syncs again on foreground, billing change (purchase, restore, refresh) and store change', async () => {
  const r = rig();
  await tick();
  r.fire.foreground!(); await tick();
  r.fire.billing!({ userId: 'u1' }); await tick();
  r.fire.store!(); await tick();
  assert.equal(r.synced.length, 4);
  r.fire.billing!({ userId: 'someone-else' }); await tick();
  assert.equal(r.synced.length, 4, 'another account’s billing change is not ours');
  r.stop();
  assert.deepEqual(r.offs.sort(), ['billing', 'fg', 'store']);
  r.fire.foreground!(); await tick();
  assert.equal(r.synced.length, 4, 'a stopped loop syncs nothing');
});

test('an answer that lands after the account changed is dropped', async () => {
  const r = rig();
  r.leave();
  await tick();
  assert.equal(r.synced.length, 0);
  r.stop();
});

test('a failed read syncs with null, which changes nothing in the reminder rules', async () => {
  const r = rig({ fetchStatus: async () => { throw new Error('offline'); }, storeFacts: async () => { throw new Error('store'); } });
  await tick();
  assert.deepEqual(r.synced, [{ status: null, storeFacts: null, now: 42 }]);
  r.stop();
});

test('store facts never change the billing status handed over', async () => {
  const r = rig({ storeFacts: async () => ({ inTrial: false, willRenew: false, expiresAt: 0 }) });
  await tick();
  assert.deepEqual(r.synced[0]?.status, STATUS);
  r.stop();
});

test('sign-out and account switch cancel; signing in does not', () => {
  assert.equal(accountLeft('u1', null), true);
  assert.equal(accountLeft('u1', 'u2'), true);
  assert.equal(accountLeft(null, 'u1'), false);
  assert.equal(accountLeft('u1', 'u1'), false);
});

test('mounted once in App.tsx Gate, and the hook cancels on leaving', () => {
  const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
  assert.equal((app.match(/useTrialReminderSync\(signedInAs, status === 'loading'\)/g) ?? []).length, 1);
  const hook = readFileSync(new URL('./useTrialReminderSync.ts', import.meta.url), 'utf8');
  assert.match(hook, /if \(accountLeft\(was, userId\)\) void cancelTrialReminder\(\);/);
  assert.match(hook, /state === 'active'/);
});
