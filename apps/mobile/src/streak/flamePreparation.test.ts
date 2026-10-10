import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFlamePreparation } from './flamePreparation.ts';

test('delayed preparation cannot play, then readiness stays stable while the owner is waiting', () => {
  const flame = createFlamePreparation(true);
  const loading = flame.generation;
  assert.deepEqual(flame.start(true), { allowed: false, first: false });
  assert.equal(flame.readiness, null);
  assert.equal(flame.resolve(loading, true), true);
  for (let rerender = 0; rerender < 5; rerender += 1) {
    assert.equal(flame.resolve(loading, true), false);
    assert.equal(flame.setIgnition(true), false);
    assert.deepEqual(flame.start(false), { allowed: false, first: false });
    assert.equal(flame.readiness, true, 'a normal waiting render revoked readiness');
  }
  assert.deepEqual(flame.start(true), { allowed: true, first: true });
  assert.equal(flame.machine, 'Celebrate');
});

test('skip before readiness rejects results from the disposed celebration and prepares only idle', () => {
  for (const alreadyPrepared of [false, true]) {
  const flame = createFlamePreparation(true);
  const stale = flame.generation;
  if (alreadyPrepared) flame.resolve(stale, true);
  assert.equal(flame.setIgnition(false), true);
  assert.equal(flame.machine, 'Idle');
  assert.equal(flame.resolve(stale, true), false, 'a disposed player became ready');
  assert.equal(flame.resolve(stale, false), false, 'a disposed player failed its replacement');
  assert.equal(flame.readiness, null);
  assert.deepEqual(flame.start(true), { allowed: false, first: false });
  assert.equal(flame.resolve(flame.generation, true), true);
  assert.deepEqual(flame.start(true), { allowed: true, first: true });
  assert.equal(flame.machine, 'Idle', 'a skip ignited after loading finished');
  }
});

test('finishing the entrance keeps one started machine, and pausing does not replay its ignition', () => {
  const flame = createFlamePreparation(true);
  flame.resolve(flame.generation, true);
  flame.start(true);
  const generation = flame.generation;
  assert.equal(flame.setIgnition(false), false);
  assert.equal(flame.generation, generation);
  assert.equal(flame.machine, 'Celebrate');
  assert.deepEqual(flame.start(false), { allowed: false, first: false });
  assert.deepEqual(flame.start(true), { allowed: true, first: false });
  assert.equal(flame.readiness, true);
});

test('a bounded loading failure settles once and late success or rerenders cannot restart it', () => {
  for (const alreadyReady of [false, true]) {
    const flame = createFlamePreparation(true);
    const generation = flame.generation;
    if (alreadyReady) { flame.resolve(generation, true); flame.start(true); }
    assert.equal(flame.resolve(generation, false), true);
    assert.equal(flame.readiness, false);
    assert.equal(flame.resolve(generation, true), false);
    assert.equal(flame.resolve(generation, false), false);
    assert.equal(flame.setIgnition(false), false);
    assert.deepEqual(flame.start(true), { allowed: false, first: false });
  }
});
