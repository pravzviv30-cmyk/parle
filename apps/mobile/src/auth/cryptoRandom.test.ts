import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ensureAuthRandom, type AuthRandomValues } from './cryptoRandom.ts';

test('Supabase verifier generation has native secure randomness while existing crypto remains intact', () => {
  let calls = 0;
  const native: AuthRandomValues = (value) => { calls += 1; return value; };
  const target: { crypto?: { getRandomValues?: AuthRandomValues } } = {};
  ensureAuthRandom(target, native);
  target.crypto!.getRandomValues!(new Uint8Array(32));
  assert.equal(calls, 1);
  const original: AuthRandomValues = (value) => value;
  const existing = { crypto: { getRandomValues: original } };
  ensureAuthRandom(existing, native);
  assert.equal(existing.crypto.getRandomValues, original);
});
