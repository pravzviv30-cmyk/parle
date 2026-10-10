import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ENTRANCE_DELAY_MS,
  FIRST_LAUNCH_STILL_MS,
  launchCanStart,
  createVisibleDelay,
  LAUNCH_MARK_SIZE,
  MAX_LAUNCH_MS,
  RING_TURN_MS,
  launchMayLeave,
} from './launchTiming.ts';
import { FRESH_DEVICE_BUDGET_MS } from '../app/freshDevice.ts';

/** motion.ts imports react-native, so its settle duration is read as text. */
const SETTLE_MS = Number(
  /export const SETTLE_MS = (\d+);/.exec(readFileSync(new URL('../motion.ts', import.meta.url), 'utf8'))?.[1],
);

describe('the launch leaves when the app is ready and the name has arrived', () => {
  test('the launch leaves only when the app is ready and the name has arrived, or at the cap', () => {
    assert.equal(launchMayLeave({ appReady: false, entered: false, capped: false }), false);
    assert.equal(launchMayLeave({ appReady: true, entered: false, capped: false }), false, 'the name was cut off mid-arrival');
    assert.equal(launchMayLeave({ appReady: false, entered: true, capped: false }), false, 'the launch left onto a loading app');
    assert.equal(launchMayLeave({ appReady: true, entered: true, capped: false }), true);
    assert.equal(launchMayLeave({ appReady: false, entered: false, capped: true }), true, 'a stuck load hid behind the mark past the cap');
  });

  test('a fast launch waits for the name for well under a second, and a slow one not at all', () => {
    assert.ok(Number.isFinite(SETTLE_MS) && SETTLE_MS > 0, 'motion.ts has no SETTLE_MS to read');
    // The most a ready app can wait for the brand moment: the beat before the
    // name, then one settle. Past that, the wait is the app's own.
    assert.ok(ENTRANCE_DELAY_MS + SETTLE_MS <= 700, `the name takes ${ENTRANCE_DELAY_MS + SETTLE_MS}ms to arrive, which a ready app waits for`);
  });

  test('the cap sits above the fresh-device wait, the longest wait the app makes on purpose', () => {
    assert.ok(
      MAX_LAUNCH_MS >= FRESH_DEVICE_BUDGET_MS + 4_000,
      `a fresh device can wait ${FRESH_DEVICE_BUDGET_MS}ms for its learning; the launch gives up at ${MAX_LAUNCH_MS}ms`,
    );
    assert.ok(MAX_LAUNCH_MS <= 15_000, 'the launch may hide a stuck load for too long');
  });

  test('the ring hums rather than spins, and the mark has a size worth seeing', () => {
    assert.ok(RING_TURN_MS >= 1800 && RING_TURN_MS <= 4000, `one turn takes ${RING_TURN_MS}ms`);
    assert.ok(LAUNCH_MARK_SIZE >= 96 && LAUNCH_MARK_SIZE <= 200, `the launch mark is ${LAUNCH_MARK_SIZE}pt`);
  });

  test('a ready first run waits for Get Started even after the loading cap', () => {
    assert.equal(launchMayLeave({ appReady: true, entered: true, capped: false, welcome: true, started: false }), false);
    assert.equal(launchMayLeave({ appReady: true, entered: true, capped: true, welcome: true, started: false }), false);
    assert.equal(launchMayLeave({ appReady: true, entered: true, capped: false, welcome: true, started: true }), true);
    assert.equal(launchMayLeave({ appReady: true, entered: false, capped: false, welcome: true, started: true }), false);
    assert.equal(launchMayLeave({ appReady: false, entered: true, capped: true, welcome: true, started: false }), true, 'a stuck load still reveals the app loading/error view');
  });
});


test('new learners wait 1.5 visible seconds; identity and motion preferences must resolve first', () => {
  assert.equal(FIRST_LAUNCH_STILL_MS, 1500);
  assert.equal(launchCanStart(null, false, true), false);
  assert.equal(launchCanStart(true, null, true), false);
  assert.equal(launchCanStart(true, false, false), false);
  assert.equal(launchCanStart(true, false, true), true);
  assert.equal(launchCanStart(false, false, false), true);
  assert.equal(launchCanStart(true, true, false), true);
  assert.equal(launchMayLeave({appReady: true, entered: true, capped: false, welcome: null}), false);
});

test('background time does not consume the still introduction and disposal prevents completion', () => {
  let now = 0;
  let scheduled: (() => void) | null = null;
  let duration = 0;
  let completed = 0;
  const clock = { now: () => now, schedule: (run: () => void, ms: number) => {
    scheduled = run; duration = ms; return 1 as unknown as ReturnType<typeof setTimeout>;
  }, cancel: () => { scheduled = null; } };
  const delay = createVisibleDelay(1500, () => completed++, clock);
  delay.setActive(true);
  assert.equal(duration, 1500);
  now = 600;
  delay.setActive(false);
  assert.equal(scheduled, null);
  now = 60_000;
  delay.setActive(true);
  assert.equal(duration, 900);
  (scheduled as unknown as () => void)();
  assert.equal(completed, 1);
  delay.setActive(false); delay.setActive(true);
  assert.equal(completed, 1);
  const cancelled = createVisibleDelay(1500, () => completed++, clock);
  cancelled.setActive(true);
  const stale = scheduled;
  cancelled.dispose();
  (stale as unknown as () => void)();
  assert.equal(completed, 1);
});
