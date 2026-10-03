import assert from 'node:assert/strict';
import { test } from 'node:test';
import { finishLocalTake } from './finishLocalTake.ts';

test('an audio-mode failure after stop discards the finished local take', async () => {
  const removed: (string | null)[] = [];
  let uri: string | null = null;
  await assert.rejects(finishLocalTake({
    stop: async () => { uri = 'file://take.m4a'; }, uri: () => uri,
    resetAudio: async () => { throw new Error('audio mode failed'); },
    current: () => true, discard: value => { removed.push(value); },
  }), /audio mode failed/);
  assert.deepEqual(removed, ['file://take.m4a']);
});

test('an interrupted finish discards its take after a delayed audio reset', async () => {
  let current = true;
  let release!: () => void;
  let started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const removed: (string | null)[] = [];
  const finishing = finishLocalTake({
    stop: async () => {}, uri: () => 'file://late.m4a',
    resetAudio: async () => { started(); await waiting; },
    current: () => current, discard: value => { removed.push(value); },
  });
  await entered;
  current = false; release();
  assert.equal(await finishing, null);
  assert.deepEqual(removed, ['file://late.m4a']);
});

test('stop failure discards any partial take, while a successful finish keeps it for comparison', async () => {
  const removed: (string | null)[] = [];
  const base = { uri: () => 'file://take.m4a', resetAudio: async () => {}, current: () => true, discard: (value: string | null) => { removed.push(value); } };
  await assert.rejects(finishLocalTake({ ...base, stop: async () => { throw new Error('stop failed'); } }), /stop failed/);
  assert.deepEqual(removed, ['file://take.m4a']);
  removed.length = 0;
  assert.equal(await finishLocalTake({ ...base, stop: async () => {} }), 'file://take.m4a');
  assert.deepEqual(removed, []);
});


test('a refused automatic stop retries cleanup and resets recording mode before rejecting', async () => {
  const calls: string[] = [];
  await assert.rejects(finishLocalTake({
    stop: async () => { calls.push('stop'); throw new Error('stop refused'); },
    uri: () => 'file://partial.m4a',
    resetAudio: async () => { calls.push('reset'); },
    current: () => true, discard: value => { calls.push(`discard:${value}`); },
  }), /stop refused/);
  assert.deepEqual(calls, ['stop', 'stop', 'reset', 'discard:file://partial.m4a']);
});

test('a synchronous native stop failure is preserved while cleanup still runs', async () => {
  const calls:string[]=[];
  await assert.rejects(finishLocalTake({
    stop:()=>{calls.push('stop');throw new Error('native stop released');},
    uri:()=>{throw new Error('native URI released');},
    resetAudio:async()=>{calls.push('reset');}, current:()=>false,
    discard:uri=>{calls.push(`discard:${uri}`);},
  }),/native stop released/);
  assert.deepEqual(calls,['stop','stop','reset','discard:null']);
});
