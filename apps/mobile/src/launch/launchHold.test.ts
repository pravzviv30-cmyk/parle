import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createLaunchHolds, SETTLE_GAP_MS } from './launchHold.ts';

/** A clock the test turns by hand, so "nothing held for the gap" is exact. */
function fakeClock() {
  let now = 0;
  let next = 1;
  const due = new Map<number, { at: number; run: () => void }>();
  return {
    schedule: (run: () => void, ms: number) => {
      const id = next++;
      due.set(id, { at: now + ms, run });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    cancel: (timer: ReturnType<typeof setTimeout>) => {
      due.delete(timer as unknown as number);
    },
    advance(ms: number) {
      now += ms;
      for (const [id, entry] of [...due]) {
        if (entry.at <= now) {
          due.delete(id);
          entry.run();
        }
      }
    },
    pending: () => due.size,
  };
}

describe('the launch waits for the app, and only for the app', () => {
  test('the app is ready once nothing has held the launch for the settle gap', () => {
    const clock = fakeClock();
    const holds = createLaunchHolds(clock.schedule, clock.cancel);
    const heard: boolean[] = [];
    holds.subscribe((ready) => heard.push(ready));
    const release = holds.hold();
    clock.advance(SETTLE_GAP_MS * 10);
    assert.equal(holds.ready(), false, 'a wait on screen let the launch go');
    release();
    clock.advance(SETTLE_GAP_MS - 1);
    assert.equal(holds.ready(), false, 'the launch went before the gap had passed');
    clock.advance(1);
    assert.equal(holds.ready(), true, 'nothing held the launch for the gap and it still waited');
    assert.deepEqual(heard, [false, true]);
    // The gap is the launch waiting on nothing at all, so it must stay far too
    // short to see.
    assert.ok(SETTLE_GAP_MS <= 200, `the settle gap is ${SETTLE_GAP_MS} ms, long enough to notice`);
  });

  test('one wait handing over to the next never reads as ready', () => {
    const clock = fakeClock();
    const holds = createLaunchHolds(clock.schedule, clock.cancel);
    const heard: boolean[] = [];
    holds.subscribe((ready) => heard.push(ready));
    // Inside one commit, the old wait's release and the new wait's hold land
    // together, so no settle timer is left to fire.
    const gate = holds.hold();
    gate();
    const first = holds.hold();
    assert.equal(clock.pending(), 0, 'a hand-over inside one commit left a settle timer running');
    // Across commits, as when an effect sets the state that mounts the next
    // wait, nothing holds for a few frames. Those frames are not readiness.
    const FEW_FRAMES_MS = 3 * 16;
    first();
    clock.advance(FEW_FRAMES_MS);
    const second = holds.hold();
    clock.advance(SETTLE_GAP_MS * 4);
    assert.deepEqual(heard, [false], 'a hand-over between two waits told the launch the app was ready');
    second();
    clock.advance(SETTLE_GAP_MS);
    assert.deepEqual(heard, [false, true], 'the launch was not told once the last wait had gone');
  });

  test('releasing a wait twice cannot release somebody else\'s', () => {
    const clock = fakeClock();
    const holds = createLaunchHolds(clock.schedule, clock.cancel);
    const mine = holds.hold();
    holds.hold();
    mine();
    mine();
    assert.equal(holds.holds(), 1, 'a double release took another wait\'s hold with it');
    clock.advance(SETTLE_GAP_MS * 2);
    assert.equal(holds.ready(), false);
  });

  test('a listener that joins late hears where things stand at once', () => {
    const clock = fakeClock();
    const holds = createLaunchHolds(clock.schedule, clock.cancel);
    clock.advance(0);
    holds.subscribe(() => {});
    clock.advance(SETTLE_GAP_MS);
    const heard: boolean[] = [];
    holds.subscribe((ready) => heard.push(ready));
    assert.deepEqual(heard, [true], 'a late listener was not told the app is already ready');
  });

  test('a wait that comes back after readiness takes it away again', () => {
    const clock = fakeClock();
    const holds = createLaunchHolds(clock.schedule, clock.cancel);
    const heard: boolean[] = [];
    holds.subscribe((ready) => heard.push(ready));
    clock.advance(SETTLE_GAP_MS);
    const release = holds.hold();
    assert.equal(holds.ready(), false);
    release();
    clock.advance(SETTLE_GAP_MS);
    assert.deepEqual(heard, [false, true, false, true]);
    assert.equal(clock.pending(), 0, 'a settle timer was left running');
  });
});
