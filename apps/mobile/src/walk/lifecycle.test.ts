import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareWalk } from './lifecycle.ts';

test('Walk subscribes before starting and an interruption ends exactly once', async () => {
  const order: string[] = []; let interrupt!: () => void;
  const gate = prepareWalk({ subscribe: callback => { order.push('subscribe'); interrupt = callback; return () => order.push('unsubscribe'); }, ready: () => { order.push('ready'); return true; } }, { start: async () => { order.push('start'); }, end: () => { order.push('end'); } });
  assert.equal(await gate.started, true); assert.deepEqual(order, ['subscribe', 'ready', 'start']);
  interrupt(); interrupt(); gate.close(); assert.deepEqual(order, ['subscribe', 'ready', 'start', 'end', 'unsubscribe']);
});

test('Walk refuses a pre-existing interruption and a missing observer before a grant', async () => {
  let starts = 0; let ends = 0;
  for (const module of [null, { subscribe: () => () => {}, ready: () => false }]) {
    const gate = prepareWalk(module, { start: async () => { starts++; }, end: () => { ends++; } });
    assert.equal(await gate.started, false); gate.close();
  }
  assert.equal(starts, 0); assert.equal(ends, 0);
});

test('an interruption during readiness never starts and leaving during start never resumes', async () => {
  let starts = 0; let ends = 0; let interrupt!: () => void;
  const gate = prepareWalk({ subscribe: callback => { interrupt = callback; return () => {}; }, ready: () => { interrupt(); return true; } }, { start: async () => { starts++; }, end: () => { ends++; } });
  assert.equal(await gate.started, false); assert.equal(starts, 0); assert.equal(ends, 0);
  let finish!: () => void;
  const pending = prepareWalk({ subscribe: () => () => {}, ready: () => true }, { start: () => { starts++; return new Promise<void>(resolve => { finish = resolve; }); }, end: () => { ends++; } });
  await Promise.resolve(); pending.close(); finish(); assert.equal(await pending.started, false); assert.equal(ends, 1);
});

test('Walk disposes its observer when native readiness throws', async () => {
  let disposed = 0; let started = false;
  const gate = prepareWalk({ subscribe: () => () => { disposed++; }, ready: () => { throw new Error('native'); } }, { start: async () => { started = true; }, end: () => {} });
  assert.equal(await gate.started, false); gate.close(); assert.equal(disposed, 1); assert.equal(started, false);
});

test('an interruption epoch missed during lock ends Walk when JavaScript resumes', async () => {
  let epoch = 0; let ends = 0;
  const began = epoch;
  const gate = prepareWalk({ subscribe: () => () => {}, ready: () => epoch === began }, { start: async () => {}, end: () => { ends++; } });
  assert.equal(await gate.started, true);
  epoch++; // A call began and ended while no JavaScript callback was delivered.
  gate.check(); gate.check(); assert.equal(ends, 1);
});
