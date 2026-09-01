import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { agentDebitAllowed } from './agentAuth.ts';
import { FileEntitlementStore } from './store.ts';

describe('who may debit a learner', () => {
  test('a debit without the agent secret is refused', () => {
    // Before this, /session/end took any userId and any number of seconds from
    // anything that could reach the port, and answered 200.
    assert.equal(agentDebitAllowed('s3cret', undefined), false);
    assert.equal(agentDebitAllowed('s3cret', ''), false);
    assert.equal(agentDebitAllowed('s3cret', 'wrong'), false);
    assert.equal(agentDebitAllowed('s3cret', 's3cret'), true);
  });

  test('a repeated header is somebody probing, not the agent', () => {
    assert.equal(agentDebitAllowed('s3cret', ['wrong', 's3cret']), false);
  });

  test('an unconfigured secret keeps the keyless local setup working', () => {
    assert.equal(agentDebitAllowed(undefined, undefined), true);
    assert.equal(agentDebitAllowed('', 'anything'), true);
  });
});

describe('minutes that survive a restart', () => {
  test('a file-backed balance outlives the process that spent it', async () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'luvani-store-')), 'entitlements.json');

    const before = new FileEntitlementStore(file);
    await before.consume('learner-1', 120);
    const spent = await before.get('learner-1');

    // In memory, a deploy hands everyone their minutes back — which makes a
    // balance a property of the server's uptime rather than of what was bought.
    const after = new FileEntitlementStore(file);
    assert.deepEqual(await after.get('learner-1'), spent);
    assert.equal((await after.get('learner-1')).secondsUsed, 120);
  });

  test('an unreadable store still serves, starting where memory would have', async () => {
    const store = new FileEntitlementStore('/nonexistent/luvani/entitlements.json');
    const fresh = await store.get('learner-2');
    assert.equal(fresh.secondsUsed, 0, 'never a reason to refuse to serve');
  });
});
