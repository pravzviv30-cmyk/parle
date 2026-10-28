import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConversationStartRequest } from './conversationStartRequest.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness() {
  const request = new ConversationStartRequest();
  const probes: ReturnType<typeof deferred<boolean>>[] = [];
  const opened: { screen: string; textMode?: boolean }[] = [];
  const state = { owner: 1, visible: true, checking: false, failed: false };
  const ports = {
    scope: () => state.owner, visible: () => state.visible,
    probe: () => { const next = deferred<boolean>(); probes.push(next); return next.promise; },
    checking: (value: boolean) => { state.checking = value; },
    failed: (value: boolean) => { state.failed = value; },
    open: (screen: 'Convo', params: { textMode?: boolean }) => { opened.push({ screen, ...params }); },
  };
  return { request, probes, opened, state, start: (typing = false) => request.start(ports, typing) };
}

test('a double tap probes once and preserves the chosen writing mode', async () => {
  const h = harness();
  const first = h.start(true);
  await h.start(false);
  assert.equal(h.probes.length, 1);
  assert.equal(h.state.checking, true);
  h.probes[0]!.resolve(true);
  await first;
  assert.deepEqual(h.opened, [{ screen: 'Convo', textMode: true }]);
  assert.equal(h.state.checking, false);
});

test('leaving and returning cannot let an old probe open a room or settle a newer start', async () => {
  const h = harness();
  const old = h.start();
  h.state.visible = false;
  h.request.invalidate();
  h.state.visible = true;
  const latest = h.start(true);
  h.probes[0]!.resolve(true);
  await old;
  assert.deepEqual(h.opened, []);
  assert.equal(h.state.checking, true, 'the newer start stays busy');
  await h.start();
  assert.equal(h.probes.length, 2, 'an older finally did not release the double-tap lock');
  h.probes[1]!.resolve(true);
  await latest;
  assert.deepEqual(h.opened, [{ screen: 'Convo', textMode: true }]);
});

test('a rejected abandoned probe cannot show an error over a newer start', async () => {
  const h = harness();
  const old = h.start();
  h.request.invalidate();
  const latest = h.start();
  h.probes[0]!.reject(new Error('old request failed'));
  await old;
  assert.equal(h.state.failed, false);
  assert.equal(h.state.checking, true);
  h.probes[1]!.resolve(true);
  await latest;
  assert.equal(h.opened.length, 1);
});

test('scope change, background or unmount suppresses both navigation and completion callbacks', async () => {
  for (const reason of ['account', 'background', 'unmount'] as const) {
    const h = harness();
    const pending = h.start();
    if (reason === 'account') h.state.owner += 1;
    else h.state.visible = false;
    h.request.invalidate();
    h.state.checking = false;
    h.probes[0]!.resolve(true);
    await pending;
    assert.deepEqual(h.opened, []);
    assert.equal(h.state.failed, false);
    assert.equal(h.state.checking, false);
  }
});

test('a failed current connection settles and supports a successful retry', async () => {
  const h = harness();
  const first = h.start();
  h.probes[0]!.resolve(false);
  await first;
  assert.equal(h.state.failed, true);
  assert.equal(h.state.checking, false);
  assert.equal(h.opened.length, 0);
  const retry = h.start();
  assert.equal(h.state.failed, false);
  h.probes[1]!.resolve(true);
  await retry;
  assert.equal(h.opened.length, 1);
});
