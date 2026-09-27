/**
 * The active clock as a screen holds it.
 *
 * `createActiveClock` is the whole behaviour and is pure, so it is walked here
 * with an injected clock: no real two-minute sleeps. `useActiveClock` is the
 * thin React wrapper that feeds it focus and AppState, and react-native cannot
 * load under `node --test`, so its wiring is read from source the same way the
 * rest of this app's screen tests are.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTIVE_CUTOFF_MS, createActiveClock } from './activeTime.ts';

function fakeTime(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms), set: (ms: number) => (t = ms) };
}

describe('createActiveClock', () => {
  test('opening earns nothing; typed touches earn their gaps', () => {
    const time = fakeTime();
    const clock = createActiveClock(ACTIVE_CUTOFF_MS.drill, time.now);
    assert.equal(clock.read(), 0, 'open alone');
    clock.touch();
    assert.equal(clock.read(), 0, 'first event adds nothing');
    time.advance(3_000);
    clock.touch();
    time.advance(4_000);
    clock.touch();
    assert.equal(clock.read(), 7_000);
  });

  test('an idle gap past the cutoff is left out whole', () => {
    const time = fakeTime();
    const clock = createActiveClock(ACTIVE_CUTOFF_MS.review, time.now);
    clock.touch();
    time.advance(2 * 60_000);
    clock.touch();
    time.advance(5_000);
    clock.touch();
    assert.equal(clock.read(), 5_000);
  });

  test('a negative clock step adds nothing', () => {
    const time = fakeTime(500_000);
    const clock = createActiveClock(ACTIVE_CUTOFF_MS.drill, time.now);
    clock.touch();
    time.set(400_000);
    clock.touch();
    assert.equal(clock.read(), 0);
  });

  test('losing focus or going to the background drops the anchor and ignores touches until back', () => {
    const time = fakeTime();
    const clock = createActiveClock(ACTIVE_CUTOFF_MS.drill, time.now);
    clock.touch();
    time.advance(5_000);
    clock.touch();
    clock.setLive(false);
    time.advance(10_000);
    clock.touch(); // an event that lands while backgrounded
    time.advance(10_000);
    clock.setLive(true);
    assert.equal(clock.read(), 5_000, 'nothing while away');
    clock.touch();
    assert.equal(clock.read(), 5_000, 'the first touch back is a fresh anchor');
    time.advance(2_000);
    clock.touch();
    assert.equal(clock.read(), 7_000);
  });

  test('a closed clock ignores late callbacks from a screen that has gone', () => {
    const time = fakeTime();
    const clock = createActiveClock(ACTIVE_CUTOFF_MS.convo, time.now);
    clock.touch();
    time.advance(5_000);
    clock.touch();
    clock.close();
    time.advance(1_000);
    clock.touch();
    clock.setLive(true);
    time.advance(1_000);
    clock.touch();
    assert.equal(clock.read(), 5_000);
  });

  test('restore carries a saved total and never credits the time between', () => {
    const time = fakeTime();
    const clock = createActiveClock(ACTIVE_CUTOFF_MS.drill, time.now);
    clock.touch();
    time.advance(8 * 3_600_000);
    clock.restore(42_000);
    assert.equal(clock.read(), 42_000);
    clock.touch();
    assert.equal(clock.read(), 42_000, 'the overnight gap is not credited');
    time.advance(3_000);
    clock.touch();
    assert.equal(clock.read(), 45_000);
  });

  test('restore refuses a malformed total and treats it as none', () => {
    const clock = createActiveClock(ACTIVE_CUTOFF_MS.drill, () => 1);
    clock.restore(Number.NaN);
    assert.equal(clock.read(), 0);
    clock.restore(-10);
    assert.equal(clock.read(), 0);
  });

  test('reset starts a new sitting from nothing', () => {
    const time = fakeTime();
    const clock = createActiveClock(ACTIVE_CUTOFF_MS.drill, time.now);
    clock.touch();
    time.advance(5_000);
    clock.touch();
    clock.reset();
    assert.equal(clock.read(), 0);
    time.advance(1_000);
    clock.touch();
    assert.equal(clock.read(), 0);
  });

  test('a clock created while not live ignores touches until it is told it is live', () => {
    const time = fakeTime();
    const clock = createActiveClock(ACTIVE_CUTOFF_MS.drill, time.now, false);
    clock.touch();
    time.advance(1_000);
    clock.touch();
    assert.equal(clock.read(), 0);
  });
});

describe('useActiveClock wiring', () => {
  const SOURCE = readFileSync(new URL('./useActiveClock.ts', import.meta.url), 'utf8');

  test('reads focus and the foreground state, and nothing ticks', () => {
    assert.match(SOURCE, /useIsFocused\(\)/, 'focus is not read');
    assert.match(SOURCE, /AppState\.addEventListener\('change'/, 'the background is not heard');
    assert.match(SOURCE, /AppState\.currentState === 'active'/, 'a remount while backgrounded would start live');
    assert.doesNotMatch(SOURCE, /setInterval|setTimeout|useState/, 'the clock must not tick or re-render');
    assert.doesNotMatch(SOURCE, /AsyncStorage|setItem/, 'the clock must never write to disk');
  });

  test('closes on unmount, so a callback from a closed screen earns nothing', () => {
    assert.match(SOURCE, /\.close\(\)/);
  });
});
