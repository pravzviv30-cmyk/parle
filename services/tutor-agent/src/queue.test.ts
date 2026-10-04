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

import { CommandBudget, replayPlayout, TurnQueue } from './queue.ts';

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

test('overload never allocates an unbounded tail or rejects an SDK callback', async () => {
  const queue = new TurnQueue({ maxPending: 2 });
  const first = held();
  let calls = 0;
  const running = queue.run(first.work);
  const waiting = queue.run(async () => { calls += 1; });
  for (let i = 0; i < 1_000; i++) await assert.doesNotReject(queue.run(async () => { calls += 1; }));
  assert.equal(queue.pending, 2);
  first.finish(); await Promise.all([running, waiting]); await queue.idle();
  assert.equal(calls, 1);
});

test('leaving invalidates queued generation while the running provider is being cancelled', async () => {
  const queue = new TurnQueue();
  const first = held();
  const running = queue.run(first.work);
  let staleCalls = 0;
  const stale = queue.run(async () => { staleCalls += 1; });
  queue.clearPending();
  first.finish(); await Promise.all([running, stale]); await queue.idle();
  assert.equal(staleCalls, 0);
  await queue.run(async () => { staleCalls += 1; });
  assert.equal(staleCalls, 1, 'new-generation work remains usable');
});

test('presence cannot refill generating commands and leave/quiet mode remain reachable after exhaustion', () => {
  let now = 0;
  const budget = new CommandBudget(() => now);
  for (let i = 0; i < 16; i++) assert.equal(budget.allow('hear'), true);
  assert.equal(budget.allow('say'), false);
  assert.equal(budget.allow('typing'), true);
  assert.equal(budget.allow('leave'), true);
  assert.equal(budget.allow('mode'), true);
  for (let i = 16; i < 180; i++) { now += 2_000; assert.equal(budget.allow('say'), true); }
  now += 60_000;
  assert.equal(budget.allow('say'), false, 'session-wide cap survives refill');
  assert.equal(budget.allow('leave'), true);
});

test('cancelling held media releases its replay slot without waiting for playout', async () => {
  const queue = new TurnQueue({ maxPending: 1 });
  const media = held();
  const running = queue.run(signal => replayPlayout(media.work(), signal));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(queue.full, true);
  queue.clearPending();
  await running; await queue.idle();
  assert.equal(queue.full, false);
  media.finish();
});
