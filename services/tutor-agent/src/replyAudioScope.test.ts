import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReadableStream } from 'node:stream/web';
import { ReplyAudioScope } from './replyAudioScope.ts';

test('a first frame is attributed only to its guarded dispatch scope', async () => {
  const scope = new ReplyAudioScope<number>(); const seen: string[] = [];
  let scene!: ReadableStream<number>; let opener!: ReadableStream<number>;
  scope.dispatch({ firstFrame: () => seen.push('scene') }, () => {
    const held = Promise.resolve().then(() => scope.observe(new ReadableStream({ start(controller) { controller.enqueue(3); controller.enqueue(4); controller.close(); } })));
    void held.then(stream => { scene = stream; });
    return { id: 'scene-handle', interrupted: false };
  });
  opener = scope.observe(new ReadableStream({ start(controller) { controller.enqueue(1); controller.close(); } }));
  await Promise.resolve(); await Promise.resolve();
  const collect = async (stream: ReadableStream<number>) => { const frames: number[] = []; for await (const frame of stream) frames.push(frame); return frames; };
  assert.deepEqual(await collect(opener), [1]); assert.deepEqual(await collect(scene), [3, 4]); assert.deepEqual(seen, ['scene']);
});

test('missing speech handle never change the frame stream', async () => {
  const scope = new ReplyAudioScope<number>(); let stream!: ReadableStream<number>; let marks = 0;
  scope.dispatch({ firstFrame: () => { marks++; throw new Error('sink'); } }, () => { stream = scope.observe(new ReadableStream({ start(c) { c.enqueue(9); c.close(); } })); return undefined; });
  for await (const value of stream) assert.equal(value, 9);
  assert.equal(marks, 0);
});

test('observation failure preserves audio and cancellation reaches the upstream stream', async () => {
  const scope = new ReplyAudioScope<number>(); let stream!: ReadableStream<number>; let marks = 0; let cancelled = false;
  scope.dispatch({ firstFrame: () => { marks++; throw new Error('sink'); } }, () => {
    stream = scope.observe(new ReadableStream({ start(c) { c.enqueue(5); }, cancel() { cancelled = true; } }));
    return { id: 'guarded', interrupted: false };
  });
  const reader = stream.getReader(); assert.deepEqual(await reader.read(), { value: 5, done: false });
  await reader.cancel(); await Promise.resolve(); assert.equal(marks, 1); assert.equal(cancelled, true);
});
