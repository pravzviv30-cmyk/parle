import { test } from 'node:test';
import assert from 'node:assert/strict';
import { observeSession } from './sessionBootstrap.ts';
import type { AuthUser } from './types.ts';

const user: AuthUser = { id: 'existing-account', email: null, provider: 'password' };
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function fixture() {
  let resolve!: (value: AuthUser | null) => void;
  let reject!: (error: Error) => void;
  const pending = new Promise<AuthUser | null>((yes, no) => { resolve = yes; reject = no; });
  let event!: (value: AuthUser | null) => void;
  let recovery!: () => void;
  let stopped = 0;
  let recoveries = 0;
  const seen: (AuthUser | null)[] = [];
  const stop = observeSession({ getSession: () => pending,
    onAuthStateChange: cb => { event = cb; return () => stopped++; },
    onPasswordRecovery: cb => { recovery = cb; return () => stopped++; },
  }, value => seen.push(value), () => recoveries++);
  return { resolve, reject, event, recovery, seen, stop, stopped: () => stopped, recoveries: () => recoveries };
}

test('a retained session restores an existing identity', async () => {
  const f = fixture(); f.resolve(user); await tick();
  assert.deepEqual(f.seen, [user]); f.stop();
});
test('logout cannot be overwritten by a late retained-session read', async () => {
  const f = fixture(); f.event(null); f.resolve(user); await tick();
  assert.deepEqual(f.seen, [null]); f.stop();
});
test('a live account switch outranks cached credentials', async () => {
  const f = fixture(); const next = {...user, id: 'next-account'};
  f.event(next); f.resolve(user); await tick();
  assert.deepEqual(f.seen, [next]); f.stop();
});
test('failed storage settles signed out unless a live session already arrived', async () => {
  const f = fixture(); f.reject(new Error('unavailable')); await tick();
  assert.deepEqual(f.seen, [null]); f.stop();
  const g = fixture(); g.event(user); g.reject(new Error('unavailable')); await tick();
  assert.deepEqual(g.seen, [user]); g.stop();
});
test('unmount unsubscribes and ignores late session and recovery callbacks', async () => {
  const f = fixture(); f.recovery(); assert.equal(f.recoveries(), 1);
  f.stop(); f.event(user); f.recovery(); f.resolve(user); await tick();
  assert.equal(f.stopped(), 2); assert.deepEqual(f.seen, []); assert.equal(f.recoveries(), 1);
});
