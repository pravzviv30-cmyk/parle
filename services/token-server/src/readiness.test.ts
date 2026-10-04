import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cachedReadiness } from './readiness.ts';
const healthy = { schema: true, redis: true, tutor: true, practice: true, maintenance: true, admission: true };
test('concurrent readiness callers share one probe and drain prevents admission', async () => {
  let calls = 0;
  const readiness = cachedReadiness(async () => { calls++; return healthy; });
  const results = await Promise.all(Array.from({ length: 30 }, () => readiness.state()));
  assert.ok(results.every(result => result.ready)); assert.equal(calls, 1);
  readiness.drain(); assert.equal((await readiness.state()).ready, false);
  assert.equal(calls, 1);
});
test('a blackholed dependency has a hard probe deadline and never reports ready', async () => {
  let signal: AbortSignal | undefined;
  const readiness = cachedReadiness(async stop => { signal = stop; return new Promise(() => {}); }, { timeoutMs: 5 });
  assert.equal((await readiness.state()).ready, false);
  assert.equal(signal?.aborted, true);
});
