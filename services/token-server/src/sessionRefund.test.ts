import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileEntitlementStore, InMemoryEntitlementStore } from './store.ts';

const session = '22222222-2222-4222-8222-222222222222';
async function grant(store: InMemoryEntitlementStore | FileEntitlementStore, id = session) {
  assert.equal(await store.recordSessionGrant('learner', id, await store.get('learner')), true);
}

test('a failed session returns only its actual charge once and blocks a late debit', async () => {
  const store = new InMemoryEntitlementStore();
  await store.save('learner', { plan: 'trial', secondsUsed: 1790 });
  await grant(store);
  await store.consume('learner', 100, session);
  const refunded = await store.refundSession('learner', session, 'tts_error');
  assert.equal(refunded.kind, 'restored-current-period');
  assert.equal(refunded.refundedSeconds, 10, 'requested seconds beyond the cap were not charged');
  assert.equal((await store.get('learner')).secondsUsed, 1790);
  assert.deepEqual(await store.refundSession('learner', session, 'llm_error'), refunded);
  await store.consume('learner', 100, session);
  assert.equal((await store.get('learner')).secondsUsed, 1790, 'replayed normal settlement cannot recharge a refunded session');
  await assert.rejects(store.refundSession('other', session, 'tts_error'), /owner|account/);
  const next = '33333333-3333-4333-8333-333333333333';
  await grant(store, next);
  assert.equal((await store.refundSession('learner', next, 'stt_error')).kind, 'not-charged');
  await store.consume('learner', 10, next);
  assert.equal((await store.get('learner')).secondsUsed, 1790);
});

test('a session from an earlier allowance cannot consume or refund a new period', async () => {
  const store = new InMemoryEntitlementStore();
  await store.save('learner', { plan: 'starter', secondsUsed: 0, periodEnd: new Date('2027-01-01') });
  await grant(store);
  await store.save('learner', { plan: 'starter', secondsUsed: 70, periodEnd: new Date('2027-02-01') });
  await store.consume('learner', 100, session);
  assert.equal((await store.get('learner')).secondsUsed, 70);
  assert.equal((await store.refundSession('learner', session, 'tts_error')).kind, 'not-charged');
  assert.equal((await store.get('learner')).secondsUsed, 70);
});

test('a restarted file store preserves the failed-session tombstone and restored balance', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'luvani-refund-')), 'entitlements.json');
  const first = new FileEntitlementStore(file);
  await grant(first);
  await first.consume('learner', 100, session);
  await first.refundSession('learner', session, 'tts_error');
  const restarted = new FileEntitlementStore(file);
  await restarted.consume('learner', 100, session);
  assert.equal((await restarted.get('learner')).secondsUsed, 0);
  assert.equal((await restarted.refundSession('learner', session, 'tts_error')).refundedSeconds, 100);
});

test('a corrupt refund ledger fails closed and a failed write cannot acknowledge a refund', async () => {
  const { writeFileSync, renameSync, mkdirSync, rmSync } = await import('node:fs');
  const dir = mkdtempSync(join(tmpdir(), 'luvani-refund-failure-'));
  const file = join(dir, 'entitlements.json');
  try {
    writeFileSync(file, '{bad');
    assert.throws(() => new FileEntitlementStore(file), /ledger|JSON|parse/i);
    writeFileSync(file, JSON.stringify({ version: 2, entitlements: {}, epochs: {}, sessions: { bad: { userId: 'learner', epoch: 'epoch', charged: -100 } } }));
    assert.throws(() => new FileEntitlementStore(file), /ledger/i);
    rmSync(file);
    const store = new FileEntitlementStore(file);
    await grant(store); await store.consume('learner', 90, session);
    const moved = join(dir, 'good.json');renameSync(file, moved);mkdirSync(file);
    await assert.rejects(store.refundSession('learner', session, 'tts_error'));
    assert.equal((await store.get('learner')).secondsUsed, 90);
    rmSync(file, { recursive: true });renameSync(moved, file);
    assert.equal((await store.refundSession('learner', session, 'tts_error')).refundedSeconds, 90);
    assert.equal((await new FileEntitlementStore(file).get('learner')).secondsUsed, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('an expired paid refund without an intervening entitlement read is historical', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-01') });
  const store = new InMemoryEntitlementStore();
  await store.save('learner', { plan: 'starter', secondsUsed: 0, periodEnd: new Date('2026-09-02') });
  await grant(store);await store.consume('learner', 80, session);
  t.mock.timers.tick(4 * 86400_000);
  const ack = await store.refundSession('learner', session, 'tts_error');
  assert.equal(ack.kind, 'historical-reversal');assert.equal(ack.plan, 'trial');assert.equal(ack.secondsRemaining, 0);
});
