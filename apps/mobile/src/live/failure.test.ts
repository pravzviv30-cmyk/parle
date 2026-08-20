import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { classifyFailure, failureCopy, TokenServerError, type LiveFailure } from './failure.ts';

/**
 * Every failure mode, listed once. The `satisfies` makes typecheck fail if a
 * twelfth failure joins the union without copy, which is the invariant: an
 * unclassified failure is a stranded learner.
 */
const EVERY_FAILURE = Object.keys({
  'mic-denied': true,
  'mic-missing': true,
  'mic-in-use': true,
  'mic-unavailable': true,
  'server-unreachable': true,
  'server-refused': true,
  signal: true,
  media: true,
  'agent-absent': true,
  'agent-silent': true,
  dropped: true,
  unknown: true,
} satisfies Record<LiveFailure, true>) as LiveFailure[];

/** The micro-label is shouted by type.label, and a shouted long line wraps badly. */
const LABEL_MAX = 24;

describe('what the learner reads when a live session will not start — the copy', () => {
  test('the unreachable screen tells the learner practice still works instead of giving ops advice', () => {
    // The screenshot the founder hit: "Could not reach the session server.
    // Check it is running, then try again." A learner cannot check whether a
    // process is running, and the screen gives them nothing but Back. Practice,
    // Review and the drills are all on-device, so there is somewhere to go.
    const { message } = failureCopy('server-unreachable');

    assert.match(
      message,
      /practice/i,
      'The learner is not stranded: practice is fully on-device and unaffected, so the screen must point at it rather than leaving Back as the only move.',
    );

    for (const opsAdvice of [/check it is running/i, /\bserver\b/i, /\brunning\b/i, /restart/i, /localhost/i, /\bport\b/i]) {
      assert.doesNotMatch(
        message,
        opsAdvice,
        `"${message}" speaks to whoever runs the service, not to the person learning French. A learner has no process to check and no port to look at.`,
      );
    }
  });

  test('the learner is not offered typing here, because typed mode needs the same service', () => {
    // Considered and rejected on purpose. Typed conversation goes through the
    // token server too, so canType: true would offer an escape that fails in
    // exactly the same way, one tap later.
    assert.equal(
      failureCopy('server-unreachable').canType,
      false,
      'Typing is not a way out of this one: it needs the same token server, so offering it would be a promise the app cannot keep.',
    );
  });

  test('no failure message counts, scolds, or blames the learner', () => {
    for (const failure of EVERY_FAILURE) {
      const { message } = failureCopy(failure);
      assert.doesNotMatch(message, /\d/, `"${message}" carries a number, and no mid-session message counts.`);
      assert.doesNotMatch(message, /\b(wrong|bad|failed|incorrect|invalid|error)\b/i, `"${message}" reads as a reproach or a vendor code, and neither belongs in front of a beginner.`);
      assert.doesNotMatch(message, /—/, `"${message}" carries an em dash, which no learner-facing string may.`);
    }
  });

  test('every failure names itself in plain words and leaves the learner somewhere to go', () => {
    for (const failure of EVERY_FAILURE) {
      const { label, message } = failureCopy(failure);
      assert.ok(label.length > 0, `${failure} has no label, so the screen would open with a blank heading.`);
      assert.ok(
        label.length <= LABEL_MAX,
        `"${label}" is ${label.length} characters and the label is rendered in capitals, where a long line wraps into a shout.`,
      );
      assert.ok(message.trim().endsWith('.'), `"${message}" is not a finished sentence, and half a sentence reads like the app gave up mid-thought.`);
    }
  });
});

describe('what the learner reads when a live session will not start — the classification', () => {
  test('a token service that never answers is what puts the learner on the unreachable screen', () => {
    // Both routes to the founder's screen: the fetch that never lands, and the
    // service that answers with something broken.
    assert.equal(classifyFailure(new TypeError('Failed to fetch')), 'server-unreachable');
    assert.equal(classifyFailure(new TokenServerError(500)), 'server-unreachable');
  });

  test('a service that answers and says no is a different situation, and says so', () => {
    assert.equal(
      classifyFailure(new TokenServerError(401)),
      'server-refused',
      'Being refused is not the same as being unreachable, and telling a learner practice still works would not help them here.',
    );
  });

  test('a failure nobody has classified yet still leaves the learner a way forward', () => {
    assert.equal(classifyFailure(new Error('something nobody has seen')), 'unknown');
    assert.equal(
      failureCopy('a failure mode from the future' as LiveFailure).message,
      failureCopy('unknown').message,
      'An unclassified failure must fall back to copy with a door in it, because a blank screen is a stranded learner.',
    );
  });
});
