import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ownedStoreSettlement } from './storeSettlement.ts';

test('a store sheet returning after an account change never refreshes the new account', async () => {
  let current = true;
  let refreshes = 0;
  const result = await ownedStoreSettlement(async () => { current = false; return { ok: true }; },
    async () => { refreshes++; return { granted: true, plan: 'regular' }; }, () => current);
  assert.deepEqual(result, { kind: 'store-trouble' });
  assert.equal(refreshes, 0);
});

test('a billing answer returning after an account change cannot announce a grant', async () => {
  let current = true;
  assert.deepEqual(await ownedStoreSettlement(async () => ({ ok: true }),
    async () => { current = false; return { granted: true, plan: 'regular' }; }, () => current), { kind: 'refresh-trouble' });
});

test('store settlement distinguishes cancellation, no grant and a verified paid plan', async () => {
  const yes = () => true;
  assert.deepEqual(await ownedStoreSettlement(async () => ({ ok: false, cancelled: true }),
    async () => { throw new Error('must not refresh'); }, yes), { kind: 'cancelled' });
  assert.deepEqual(await ownedStoreSettlement(async () => ({ ok: true }), async () => ({ granted: false, plan: 'trial' }), yes), { kind: 'nothing-granted' });
  assert.deepEqual(await ownedStoreSettlement(async () => ({ ok: true }), async () => ({ granted: true, plan: 'regular' }), yes), { kind: 'done', plan: 'regular' });
});
