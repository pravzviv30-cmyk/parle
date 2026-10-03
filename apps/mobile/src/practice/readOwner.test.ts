import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ownsPracticeRead } from './readOwner.ts';

test('Practice hides an old recommendation before account effects flush', () => {
  const read = { scope: 4, userId: 'account-a' };
  assert.equal(ownsPracticeRead(read, 4, 'account-a', 'account-a'), true);
  assert.equal(ownsPracticeRead(read, 5, 'account-b', 'account-b'), false);
  assert.equal(ownsPracticeRead(read, 4, 'account-b', 'account-b'), false);
  assert.equal(ownsPracticeRead(read, 4, 'account-a', 'account-b'), false);
});

test('Practice refuses a stale failure as well as a stale success', () => {
  const failedRead = { scope: 8, userId: 'account-a' };
  assert.equal(ownsPracticeRead(failedRead, 9, 'account-b', 'account-b'), false);
  assert.equal(ownsPracticeRead(null, 9, 'account-b', 'account-b'), false);
});
