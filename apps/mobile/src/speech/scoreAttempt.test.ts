/** The score upload, run as shipped with its platform edges injected. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

import { consumeRecording } from './discardRecording.ts';

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<unknown>;
const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
async function shipped(name: string, symbol: string, dependencies: Record<string, unknown>) {
  const source = stripTypeScriptTypes(read(name).split('\n').filter(line => !line.startsWith('import ')).join('\n').replace(/^export /gm, ''));
  const names = Object.keys(dependencies);
  return new AsyncFunction(...names, `${source}\nreturn ${symbol};`)(...names.map(name => dependencies[name])) as Promise<(...args: unknown[]) => Promise<unknown>>;
}

test('a scoring upload that never answers ends as no verdict and the take is removed', async () => {
  // F1145: React Native's Android client has no timeout of its own, so a
  // stalled scorer kept the sound check on "Checking the sound…" and the take on disk.
  const deadline = new AbortController();
  const asked: number[] = [];
  let entered!: () => void;
  const uploading = new Promise<void>(resolve => { entered = resolve; });
  const score = await shipped('./scoreAttempt.ts', 'scoreRecordedAttempt', {
    Platform: { OS: 'ios' },
    File: class { bytes() { return Promise.resolve(new Uint8Array([1, 2, 3])); } },
    authHeaders: async () => ({}),
    TOKEN_SERVER: 'https://tokens.invalid',
    AbortSignal: { timeout: (ms: number) => { asked.push(ms); return deadline.signal; } },
    fetch: (_url: string, init: RequestInit) => {
      entered();
      // A scorer that never answers: only an abort ends it.
      return new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('timed out', 'TimeoutError')), { once: true }));
    },
  });
  const removed: string[] = [];
  const take = consumeRecording('file://take.m4a', uri => score('learner', uri, 'Un café, s’il vous plaît.'), { remove: uri => removed.push(uri) });
  await uploading;
  deadline.abort();
  const settled = await Promise.race([take, new Promise(resolve => setTimeout(() => resolve('still waiting'), 50))]);
  assert.equal(settled, null, 'the upload hangs past its deadline');
  assert.deepEqual(removed, ['file://take.m4a']);
  assert.deepEqual(asked, [12_000], 'the deadline matches the other speech uploads');
});

test('the upload deadline starts at the upload, not while the sign-in headers are fetched', async () => {
  // A slow token refresh must not eat the scorer's 12 seconds.
  const order: string[] = [];
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const score = await shipped('./scoreAttempt.ts', 'scoreRecordedAttempt', {
    Platform: { OS: 'ios' },
    File: class { bytes() { return Promise.resolve(new Uint8Array([1, 2, 3])); } },
    authHeaders: async () => { await held; order.push('headers'); return {}; },
    TOKEN_SERVER: 'https://tokens.invalid',
    AbortSignal: { timeout: () => { order.push('deadline'); return new AbortController().signal; } },
    fetch: async () => { order.push('upload'); return new Response('{}', { status: 500 }); },
  });
  const done = score('learner', 'file://take.m4a', 'Bonjour.');
  for (let i = 0; i < 6; i++) await Promise.resolve();
  release();
  assert.equal(await done, null);
  assert.deepEqual(order, ['headers', 'deadline', 'upload']);
});
