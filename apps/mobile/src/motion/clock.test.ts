/**
 * Throttles and time limits read a clock that only goes forward.
 *
 * The tick throttle, the count's redraw cap, the web ring's redraw cap and the
 * busy pill's spinner limit each measure a gap between two moments. Measured on
 * the wall clock, a network time correction or a time zone change in the middle
 * of a gap opens or shuts it wrongly. The behaviour is driven here through the
 * two pure modules; the screens that move are read as text, because they load
 * the engine (motion.test.ts, rule 7).
 */

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { monotonicNow } from './clock.ts';
import { TICK_GAP_MS, createThrottle, realClock } from './hapticBeats.ts';

const original = Object.getOwnPropertyDescriptor(globalThis, 'performance');

/** Puts `value` where the code looks for `performance`, until the test ends. */
function setPerformance(value: unknown): void {
  Object.defineProperty(globalThis, 'performance', { value, configurable: true, writable: true, enumerable: true });
}

afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'performance', original);
});

const code = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);

describe('the motion clock', () => {
  test('throttles and the spinner limit read a clock that only goes forward', (t) => {
    // The forward clock is the one read, by clock.ts and by the beats' own copy.
    let forward = 1000;
    setPerformance({ now: () => forward });
    assert.equal(monotonicNow(), 1000);
    assert.equal(realClock.now(), 1000);

    // A tick throttle on the real clock keeps time when the wall clock jumps back an hour.
    let wall = Date.parse('2026-10-05T12:00:00Z');
    t.mock.method(Date, 'now', () => wall);
    const gate = createThrottle(TICK_GAP_MS);
    assert.equal(gate(), true, 'the first tick is refused');
    forward += TICK_GAP_MS - 1;
    assert.equal(gate(), false, 'two ticks closer than the gap both fire');
    wall -= 60 * 60 * 1000;
    forward += 1;
    assert.equal(gate(), true, 'a wall clock set back an hour shuts the throttle');

    // Where there is no forward clock, the wall clock stands in, read at each call.
    setPerformance(undefined);
    assert.equal(monotonicNow(), wall);
    assert.equal(realClock.now(), wall);
    setPerformance({});
    assert.equal(monotonicNow(), wall, 'a performance object with no now() is trusted');
    assert.equal(realClock.now(), wall, 'the beats trust a performance object with no now()');

    // Every gap the moving parts measure is on that clock.
    for (const file of ['CountUp.tsx', 'MorphButton.tsx', 'ProgressRing.web.tsx']) {
      const body = code(file);
      assert.doesNotMatch(body, /\bDate\.now\(/, `motion/${file} measures a gap on the wall clock`);
      assert.match(body, /import \{ monotonicNow \} from '\.\/clock\.ts';/, `motion/${file} does not read the forward clock`);
    }
    assert.match(code('MorphButton.tsx'), /busySince\.current = monotonicNow\(\);/, 'the spinner limit starts on another clock');
    assert.match(code('MorphButton.tsx'), /monotonicNow\(\) - since >= MORPH\.spinMax/, 'the spinner limit is measured on another clock');
  });
});
