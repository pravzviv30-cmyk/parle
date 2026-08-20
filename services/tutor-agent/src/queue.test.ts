/**
 * The queue, away from a live session.
 *
 * Two of the three things it owns are timing questions that are painful to
 * reproduce through a whole conversation: whether work that is already in
 * flight is visible to whoever is deciding to queue more, and whether a
 * failed piece of work leaves the queue usable. Both are one line here.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { TurnQueue } from './queue.ts';

/** A piece of work that finishes when the test says so. */
function held(): { work: () => Promise<void>; finish: () => void; fail: (err: Error) => void } {
  let finish: () => void = () => {};
  let fail: (err: Error) => void = () => {};
  const gate = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  return { work: () => gate, finish, fail };
}

describe('a queue that can say whether it is in the middle of something', () => {
  test('a queue with nothing in it is not busy', () => {
    assert.equal(new TurnQueue().busy, false);
  });

  test('a queue is busy from the moment work is enqueued until it has settled', async () => {
    const queue = new TurnQueue();
    const turn = held();

    const running = queue.run(turn.work);
    assert.equal(queue.busy, true, 'a turn is being written right now');

    turn.finish();
    await running;
    await queue.idle();
    assert.equal(queue.busy, false, 'and the moment has passed');
  });

  test('work that failed still leaves the queue idle and usable', async () => {
    // A failed model call is a bad turn, not a dead session: if `busy` stuck
    // true here, every later rescue would stand down for the rest of the room.
    const queue = new TurnQueue();
    const turn = held();

    const running = queue.run(turn.work);
    turn.fail(new Error('socket hang up'));
    await assert.rejects(() => running);
    await queue.idle();

    assert.equal(queue.busy, false);
    await queue.run(async () => {});
    assert.equal(queue.busy, false, 'and the next turn ran on top of the failed one');
  });

  test('two pieces of work are busy until the second one has finished, not the first', async () => {
    const queue = new TurnQueue();
    const first = held();
    const second = held();

    const a = queue.run(first.work);
    const b = queue.run(second.work);
    first.finish();
    await a;
    assert.equal(queue.busy, true, 'the second is still to come');

    second.finish();
    await b;
    await queue.idle();
    assert.equal(queue.busy, false);
  });

  test('a wait that nothing interrupted still runs, and one that was overtaken does not', async () => {
    // The generation half of the fix, restated where it can be read: a rescue
    // captures the count when it is armed, and drops itself if anything has
    // been queued since — because a learner who started speaking is not stuck.
    const queue = new TurnQueue();
    const ran: string[] = [];

    const quiet = queue.generation;
    await queue.runIfCurrent(quiet, async () => void ran.push('rescue'));
    assert.deepEqual(ran, ['rescue']);

    const armed = queue.generation;
    await queue.run(async () => void ran.push('turn'));
    await queue.runIfCurrent(armed, async () => void ran.push('late rescue'));
    assert.deepEqual(ran, ['rescue', 'turn'], 'the late rescue dropped itself');
  });
});
