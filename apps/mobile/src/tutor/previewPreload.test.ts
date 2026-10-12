import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPreviewPreloader } from './previewPreload.ts';

const flush = () => new Promise<void>(resolve => setImmediate(resolve));

test('preview warmup loads only its bounded catalogue, shares leases, and releases on last exit', async () => {
  const events: string[] = [];
  const cache = createPreviewPreloader(['alexandre', 'emilie'] as const, {
    preload: async key => { events.push(`load:${key}`); },
    clear: async key => { events.push(`clear:${key}`); },
  });
  const leave = cache.retain();
  const otherLeave = cache.retain();
  await flush();
  assert.deepEqual(events, ['load:alexandre', 'load:emilie']);
  leave(); leave();
  await flush();
  assert.equal(events.length, 2, 'one chooser must not clear another chooser’s cache');
  otherLeave();
  await flush();
  assert.deepEqual(events.slice(2), ['clear:alexandre', 'clear:emilie']);
  cache.refresh('alexandre');
  await flush();
  assert.equal(events.length, 4, 'a late completion cannot warm a hidden chooser');
});

test('a quick return during preload retains the new warm cache', async () => {
  const events: string[] = [];
  let finish = () => {};
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const cache = createPreviewPreloader(['alexandre'], {
    preload: async key => { events.push(`load:${key}`); await pending; },
    clear: async key => { events.push(`clear:${key}`); },
  });
  const leave = cache.retain();
  await flush();
  leave();
  const leaveAgain = cache.retain();
  finish();
  await flush();
  assert.ok(!events.some(event => event.startsWith('clear:')), 'old cleanup cannot clear a fresh foreground lease');
  leaveAgain();
  await flush();
  assert.equal(events.at(-1), 'clear:alexandre');
});

test('leaving during preload clears the late result without leaving a hidden player cache', async () => {
  const events: string[] = [];
  let finish = () => {};
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const cache = createPreviewPreloader(['alexandre'], {
    preload: async () => { events.push('load'); await pending; events.push('loaded'); },
    clear: async () => { events.push('clear'); },
  });
  const leave = cache.retain();
  await flush();
  leave();
  await flush();
  assert.deepEqual(events, ['load'], 'clearing before a pending preload resolves would leak its late player');
  finish();
  await flush();
  assert.deepEqual(events, ['load', 'loaded', 'clear']);
});

test('failed preload remains optional and still clears after backgrounding', async () => {
  let clear = 0;
  const cache = createPreviewPreloader(['alexandre'], {
    preload: async () => { throw new Error('asset not cached yet'); },
    clear: async () => { clear++; },
  });
  const leave = cache.retain();
  await flush();
  leave();
  await flush();
  assert.equal(clear, 1);
});
