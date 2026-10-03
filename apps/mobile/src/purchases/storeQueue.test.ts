import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storeQueue } from './storeQueue.ts';

test('another store account waits for the current sheet even when its operation rejects', async () => {
  const serial = storeQueue();
  let release: () => void = () => {};
  const seen: string[] = [];
  const first = serial(async () => {
    seen.push('A login');
    await new Promise<void>(resolve => { release = resolve; });
    seen.push('A sheet closed');
    throw new Error('cancelled');
  });
  const refusal = assert.rejects(first, /cancelled/);
  const next = serial(async () => { seen.push('B login'); });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(seen, ['A login']);
  release();
  await Promise.all([refusal, next]);
  assert.deepEqual(seen, ['A login', 'A sheet closed', 'B login']);
});
