/**
 * The retry schedule, proved without sleeping for a single millisecond.
 *
 * That is the whole reason the clock and the randomness are injected. A backoff tested
 * by waiting is a test nobody runs, and an untested backoff is where a hot retry loop
 * lives: one wrong `Math.min` and a phone with no signal spends its battery on a
 * connection it does not have.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  BACKOFF_BASE_MS,
  BACKOFF_CAP_MS,
  backoffCeiling,
  backoffDelay,
  createBackoff,
} from './backoff.ts';

/** A random source that reads from a script and then repeats its last value. */
function draws(sequence: readonly number[]): () => number {
  let at = 0;
  return () => sequence[Math.min(at++, sequence.length - 1)] ?? 0;
}

describe('sync backoff — how long a failing device waits', () => {
  test('retries space out exponentially with jitter and never exceed the cap', () => {
    // The ceiling doubles from one second and stops at a minute. This is the
    // "exponentially" half, and it is a property of the attempt number alone.
    const ceilings = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((attempt) => backoffCeiling(attempt));
    assert.deepEqual(ceilings, [1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000, 60_000]);
    assert.equal(BACKOFF_BASE_MS, 1_000);
    assert.equal(BACKOFF_CAP_MS, 60_000);

    // The jitter half: for any attempt, any draw lands inside `[0, ceiling]`, and the
    // ceiling itself never passes the cap however many failures pile up.
    for (const attempt of [0, 1, 5, 10, 40, 4_000]) {
      for (const draw of [0, 0.01, 0.25, 0.5, 0.999, 1]) {
        const delay = backoffDelay(attempt, draw);
        assert.equal(Number.isFinite(delay), true, `attempt ${attempt} drew a non-finite delay`);
        assert.equal(delay >= 0, true, `attempt ${attempt} drew a negative delay`);
        assert.equal(delay <= backoffCeiling(attempt), true, `attempt ${attempt} drew past its own ceiling`);
        assert.equal(delay <= BACKOFF_CAP_MS, true, `attempt ${attempt} drew past the cap`);
      }
    }

    // And the same thing through the object the engine actually holds: eight consecutive
    // failures, one fixed sequence of draws, one exact list of waits. Nothing here is
    // approximate, which is what makes a regression in this file visible.
    let clock = 0;
    const backoff = createBackoff({
      random: draws([1, 1, 1, 0.5, 1, 1, 1, 1]),
      now: () => clock,
    });
    const waits = [0, 1, 2, 3, 4, 5, 6, 7].map(() => backoff.failed());
    assert.deepEqual(waits, [1_000, 2_000, 4_000, 4_000, 16_000, 32_000, 60_000, 60_000]);
    assert.equal(Math.max(...waits) <= BACKOFF_CAP_MS, true, 'a wait passed the cap');
    assert.equal(backoff.attempts(), 8);

    // Two devices that fail on the same beat do not come back on the same beat. Without
    // the jitter every phone in one tunnel retries in lockstep against a server that has
    // just come back up.
    const together = [0.11, 0.87].map((draw) => backoffDelay(4, draw));
    assert.notEqual(together[0], together[1], 'full jitter is what stops a synchronised retry wave');
  });

  test('a draw of nothing waits nothing, and a broken draw does not become a hot loop', () => {
    assert.equal(backoffDelay(3, 0), 0, 'the floor of full jitter is an immediate retry');
    assert.equal(backoffDelay(3, Number.NaN), 0, 'a NaN delay would make setTimeout fire at once, forever');
    assert.equal(backoffDelay(3, -5), 0);
    assert.equal(backoffDelay(3, 9), backoffCeiling(3), 'a draw above one is clamped, never multiplied out');
    assert.equal(backoffDelay(-2, 1), BACKOFF_BASE_MS, 'a negative attempt is the first attempt');
  });

  test('nothing waits before the first failure, and a success starts the ladder again', () => {
    let clock = 1_000;
    const backoff = createBackoff({ random: () => 1, now: () => clock });
    assert.equal(backoff.ready(), true, 'a device that has not failed may try immediately');
    assert.equal(backoff.readyAt(), null);

    backoff.failed();
    backoff.failed();
    assert.equal(backoff.attempts(), 2);
    assert.equal(backoff.readyAt(), 1_000 + 2_000, 'the wait is measured from the clock it was drawn on');
    assert.equal(backoff.ready(), false);

    clock += 2_000;
    assert.equal(backoff.ready(), true, 'the wait passed');

    backoff.succeeded();
    assert.equal(backoff.attempts(), 0, 'one good cycle clears the ladder');
    assert.equal(backoff.readyAt(), null);
    assert.equal(backoff.failed(), 1_000, 'the next failure starts again at the base, not where it left off');
  });

  test('coming back to the foreground clears the wait a learner did not choose', () => {
    let clock = 0;
    const backoff = createBackoff({ random: () => 1, now: () => clock });
    for (let failures = 0; failures < 6; failures += 1) backoff.failed();
    assert.equal(backoff.ready(), false, 'the device is deep in the ladder');

    backoff.resumed();
    assert.equal(backoff.ready(), true, 'a learner reopening the app is the best evidence conditions changed');
    assert.equal(backoff.attempts(), 0);
  });

  test('the ladder cannot be climbed into infinity', () => {
    let clock = 0;
    const backoff = createBackoff({ random: () => 1, now: () => clock });
    for (let failures = 0; failures < 5_000; failures += 1) {
      const delay = backoff.failed();
      assert.equal(Number.isFinite(delay), true, 'a delay stopped being a number');
      assert.equal(delay <= BACKOFF_CAP_MS, true, 'a delay passed the cap');
      clock += delay;
    }
    assert.equal(backoff.attempts() <= 30, true, 'the exponent is clamped, so 2 ** attempt stays finite');
  });

  test('the base and the cap can be narrowed for a caller that needs a tighter loop', () => {
    assert.equal(backoffCeiling(0, 50, 200), 50);
    assert.equal(backoffCeiling(3, 50, 200), 200);
    assert.equal(backoffDelay(3, 1, 50, 200), 200);
    const backoff = createBackoff({ random: () => 1, now: () => 0, baseMs: 50, capMs: 200 });
    assert.deepEqual([backoff.failed(), backoff.failed(), backoff.failed(), backoff.failed()], [50, 100, 200, 200]);
  });
});
