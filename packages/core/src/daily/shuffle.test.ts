import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { nextPosition, shuffledOrder, shuffledPick } from './shuffle.ts';

describe('a pool dealt in an order of its own — F450', () => {
  test('the deal is a permutation: nothing added, nothing dropped, nothing repeated', () => {
    // The contract `mixQueue` already states for the drill queue, held here for
    // the same reason: a learner walking the pool must meet every situation
    // before meeting any of them twice, and that is only true if the deal is a
    // reordering rather than a sampling.
    for (const size of [1, 2, 7, 119, 500]) {
      const order = shuffledOrder(size, 12345);
      assert.equal(order.length, size, `a pool of ${size} dealt ${order.length} cards`);
      assert.deepEqual([...order].sort((a, b) => a - b), Array.from({ length: size }, (_, i) => i),
        `the deal of ${size} is not a permutation of its own indices`);
    }
  });

  test('the same seed deals the same order, and a different seed does not', () => {
    // Seeded rather than random, so two devices agree, a test can assert on it,
    // and a learner's place in the walk is one integer instead of a set of
    // everything they have already seen.
    assert.deepEqual(shuffledOrder(50, 99), shuffledOrder(50, 99));
    assert.notDeepEqual(shuffledOrder(50, 99), shuffledOrder(50, 100));
  });

  test('it actually shuffles, rather than handing back the pool in order', () => {
    // The test that would have caught a stubbed implementation. A permutation
    // check alone passes for the identity permutation.
    const order = shuffledOrder(200, 7);
    const inPlace = order.filter((value, index) => value === index).length;
    assert.ok(inPlace < 20, `${inPlace} of 200 cards did not move, so this is barely a shuffle`);
  });

  test('walking the whole pool meets every item exactly once, then comes round', () => {
    const pool = Array.from({ length: 60 }, (_, i) => `item-${i}`);
    const seen = new Set<string>();
    let position = 0;
    for (let i = 0; i < pool.length; i += 1) {
      const item = shuffledPick(pool, 4242, position);
      assert.ok(item !== null, 'the walk ran off the end of the pool');
      seen.add(item);
      position = nextPosition(position, pool.length);
    }
    assert.equal(seen.size, pool.length, 'one turn of the pool showed the same item twice');
    assert.equal(position, 0, 'the walk did not come back round to where it started');
  });

  test('an empty pool draws nothing rather than throwing behind a rendered screen', () => {
    assert.equal(shuffledPick([], 1, 0), null);
    assert.deepEqual(shuffledOrder(0, 1), []);
    assert.deepEqual(shuffledOrder(-5, 1), []);
    assert.equal(nextPosition(3, 0), 0, 'an empty pool produced a position into it');
  });

  test('a corrupt stored position or seed still draws a card', () => {
    // Both can only arrive from a value somebody edited or a partial write, and
    // a card that will not render is worse than a card showing something.
    const pool = ['a', 'b', 'c'];
    for (const bad of [-4, Number.NaN, 2.7, Number.POSITIVE_INFINITY]) {
      assert.ok(shuffledPick(pool, 1, bad) !== null, `a position of ${bad} drew nothing`);
      assert.ok(shuffledPick(pool, bad, 0) !== null, `a seed of ${bad} drew nothing`);
      assert.ok(Number.isInteger(nextPosition(bad, pool.length)), `a position of ${bad} produced a fractional step`);
    }
  });

  test('a position past the end wraps rather than falling off it', () => {
    const pool = ['a', 'b', 'c'];
    assert.equal(shuffledPick(pool, 8, 0), shuffledPick(pool, 8, 3));
    assert.equal(shuffledPick(pool, 8, 1), shuffledPick(pool, 8, 4));
  });

  test('it reads no clock and no global, so a test can hand it every input', () => {
    // The rule the whole daily surface keeps: `pick.ts` says a day rule that
    // cannot be tested across a boundary is a rule nobody trusts. Same here.
    const realRandom = Math.random;
    const realNow = Date.now;
    Math.random = () => { throw new Error('shuffle reached for Math.random'); };
    Date.now = () => { throw new Error('shuffle reached for a clock'); };
    try {
      assert.equal(shuffledOrder(20, 3).length, 20);
      assert.ok(shuffledPick(['a', 'b'], 3, 1) !== null);
    } finally {
      Math.random = realRandom;
      Date.now = realNow;
    }
  });
});
