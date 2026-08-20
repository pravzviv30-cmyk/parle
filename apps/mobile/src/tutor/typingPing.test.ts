import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { TYPING_PING_MS, shouldPingTyping } from './typingPing.ts';

describe('typing as presence — how often the app says the learner is still here', () => {
  test('the app notes typing at most once per window while the draft changes', () => {
    // A learner typing a sentence changes the draft dozens of times. The agent
    // needs to know they are there, once, not once per letter.
    const start = 1_000_000;
    assert.equal(shouldPingTyping(null, start), true, 'the first keystroke is the one that arrives before the rescue');

    let last = start;
    let pings = 0;
    // Thirty seconds of steady typing, a keystroke every eighth of a second.
    for (let t = start; t <= start + 30_000; t += 125) {
      if (shouldPingTyping(last, t)) {
        pings += 1;
        last = t;
      }
    }
    assert.ok(pings > 0, 'a learner typing for half a minute must not look silent');
    assert.ok(
      pings <= 30_000 / TYPING_PING_MS + 1,
      `half a minute of typing sent ${pings} pings, which is a keystroke feed and not a presence ping`,
    );
  });

  test('a learner still typing is never told to wait for the window to pass', () => {
    // The gap between pings has to stay under whatever clock the agent arms,
    // or a steady typist falls into the hole between two of them.
    assert.ok(TYPING_PING_MS < 12_000, 'a ping window at or past the silence window would let a typist be rescued');
  });

  test('a keystroke inside the window says nothing', () => {
    const last = 5_000;
    assert.equal(shouldPingTyping(last, last + 1), false, 'the next letter is not news');
    assert.equal(shouldPingTyping(last, last + TYPING_PING_MS - 1), false, 'still inside the window');
    assert.equal(shouldPingTyping(last, last + TYPING_PING_MS), true, 'the window is over, and they are still here');
  });

  test('a clock that jumps backwards does not silence the learner', () => {
    // A device settling its time, or a tab resuming after a suspend. Refusing
    // to ping until the clock caught up would leave a present learner looking
    // absent for as long as the jump.
    assert.equal(shouldPingTyping(9_000, 1_000), true, 'presence is not something to withhold over a clock');
  });
});
