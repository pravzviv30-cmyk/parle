import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { billingChanged, onBillingChange } from './billingChanges.ts';

test('confirmed billing refresh invalidates game facts for only the current account', () => {
  const received: unknown[] = [];
  const offBroken = onBillingChange(() => { throw new Error('unmounted view'); });
  const off = onBillingChange((change) => received.push(change));
  billingChanged({ userId: 'learner', owner: 4 });
  assert.deepEqual(received, [{ userId: 'learner', owner: 4 }]);
  off(); offBroken();
  billingChanged({ userId: 'other', owner: 5 });
  assert.equal(received.length, 1);
  const client = readFileSync(new URL('./client.ts', import.meta.url), 'utf8');
  assert.match(client, /billingChanged\(\{ userId, owner \}\)/);
  assert.ok(client.indexOf('billingChanged({ userId, owner })') > client.indexOf('!PLAN_IDS.includes(plan)'));
  const provider = readFileSync(new URL('../game/GameProvider.tsx', import.meta.url), 'utf8');
  assert.match(provider, /owner !== scopeGeneration\(\) \|\| userId !== activeUserId\(\)/);
  assert.match(provider, /loadBilling\(true\)/);
  assert.match(provider, /offBilling\(\)/);
});
