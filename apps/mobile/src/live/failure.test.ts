import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ERROR_KINDS, type ErrorKind } from '@luvani/core';

import {
  classifyFailure,
  classifyPipelineError,
  failureCopy,
  PIPELINE_ALARM_PREFIX,
  PIPELINE_LOG_PREFIX,
  TokenServerError,
  tokenFailureCode,
  type LiveFailure,
  type PipelineOutcome,
} from './failure.ts';

/**
 * Every failure mode, listed once. The `satisfies` makes typecheck fail if a
 * new failure joins the union without copy, which is the invariant: an
 * unclassified failure is a stranded learner.
 */
const EVERY_FAILURE = Object.keys({
  'voice-unavailable': true,
  'mic-denied': true,
  'mic-missing': true,
  'mic-in-use': true,
  'mic-unavailable': true,
  'server-unreachable': true,
  'server-refused': true,
  'rate-limited': true,
  'session-elsewhere': true,
  'own-session-closing': true,
  'sign-in-required': true,
  signal: true,
  media: true,
  'agent-absent': true,
  'agent-silent': true,
  dropped: true,
  'tutor-deaf': true,
  'tutor-mute': true,
  'tutor-stalled': true,
  'tutor-talks-over': true,
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
      const { label, message, canType } = failureCopy(failure);
      assert.ok(label.length > 0, `${failure} has no label, so the screen would open with a blank heading.`);
      assert.ok(
        label.length <= LABEL_MAX,
        `"${label}" is ${label.length} characters and the label is rendered in capitals, where a long line wraps into a shout.`,
      );
      assert.ok(message.trim().endsWith('.'), `"${message}" is not a finished sentence, and half a sentence reads like the app gave up mid-thought.`);
      // The screen only draws the typing button when `canType` is set, so a
      // sentence that names typing while the flag is off is a door described
      // and not built, which is the F197 mistake in another place.
      assert.equal(
        /\btyping\b/i.test(message),
        canType,
        `"${message}" and canType=${canType} disagree about whether typing is a way out, and the learner reads the sentence while the screen obeys the flag.`,
      );
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

// ─────────────────────────────────────────────────── F197: the false promise
//
// The old line was "The connection dropped. Your progress is saved." Nothing is
// saved before the recap arrives, so a learner who lost a ten minute
// conversation was told it was banked, believed it, and stopped.
//
// Matching the replacement string would defend the wording and not the promise:
// the next rewrite would be free to say "everything you said is safe" and stay
// green. So the test reads the sentence for a CLAIM instead, and proves the
// reader works by running it over rewrites that must fail and rewrites that
// must pass.

/** Words that assert the conversation survived. `keep` is absent on purpose: "keep going by typing" is a door, not a promise. */
const SAFETY_CLAIM = new Set(['save', 'saved', 'saves', 'saving', 'safe', 'kept', 'stored', 'banked', 'recorded', 'preserved', 'remembered']);

/** Words that assert it did not. Denying one of these is the same promise, spelled backwards. */
const LOSS = new Set(['lost', 'gone', 'missing', 'erased', 'wiped', 'deleted']);

const NEGATORS = new Set(['not', 'no', 'nothing', 'none', 'never', 'without', 'cannot', 'nor']);
const isNegator = (word: string): boolean => NEGATORS.has(word) || word.endsWith("n't");

/** Far enough back to cover "could not be saved", near enough not to swallow a whole sentence. */
const LOOKBACK = 5;

/**
 * Does this sentence tell the learner their conversation survived?
 *
 * True for "your progress is saved" and equally true for "nothing was lost",
 * which is the same promise with the negative moved. False for an honest
 * sentence however it is phrased, including one that names the loss.
 */
function claimsTheSessionSurvived(message: string): boolean {
  for (const sentence of message.split(/(?<=[.!?])\s+/)) {
    const words = sentence
      .split(/\s+/)
      .map((w) => w.replace(/[^A-Za-z']/g, '').toLowerCase())
      .filter((w) => w.length > 0);
    for (let i = 0; i < words.length; i += 1) {
      const word = words[i]!;
      const claim = SAFETY_CLAIM.has(word);
      if (!claim && !LOSS.has(word)) continue;
      const negated = words.slice(Math.max(0, i - LOOKBACK), i).some(isNegator);
      // A safety word standing on its own is a promise; a loss word with a
      // negator in front of it is the same promise.
      if (claim !== negated) return true;
    }
  }
  return false;
}

describe('what the learner reads when a session they were in goes away', () => {
  test('the dropped-session message promises nothing the code does not do', () => {
    // First, prove the reader is not vacuous. If this table ever passes
    // wholesale the assertion below is decoration.
    const rewrites: { message: string; honest: boolean }[] = [
      { message: 'The connection dropped. Your progress is saved.', honest: false },
      { message: 'The connection dropped. Nothing was lost.', honest: false },
      { message: 'The connection went away, and everything you said is safe.', honest: false },
      { message: 'The connection dropped. We kept the conversation for you.', honest: false },
      { message: 'The connection dropped and this session could not be saved. Start a fresh one when you are ready.', honest: true },
      { message: 'That one is gone. Start again whenever you like.', honest: true },
      { message: 'The connection went, and nothing from this conversation was kept. A fresh session is the way back.', honest: true },
    ];
    for (const { message, honest } of rewrites) {
      assert.equal(
        claimsTheSessionSurvived(message),
        !honest,
        `the promise reader disagrees about "${message}", so what it says about the shipped copy means nothing.`,
      );
    }

    const { message } = failureCopy('dropped');
    assert.equal(
      claimsTheSessionSurvived(message),
      false,
      `"${message}" tells the learner the conversation survived. The journal only covers what arrives after the recap, so a session cut off before it leaves nothing behind, and a learner who believes otherwise stops instead of starting again.`,
    );
    assert.match(
      message,
      /\b(fresh|again|new)\b/i,
      `"${message}" names the loss and stops there. The one useful thing left to say is that a new session is the way back.`,
    );
  });
});

// ────────────────────────── F198: the tutor's pipeline, while a session is live
//
// One sentence used to answer for all five vendor kinds, and it named the wrong
// one: a dead recogniser was reported as the tutor losing its VOICE. The learner
// kept talking to something that could not hear them, and the meter kept running.

/** Narrow, loudly, so the assertions below can read the fields. */
function blocking(out: PipelineOutcome): Extract<PipelineOutcome, { severity: 'blocking' }> {
  assert.equal(out.severity, 'blocking', `expected the session to stop and offer a way out, and it was shown as ${out.severity}.`);
  if (out.severity !== 'blocking') throw new Error('unreachable');
  return out;
}

const AGENT_SENTENCE = 'The tutor lost its voice for a moment. Give it a second, or leave and come back.';

describe('what the learner reads when half the tutor stops working mid-session', () => {
  test('an unrecoverable vendor failure is named honestly and offers the typed door', () => {
    // The Deepgram outage, exactly. The vendor says transcription is down and
    // is not coming back; the learner must not be told the tutor's voice went.
    const deaf = blocking(classifyPipelineError({ message: AGENT_SENTENCE, kind: 'stt_error', recoverable: false }, { spoken: true }));
    assert.equal(deaf.failure, 'tutor-deaf', 'a dead recogniser is the tutor not hearing, whatever the frame said.');

    const heard = failureCopy('tutor-deaf');
    assert.match(heard.message, /\bhear\b/i, `"${heard.message}" never says the tutor cannot hear, which is the only thing the learner needs to know.`);
    assert.doesNotMatch(
      heard.message,
      /\b(voice|speak|speaking|spoke)\b/i,
      `"${heard.message}" blames the tutor's voice for a failure of its ears. That is the lie this entry exists to kill.`,
    );
    assert.equal(heard.canType, true, 'a tutor that cannot hear can still be typed to, and that door is the whole way forward.');
    assert.match(heard.message, /\btyping\b/i, 'the door has to be in the sentence as well as in the flag, because the learner reads the sentence.');

    // The mirror, so the two are not simply swapped one day.
    const mute = blocking(classifyPipelineError({ message: AGENT_SENTENCE, kind: 'tts_error', recoverable: false }, { spoken: true }));
    assert.equal(mute.failure, 'tutor-mute');
    const spoken = failureCopy('tutor-mute');
    assert.match(spoken.message, /\b(voice|speak)\b/i);
    assert.doesNotMatch(spoken.message, /\bhear\b/i, `"${spoken.message}" reports a dead voice as a dead ear, which is the same lie facing the other way.`);

    // Every kind, and none of them landing on the generic line.
    const generic = failureCopy('unknown').message;
    for (const kind of ERROR_KINDS) {
      const out = blocking(classifyPipelineError({ message: AGENT_SENTENCE, kind, recoverable: false }, { spoken: true }));
      const copy = failureCopy(out.failure);
      assert.notEqual(copy.message, generic, `${kind} falls through to "${generic}", which tells the learner nothing about what just stopped working.`);
      assert.equal(
        /\btyping\b/i.test(copy.message),
        copy.canType,
        `${kind} offers typing in words but not in the flag, or the other way round, and the screen obeys the flag.`,
      );
      assert.match(copy.message, /\bcome back\b|\bpractice\b/i, `${kind} ends the session without saying what the learner can do instead.`);
    }

    // An agent that shipped before the kinds existed sends neither field. It
    // still says something true, and it still has a way out.
    const old = blocking(classifyPipelineError({ message: AGENT_SENTENCE, recoverable: false }, { spoken: true }));
    assert.equal(old.failure, 'tutor-stalled', 'an unrecoverable failure with no kind is still the tutor unable to carry on, and the learner is owed that much.');
    assert.equal(failureCopy('tutor-stalled').canType, false, 'the half that writes the reply is the half that is down, so typing would be a door onto the same wall.');
  });

  test('a recoverable blip stays a quiet notice', () => {
    // The room, the microphone and the meter are all still running. Replacing
    // the session with a failure screen over a blip loses the conversation the
    // learner was having.
    for (const kind of ERROR_KINDS) {
      const out = classifyPipelineError({ message: AGENT_SENTENCE, kind, recoverable: true }, { spoken: true });
      assert.equal(out.severity, 'notice', `a recoverable ${kind} is shown as ${out.severity}, which takes the scene away over something that is coming back.`);
      assert.equal('failure' in out, false, `a recoverable ${kind} carries a failure for the error screen to render, and that screen is a dead end.`);
      if (out.severity !== 'notice') throw new Error('unreachable');
      assert.doesNotMatch(out.message, /\bleave\b/i, `"${out.message}" tells the learner to leave a session that is still running.`);
      assert.doesNotMatch(out.message, /\d/, `"${out.message}" carries a number, and no mid-session message counts.`);
      assert.doesNotMatch(out.message, /\b(wrong|bad|failed|incorrect|invalid|error)\b/i, `"${out.message}" reads as a reproach or a vendor code.`);
      assert.doesNotMatch(out.message, /—/, `"${out.message}" carries an em dash, which no learner-facing string may.`);
      assert.ok(out.message.trim().endsWith('.'), `"${out.message}" is not a finished sentence.`);
      assert.notEqual(out.message, failureCopy(blocking(classifyPipelineError({ message: AGENT_SENTENCE, kind, recoverable: false }, { spoken: true })).failure).message, `a blip and an outage read identically for ${kind}.`);
    }

    // Neither field present: an older agent, or an error that is not a pipeline
    // failure at all, such as a session reaching its limit. Today's behaviour,
    // deliberately unchanged, with the agent's own sentence.
    const bare = classifyPipelineError({ message: AGENT_SENTENCE }, { spoken: true });
    assert.equal(bare.severity, 'notice');
    if (bare.severity !== 'notice') throw new Error('unreachable');
    assert.equal(bare.message, AGENT_SENTENCE, 'with no kind the frame carries the only honest sentence available, so it is the one to show.');

    // A kind with no flag is not a licence to guess. Naming it is safe, taking
    // the screen away is not.
    const unsure = classifyPipelineError({ message: AGENT_SENTENCE, kind: 'stt_error' }, { spoken: true });
    assert.equal(unsure.severity, 'notice', 'a missing recoverable flag was read as an outage, and a learner lost a live conversation to a guess.');
  });

  test('every pipeline kind is named by what the learner lost, not by the vendor', () => {
    const vendors = /deepgram|elevenlabs|openai|anthropic|cartesia|fish|livekit|stt|tts|llm|api|model|pipeline|socket/i;
    for (const kind of ERROR_KINDS) {
      for (const outcome of [
        classifyPipelineError({ message: AGENT_SENTENCE, kind, recoverable: true }, { spoken: true }),
        classifyPipelineError({ message: AGENT_SENTENCE, kind, recoverable: false }, { spoken: true }),
      ]) {
        const words = outcome.severity === 'notice' ? outcome.message : failureCopy(blocking(outcome).failure).message;
        assert.notEqual(words, AGENT_SENTENCE, `${kind} still reads as the one sentence that answered for all five.`);
        assert.doesNotMatch(words, vendors, `"${words}" names the machinery. A learner is owed what they can no longer do, not which vendor went down.`);
        assert.match(words, /\btutor\b/i, `"${words}" never says who this is about, and the learner will read it as their own doing.`);
      }
    }
  });

  test('the pipeline log line says what broke and nothing about the learner', () => {
    // The line an engineer greps at two in the morning. It is also the line
    // most likely to be pasted somewhere public, so it carries no French
    // attempt, no transcript, and nothing the learner typed.
    const attempt = "je voudrais un croissant s'il vous plait";
    const out = classifyPipelineError({ message: attempt, kind: 'stt_error', recoverable: false }, { spoken: true });

    assert.match(PIPELINE_ALARM_PREFIX, /^\[luvani\] [A-Z_]+$/, 'the alarm left the house shape, and the house shape is what makes it greppable.');
    assert.equal(PIPELINE_ALARM_PREFIX, '[luvani] TUTOR_PIPELINE_DOWN', 'this string is an interface. Renaming it breaks whoever is grepping for it during an incident.');
    assert.equal(PIPELINE_LOG_PREFIX, '[luvani:live] pipeline');

    // The privacy assertion runs before the exact line is pinned, so a leak is
    // reported as a leak rather than as a formatting change.
    for (const word of attempt.split(' ')) {
      assert.equal(out.log.includes(word), false, `the log line carries "${word}" from the frame. Nothing a learner said or attempted leaves the device for diagnostics.`);
    }
    assert.equal(out.log, '[luvani] TUTOR_PIPELINE_DOWN kind=stt_error recoverable=no mode=spoken shown=blocking');

    // A blip is logged too, on the ordinary channel, so the count of them is
    // still there to read.
    const blip = classifyPipelineError({ message: attempt, kind: 'tts_error', recoverable: true }, { spoken: true });
    assert.equal(blip.log, '[luvani:live] pipeline kind=tts_error recoverable=yes mode=spoken shown=notice');

    // Absent fields are left out rather than printed as a guess.
    const bare = classifyPipelineError({ message: attempt }, { spoken: false });
    assert.equal(bare.log, '[luvani:live] pipeline mode=typed shown=notice');
  });

  test('a typed learner is not interrupted by a failure they cannot feel', () => {
    // A typed session carries no audio in either direction. A dead recogniser
    // cannot reach someone who is not speaking, and "the tutor cannot hear you"
    // in front of a learner who is typing is both alarming and untrue.
    for (const kind of ['stt_error', 'tts_error', 'interruption_detection_error'] satisfies ErrorKind[]) {
      for (const recoverable of [true, false]) {
        const out = classifyPipelineError({ message: AGENT_SENTENCE, kind, recoverable }, { spoken: false });
        assert.equal(out.severity, 'silent', `a typed session was interrupted by ${kind}, which it cannot possibly feel.`);
      }
    }

    // Still logged, and still an alarm, because the vendor really is down even
    // though this learner was untouched by it.
    const quiet = classifyPipelineError({ message: AGENT_SENTENCE, kind: 'stt_error', recoverable: false }, { spoken: false });
    assert.equal(quiet.log, '[luvani] TUTOR_PIPELINE_DOWN kind=stt_error recoverable=no mode=typed shown=silent');

    // The reply itself failing reaches everyone, typed or not.
    const stalled = blocking(classifyPipelineError({ message: AGENT_SENTENCE, kind: 'llm_error', recoverable: false }, { spoken: false }));
    assert.equal(stalled.failure, 'tutor-stalled', 'a tutor that cannot write a reply is just as gone for a learner who is typing.');
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


test('only an explicit typing-only capability reply offers typing after a voice refusal', () => {
  const body = { error: 'voice-unavailable', supportedModes: ['lesson-text', 'convo-text'], message: 'Untrusted remote prose' };
  const failure = classifyFailure(new TokenServerError(503, tokenFailureCode(503, body)));
  assert.equal(failure, 'voice-unavailable');
  assert.equal(failureCopy(failure).canType, true);
  assert.doesNotMatch(failureCopy(failure).message, /Untrusted/);
  for (const bad of [null, {}, { ...body, error: 'outage' }, { ...body, supportedModes: ['convo-text'] }, { ...body, supportedModes: ['convo-text', 'convo-text'] }, { ...body, supportedModes: [...body.supportedModes, 'convo'] }]) {
    assert.equal(tokenFailureCode(503, bad), undefined);
    assert.equal(failureCopy(classifyFailure(new TokenServerError(503, tokenFailureCode(503, bad)))).canType, false);
  }
  for (const status of [401, 409, 429, 500]) assert.equal(tokenFailureCode(status, body), undefined);
});
