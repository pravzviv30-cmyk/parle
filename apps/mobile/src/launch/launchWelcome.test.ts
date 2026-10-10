import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLaunchWelcome } from './launchWelcome.ts';

test('first-run welcome requests reach late subscribers and clear on leaving onboarding', () => {
  const welcome = createLaunchWelcome();
  welcome.set(true);
  const seen: (boolean | null)[] = [];
  const stop = welcome.subscribe(value => seen.push(value));
  assert.deepEqual(seen, [true]);
  welcome.set(true);
  welcome.set(false);
  assert.deepEqual(seen, [true, false]);
  stop();
  welcome.set(true);
  assert.deepEqual(seen, [true, false]);
  assert.equal(welcome.current(), true);
});

test('identity is unknown until the gate resolves it', () => {
  const welcome = createLaunchWelcome();
  assert.equal(welcome.current(), null);
});
