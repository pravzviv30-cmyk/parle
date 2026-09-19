import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectBatch, reserveRequest, estimateCredits } from './daily-tutor-plan.mjs';
test('Flash rounds base credits before applying the professional voice multiplier', () => {
  assert.equal(estimateCredits('le dépaysement', 'alexandre'), 4);
  assert.equal(estimateCredits('le dépaysement', 'emilie'), 8);
  assert.equal(estimateCredits('un crème', 'sarah'), 4);
});
test('batch is balanced, deterministic and excludes every prior ID', () => {
  const items = Array.from({ length: 900 }, (_, i) => ({ id: String(i), tier: i % 3 + 1 }));
  const first = selectBatch(items);
  assert.deepEqual(first, selectBatch(items));
  assert.deepEqual([1, 2, 3].map(t => first.filter(i => i.tier === t).length), [67, 67, 66]);
  const second = selectBatch(items, 200, first.map(i => i.id));
  assert.equal(second.length, 200);
  assert.ok(second.every(i => !first.some(j => i.id === j.id)));
  assert.throws(() => selectBatch(items, 901));
});
test('credit reservations include in-flight work and never exceed the cap', () => {
  assert.equal(reserveRequest(24950, 50), 25000);
  assert.throws(() => reserveRequest(24950, 51));
  assert.throws(() => reserveRequest(NaN, 1));
  assert.throws(() => reserveRequest(0, -1));
  const first = reserveRequest(24900, 60);
  assert.throws(() => reserveRequest(first, 60));
});
