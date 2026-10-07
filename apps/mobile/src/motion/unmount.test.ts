/**
 * Only a real unmount lands a primitive (motion/unmount.ts).
 *
 * StrictMode in development, and Fast Refresh after an edit, run an effect's
 * cleanup and then its body again at once. The landing waits for the wait the
 * guard is given, a microtask in the app, and lands only if nothing came back.
 * Driven here with a wait the test releases by hand, and once with the real
 * microtask, in the order React runs them.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createUnmountGuard } from './unmount.ts';

/** A wait the test releases by hand. */
function manualWait() {
  const queue: (() => void)[] = [];
  return {
    wait: (run: () => void) => {
      queue.push(run);
    },
    flush: () => {
      for (const run of queue.splice(0)) run();
    },
  };
}

describe('landing on unmount', () => {
  test("a one-shot lands on a real unmount and not on StrictMode's unmount and remount", async () => {
    // StrictMode's rehearsal: body, cleanup, body, all before the wait ends.
    const rehearsal = manualWait();
    const rehearsed = createUnmountGuard(rehearsal.wait);
    let landed = 0;
    rehearsed.mounted();
    rehearsed.unmounted(() => (landed += 1));
    rehearsed.mounted();
    rehearsal.flush();
    assert.equal(landed, 0, 'a rehearsed unmount landed the one-shot for good');

    // The same component's real unmount, later, still lands, once.
    rehearsed.unmounted(() => (landed += 1));
    rehearsal.flush();
    assert.equal(landed, 1, 'a real unmount after a rehearsal does not land');

    // A plain mount and unmount lands once.
    const plain = manualWait();
    const once = createUnmountGuard(plain.wait);
    let plainLanded = 0;
    once.mounted();
    once.unmounted(() => (plainLanded += 1));
    assert.equal(plainLanded, 0, 'the landing did not wait to see whether the caller came back');
    plain.flush();
    assert.equal(plainLanded, 1, 'a real unmount does not land');

    // Two cleanups in one task, with a remount between (Fast Refresh, then the screen closing): one landing, the last one.
    const twice = manualWait();
    const refreshed = createUnmountGuard(twice.wait);
    const calls: string[] = [];
    refreshed.mounted();
    refreshed.unmounted(() => calls.push('first'));
    refreshed.mounted();
    refreshed.unmounted(() => calls.push('second'));
    twice.flush();
    assert.deepEqual(calls, ['second'], 'one unmount landed twice, or an earlier cleanup landed over the later one');

    // The real wait is a microtask: a remount in the same task is seen, and a real unmount lands before the next task.
    const real = createUnmountGuard();
    let realLanded = 0;
    real.mounted();
    real.unmounted(() => (realLanded += 1));
    real.mounted();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(realLanded, 0, 'the real wait landed a rehearsed unmount');
    real.unmounted(() => (realLanded += 1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(realLanded, 1, 'the real wait never lands a real unmount');
  });
});
