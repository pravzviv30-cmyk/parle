import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NativeEvalBudget, nativeEvalRemaining, NATIVE_EVAL_BACKEND_CALLS } from './nativeEvalPolicy.ts';

test('native comparison rejects unsigned-shaped, stale and oversized lifetimes', () => {
  for (const metadata of [undefined, '{}', '{', '{"nativeEvalExpiresAt":"2000"}', '{"nativeEvalExpiresAt":0}', '{"nativeEvalExpiresAt":9999999}']) {
    assert.equal(nativeEvalRemaining(metadata, 1000), 0);
  }
  assert.equal(nativeEvalRemaining('{"nativeEvalExpiresAt":301000}', 1000), 300000);
});
test('native comparison allows one bounded backend request, never duplicate billing', () => {
  const budget = new NativeEvalBudget();
  assert.equal(budget.acquire('first'), true);
  assert.equal(budget.acquire('busy'), false);
  budget.release();
  assert.equal(budget.acquire('first'), false);
  for (let i = 1; i < NATIVE_EVAL_BACKEND_CALLS; i++) {
    assert.equal(budget.acquire(String(i)), true);
    budget.release();
  }
  assert.equal(budget.acquire('over-limit'), false);
});
test('production and comparison explicitly disable SDK session recording', () => {
  for (const file of ['agent.ts', 'nativeEvalAgent.ts']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /session\.start\([\s\S]*?record: false/);
  }
});
