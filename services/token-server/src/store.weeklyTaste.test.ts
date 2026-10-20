import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TASTE_REFILL_DAYS } from '@luvani/core';

import { FileEntitlementStore, InMemoryEntitlementStore } from './store.ts';

const DAY = 24 * 60 * 60 * 1000;
const s1 = '33333333-3333-4333-8333-333333333331';
const s2 = '33333333-3333-4333-8333-333333333332';

test('a claimed free row is a weekly taste with no window yet (D24)', async () => {
  for (const store of [new InMemoryEntitlementStore(), new FileEntitlementStore(join(mkdtempSync(join(tmpdir(), 'taste-')), 'l.json'))]) {
    assert.deepEqual(await store.get('learner'), { plan: 'trial', secondsUsed: 0, weeklyTaste: true });
  }
});

test('the first debit opens the window a week out and keeps the epoch, so a refund restores', async () => {
  const store = new InMemoryEntitlementStore();
  await store.get('learner');
  assert.equal(await store.recordSessionGrant('learner', s1, await store.get('learner')), true);
  const before = Date.now();
  const after = await store.consume('learner', 60, s1);
  assert.equal(after.secondsUsed, 60);
  const end = after.periodEnd!.getTime();
  assert.ok(end >= before + TASTE_REFILL_DAYS * DAY && end <= Date.now() + TASTE_REFILL_DAYS * DAY);
  const refund = await store.refundSession('learner', s1, 'tts_error');
  assert.equal(refund.kind, 'restored-current-period');
  assert.equal(refund.refundedSeconds, 60);
  // A second debit does not move the window.
  assert.equal(await store.recordSessionGrant('learner', s2, await store.get('learner')), true);
  assert.equal((await store.consume('learner', 30, s2)).periodEnd!.getTime(), end);
});

test('a taste past its window refills on read and starts a new epoch', async () => {
  const store = new InMemoryEntitlementStore();
  const ended = new Date(Date.now() + 1000);
  await store.save('learner', { plan: 'trial', secondsUsed: 120, weeklyTaste: true, periodEnd: ended });
  assert.equal(await store.recordSessionGrant('learner', s1, await store.get('learner')), true);
  await store.consume('learner', 60, s1);
  await store.save('learner', { plan: 'trial', secondsUsed: 180, weeklyTaste: true, periodEnd: new Date(Date.now() - 1) });
  const refilled = await store.get('learner');
  assert.deepEqual(refilled, { plan: 'trial', secondsUsed: 0, weeklyTaste: true });
  const refund = await store.refundSession('learner', s1, 'tts_error');
  assert.equal(refund.kind, 'historical-reversal');
  assert.equal((await store.get('learner')).secondsUsed, 0);
});

test('a free row that never passed the claim never refills', async () => {
  const store = new InMemoryEntitlementStore();
  const row = { plan: 'trial' as const, secondsUsed: 300, periodEnd: new Date(Date.now() - DAY) };
  await store.save('learner', row);
  assert.deepEqual(await store.get('learner'), row);
  await store.save('other', { plan: 'trial', secondsUsed: 10 });
  assert.equal((await store.consume('other', 20)).periodEnd, undefined);
});

test('a lapsed paid row lands on a fresh weekly taste', async () => {
  const store = new InMemoryEntitlementStore();
  await store.save('learner', { plan: 'regular', secondsUsed: 500, periodEnd: new Date(Date.now() - 3 * DAY) });
  assert.deepEqual(await store.get('learner'), { plan: 'trial', secondsUsed: 0, lapsed: true, weeklyTaste: true });
});

test('the file ledger round-trips weeklyTaste, loads an old file and rejects a non-boolean', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'taste-'));
  const file = join(dir, 'l.json');
  const end = new Date(Date.now() + DAY);
  await new FileEntitlementStore(file).save('learner', { plan: 'trial', secondsUsed: 40, weeklyTaste: true, periodEnd: end });
  assert.deepEqual(await new FileEntitlementStore(file).get('learner'), { plan: 'trial', secondsUsed: 40, weeklyTaste: true, periodEnd: end });

  const old = join(dir, 'old.json');
  writeFileSync(old, JSON.stringify({ learner: { plan: 'trial', secondsUsed: 100 } }));
  const loaded = await new FileEntitlementStore(old).get('learner');
  assert.deepEqual(loaded, { plan: 'trial', secondsUsed: 100 });
  assert.equal(loaded.weeklyTaste, undefined);

  const bad = join(dir, 'bad.json');
  writeFileSync(bad, JSON.stringify({ learner: { plan: 'trial', secondsUsed: 0, weeklyTaste: 'yes' } }));
  assert.throws(() => new FileEntitlementStore(bad), /Invalid entitlement ledger balance/);
});
