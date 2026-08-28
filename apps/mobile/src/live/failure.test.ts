import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { classifyFailure, failureCopy, TokenServerError, type LiveFailure } from './failure.ts';

/**
 * Every failure mode, listed once. The `satisfies` makes typecheck fail if a
 * sixteenth failure joins the union without copy, which is the invariant: an
 * unclassified failure is a stranded learner.
 */
const EVERY_FAILURE = Object.keys({
  'mic-denied': true,
  'mic-missing': true,
  'mic-in-use': true,
  'mic-unavailable': true,
  'server-unreachable': true,
  'server-refused': true,
  'rate-limited': true,
  'session-elsewhere': true,
  'sign-in-required': true,
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
    // A refusal the learner cannot act on. The named refusals below have their
    // own words; everything else lands here, which is still a long way from
    // "unreachable" and must not send the learner off to practice instead.
    for (const status of [400, 403, 404]) {
      assert.equal(
        classifyFailure(new TokenServerError(status)),
        'server-refused',
        'Being refused is not the same as being unreachable, and telling a learner practice still works would not help them here.',
      );
    }
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

/**
 * A refusal is not one situation. The token server answers `/session/start`
 * with three different 4xx replies that a learner can actually act on, and
 * folding them together handed the same sign-out advice to all three. For the
 * second-session case that advice is worse than useless: signing out abandons
 * the app the learner is already talking in, and the lease that refused them
 * is held for a fixed window either way.
 */
describe('a live session the tutor service refuses — the three refusals a learner can act on', () => {
  test('a rate limited start asks for a short wait, not a sign out', () => {
    const failure = classifyFailure(new TokenServerError(429));
    const { message } = failureCopy(failure);

    assert.notEqual(
      message,
      failureCopy('server-refused').message,
      'A rate limit is a wait, not an account problem, so it must not reuse the account copy.',
    );
    assert.doesNotMatch(
      message,
      /sign(ing|ed)? (in|out)/i,
      `"${message}" sends the learner through a sign out that clears nothing: the limit is counted against the account and the device, and comes back the moment they return.`,
    );
    assert.match(
      message,
      /pause|wait|moment|minute|short/i,
      `"${message}" never says the thing that is actually true, which is that waiting a little fixes this by itself.`,
    );
    assert.match(
      message,
      /try again/i,
      `"${message}" leaves the learner without the one move that works, which is to come back and start again.`,
    );
  });

  test('a second session elsewhere is told to end it, not to sign out', () => {
    const failure = classifyFailure(new TokenServerError(409));
    const { message } = failureCopy(failure);

    assert.notEqual(
      message,
      failureCopy('server-refused').message,
      'The lease is per learner and mode blind, so this is a live session somewhere else, not a broken account.',
    );
    assert.doesNotMatch(
      message,
      /sign(ing)? out/i,
      `"${message}" tells the learner to sign out, which is the one move that makes this worse: the other session keeps its lease and they lose the app they were holding.`,
    );
    assert.match(
      message,
      /end (it|the|that)/i,
      `"${message}" never names the fix, which is to end the session that is still open.`,
    );
    assert.match(
      message,
      /still (open|going|running)|elsewhere|somewhere else|another/i,
      `"${message}" never says what happened, so the learner cannot tell which session is in the way.`,
    );
  });

  test('a signed out start says to sign in', () => {
    const failure = classifyFailure(new TokenServerError(401));
    const { message } = failureCopy(failure);

    assert.notEqual(
      message,
      failureCopy('server-refused').message,
      'Being signed out is the plainest thing that can go wrong here, and it deserves its own plain sentence.',
    );
    assert.match(
      message,
      /sign in/i,
      `"${message}" never asks the learner to sign in, which is the whole of the fix.`,
    );
    assert.doesNotMatch(
      message,
      /signing out/i,
      `"${message}" asks somebody who is already signed out to sign out, which is a loop with no exit.`,
    );
  });

  test('none of the three refusals offers typing, because the typed path is refused in exactly the same breath', () => {
    // Judgement, recorded so it is not quietly flipped. A typed conversation
    // asks the same service for the same credential: it meets the same limit
    // counter, the same per learner lease and the same sign in check. Offering
    // typing here would be an escape that fails one tap later.
    for (const failure of ['rate-limited', 'session-elsewhere', 'sign-in-required'] as const) {
      assert.equal(
        failureCopy(failure).canType,
        false,
        `${failure} offers typing, but typing asks for the same credential and is refused the same way, so the offer is a promise the app cannot keep.`,
      );
    }
  });
});

/**
 * The 409 has two readings, and the copy above was written for one of them.
 *
 * The token server leases a session to a learner at the moment it grants the
 * token, for thirty minutes (server.ts:44, `30 * 60`), and the only thing that
 * gives that lease back is `/session/end`, which is behind the agent secret and
 * is called by the tutor, never by the app. A grant nobody joins dispatches no
 * tutor at all (tokens.ts, `workerOccupancySecPerAbandonedRoom: 0`), so nothing
 * ends it and nothing releases it.
 *
 * That is the ordinary shape of leaving during connect: the learner takes the
 * Leave door on the connecting screen, the grant is already leased, and the
 * next tap is refused with a 409. Reading the refusal as "a session on another
 * device" strands that learner. There is no other device, they cannot reach the
 * lease, and typing takes the same lease one tap later.
 */
describe('a live session refused by a lease this device cannot reach — the learner who left their own connect', () => {
  /** A sentence that only means something if a second device exists. */
  const needsTheOtherDevice = (sentence: string) =>
    /\bthere\b|other device|another device|elsewhere|somewhere else/i.test(sentence);

  test('a session conflict on this device offers an honest way forward', () => {
    const { message, canType } = failureCopy(classifyFailure(new TokenServerError(409)));
    const sentences = message.split(/(?<=\.)\s+/).map((s) => s.trim()).filter((s) => s.length > 0);

    // Reading one, and it must survive: a learner genuinely talking on a second
    // device ends it there, the tutor debits, and the lease is released.
    assert.ok(
      sentences.some((s) => /end it/i.test(s) && needsTheOtherDevice(s)),
      `"${message}" no longer tells the learner with a real second session to end it there, which is the one move that releases the lease early.`,
    );

    // Reading two. Typing is refused by the same lease, so the screen offers
    // Back and nothing else: whatever the learner does next has to be somewhere
    // Back can reach, and the sentence has to name it.
    assert.equal(
      canType,
      false,
      'Typing asks the same service for the same credential and meets the same per learner lease, so an offer to type would be refused one tap later.',
    );

    // Where the already vetted copy sends a learner the tutor service has shut
    // out. Practice is on-device, so Back genuinely reaches it.
    const offlinePractice = /practice/i;
    assert.match(
      failureCopy('server-unreachable').message,
      offlinePractice,
      'This test leans on practice being what the app offers a learner the tutor service has shut out; if the unreachable screen stopped saying so, this anchor is stale.',
    );

    const worksWithNoSecondDevice = sentences.filter((s) => !needsTheOtherDevice(s) && offlinePractice.test(s));
    assert.ok(
      worksWithNoSecondDevice.length > 0,
      `"${message}" gives the learner who just left their own connect nothing to do: every move it names needs a second device to end the session on, and there is no second device. With typing closed and Back the only control, one sentence has to point somewhere Back can reach.`,
    );

    // And it must not tell them the lease will be back before it is.
    for (const shortWait of [/in a minute/i, /in a moment/i, /in a few minutes/i, /shortly/i, /momentarily/i, /straight away/i, /right away/i]) {
      assert.doesNotMatch(
        message,
        shortWait,
        `"${message}" promises the session back sooner than the thirty minute lease is kept, so a learner who obeys it is refused again.`,
      );
    }

    assert.match(
      message,
      /half an hour|hour|a while/i,
      `"${message}" never says the wait is long, so the learner taps start again against a lease that holds for thirty minutes.`,
    );
  });
});
