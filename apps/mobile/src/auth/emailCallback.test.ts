import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NATIVE_EMAIL_CALLBACK, observeEmailCallbacks, readEmailCallback } from './emailCallback.ts';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const callback = `${NATIVE_EMAIL_CALLBACK}?code=one-use&sb_flow_id=flow-1`;

test('email callback preserves the SDK flow slot and decodes the code once', () => {
  assert.deepEqual(readEmailCallback(callback), { code: 'one-use', flowId: 'flow-1' });
  assert.deepEqual(readEmailCallback(`${NATIVE_EMAIL_CALLBACK}?code=abc%252Fdef`), { code: 'abc%2Fdef' });
});

test('email callbacks reject foreign routes, provider errors, duplicate parameters and URL tokens', () => {
  for (const value of ['luvani://auth/callback?code=x', 'https://auth/email?code=x',
    `${NATIVE_EMAIL_CALLBACK}/?code=x`, `${NATIVE_EMAIL_CALLBACK}?code=x&code=y`,
    `${NATIVE_EMAIL_CALLBACK}?code=x&error=denied`, `${NATIVE_EMAIL_CALLBACK}?code=x&error_code=bad`,
    `${NATIVE_EMAIL_CALLBACK}?code=x&sb_flow_id=`, `${NATIVE_EMAIL_CALLBACK}?code=x&sb_flow_id=a&sb_flow_id=b`,
    `${NATIVE_EMAIL_CALLBACK}#access_token=secret`, `${NATIVE_EMAIL_CALLBACK}?code=x#refresh_token=secret`,
    `${NATIVE_EMAIL_CALLBACK}?code=`]) assert.equal(readEmailCallback(value), null, value);
});

test('warm and cold delivery of one email link exchange only once with the exact flow slot', async () => {
  let event!: (value: { url: string }) => void;
  let removed = 0;
  const calls: unknown[] = [];
  const stop = observeEmailCallbacks({ getInitialURL: async () => callback,
    addEventListener: (_, cb) => { event = cb; return { remove: () => { removed++; } }; },
  }, async (...args) => { calls.push(args); return { error: null }; }, () => assert.fail('unexpected failure'));
  event({ url: callback }); await tick();
  assert.deepEqual(calls, [['one-use', { flowId: 'flow-1' }]]);
  stop(); event({ url: `${NATIVE_EMAIL_CALLBACK}?code=late` }); await tick();
  assert.equal(removed, 1); assert.equal(calls.length, 1);
});

test('email callback failure is recoverable and never exposes provider contents', async () => {
  let event!: (value: { url: string }) => void;
  let failures = 0;
  let exchanges = 0;
  const stop = observeEmailCallbacks({ getInitialURL: async () => null,
    addEventListener: (_, cb) => { event = cb; return { remove() {} }; },
  }, async () => { exchanges++; throw new Error('private provider detail'); }, () => { failures++; });
  event({ url: 'luvani://auth/callback?code=oauth-owned' });
  event({ url: `${NATIVE_EMAIL_CALLBACK}?error=private-detail` });
  event({ url: callback }); await tick();
  assert.equal(exchanges, 1); assert.equal(failures, 2); stop();
});

test('unsubscribing suppresses a late launch URL and pending exchange error', async () => {
  let resolve!: (value: string) => void;
  let event!: (value: { url: string }) => void;
  let exchangeResolve!: (value: { error: unknown }) => void;
  let exchanges = 0;
  const stop = observeEmailCallbacks({ getInitialURL: () => new Promise(yes => { resolve = yes; }),
    addEventListener: (_, cb) => { event = cb; return { remove() {} }; },
  }, () => { exchanges++; return new Promise(yes => { exchangeResolve = yes; }); }, () => assert.fail('late failure'));
  event({ url: callback }); stop();
  resolve(`${NATIVE_EMAIL_CALLBACK}?code=late`); exchangeResolve({ error: 'expired' }); await tick();
  assert.equal(exchanges, 1);
});
