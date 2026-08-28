import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ERROR_KINDS, type ErrorKind } from '@parle/core';

import {
  classifyFailure,
  classifyPipelineError,
  failureCopy,
  PIPELINE_ALARM_PREFIX,
  PIPELINE_LOG_PREFIX,
  TokenServerError,
  type LiveFailure,
  type PipelineOutcome,
} from './failure.ts';

/**
 * Every failure mode, listed once. The `satisfies` makes typecheck fail if a
 * seventeenth failure joins the union without copy, which is the invariant: an
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
      // and not built, which is the F178 mistake in another place.
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

// ─────────────────────────────────────────────────── F178: the false promise
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

// ────────────────────────── F179: the tutor's pipeline, while a session is live
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

    assert.match(PIPELINE_ALARM_PREFIX, /^\[parle\] [A-Z_]+$/, 'the alarm left the house shape, and the house shape is what makes it greppable.');
    assert.equal(PIPELINE_ALARM_PREFIX, '[parle] TUTOR_PIPELINE_DOWN', 'this string is an interface. Renaming it breaks whoever is grepping for it during an incident.');
    assert.equal(PIPELINE_LOG_PREFIX, '[parle:live] pipeline');

    // The privacy assertion runs before the exact line is pinned, so a leak is
    // reported as a leak rather than as a formatting change.
    for (const word of attempt.split(' ')) {
      assert.equal(out.log.includes(word), false, `the log line carries "${word}" from the frame. Nothing a learner said or attempted leaves the device for diagnostics.`);
    }
    assert.equal(out.log, '[parle] TUTOR_PIPELINE_DOWN kind=stt_error recoverable=no mode=spoken shown=blocking');

    // A blip is logged too, on the ordinary channel, so the count of them is
    // still there to read.
    const blip = classifyPipelineError({ message: attempt, kind: 'tts_error', recoverable: true }, { spoken: true });
    assert.equal(blip.log, '[parle:live] pipeline kind=tts_error recoverable=yes mode=spoken shown=notice');

    // Absent fields are left out rather than printed as a guess.
    const bare = classifyPipelineError({ message: attempt }, { spoken: false });
    assert.equal(bare.log, '[parle:live] pipeline mode=typed shown=notice');
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
    assert.equal(quiet.log, '[parle] TUTOR_PIPELINE_DOWN kind=stt_error recoverable=no mode=typed shown=silent');

    // The reply itself failing reaches everyone, typed or not.
    const stalled = blocking(classifyPipelineError({ message: AGENT_SENTENCE, kind: 'llm_error', recoverable: false }, { spoken: false }));
    assert.equal(stalled.failure, 'tutor-stalled', 'a tutor that cannot write a reply is just as gone for a learner who is typing.');
  });
});
