import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ownedReadStatus } from './ownedRead.ts';

test('an account switch hides ready evidence before the next focus effect clears it', () => {
  assert.equal(ownedReadStatus('ready', 4, 4, 5), 'loading');
  assert.equal(ownedReadStatus('unread', 4, null, 5), 'loading');
  assert.equal(ownedReadStatus('ready', 5, 4, 5), 'loading');
  assert.equal(ownedReadStatus('ready', 5, 5, 5), 'ready');
  assert.equal(ownedReadStatus('unread', 5, null, 5), 'unread');
});
