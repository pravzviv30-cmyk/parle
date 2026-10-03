import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';

import { voice } from '@livekit/agents';
import {
  CAFE_LESSON,
  DEFAULT_TUTOR_VOICE,
  RUNGS,
  STUCK_SILENCE_MS,
  currentPrompt,
  encodeMessage,
  tutorVoice,
  type ClientMessage,
  type Rung,
  type ServerMessage,
  type TutorPersona,
} from '@luvani/core';
import { TEXT_SILENCE_MS } from './convo.ts';
import { buildPrompt } from './prompt.ts';
import { LuvaniTutor, forgetReportedSessions } from './tutor.ts';

/**
 * A stand-in for the LiveKit session.
 *
 * The tutor only ever asks it to do two things — generate a reply, or say a line
 * outright — so recording those two calls is the whole surface. `this.session`
 * on voice.Agent normally throws unless the agent is attached to a live
 * activity, so the instance property shadows the prototype getter.
 */
function stubSession() {
  const calls = { generateReply: [] as unknown[], said: [] as string[] };
  const session = {
    generateReply(options?: unknown) {
      calls.generateReply.push(options ?? {});
    },
    say(text: string) {
      calls.said.push(text);
    },
  };
  return { session: session as never, calls };
}

function build(
  startRung: Rung = RUNGS.PROMPTED,
  options: { voiceless?: boolean; sessionId?: string; persona?: TutorPersona } = {},
) {
  const tutor = new LuvaniTutor(CAFE_LESSON, startRung, options);
  const { session, calls } = stubSession();
  Object.defineProperty(tutor, 'session', { value: session, configurable: true });
  // In agent.ts the signed session id is written before the channel back to the
  // app is wired, and the replay refusal below depends on that order: the
  // refusal is decided at the setter and spoken at `attach`.
  if (options.sessionId !== undefined) tutor.sessionId = options.sessionId;
  const published: ServerMessage[] = [];
  tutor.attach((message) => {
    published.push(message);
  });
  return { tutor, session, calls, published };
}

/** A tap or a keystroke, as it arrives on the data channel. */
function tapped(message: ClientMessage): Uint8Array {
  return encodeMessage(message);
}

/** What the recogniser hands the agent at the end of a turn. */
function heard(text: string) {
  return { textContent: text } as never;
}

describe('the scripted tutor, off the worker', () => {
  test('the tutor can be built without booting the worker', () => {
    // Importing agent.ts runs preflight, probes four vendors and calls
    // cli.runApp at module scope, which is why none of this was testable before.
    // This module imports no CLI and reads no keys.
    const { tutor } = build();
    assert.equal(tutor.sessionState.turnIndex, 0);
    assert.equal(tutor.sessionState.ladder.rung, RUNGS.PROMPTED);
    assert.equal(tutor.sessionState.finished, false);
  });

  test('the first prompt reaches the app on ready', () => {
    const { tutor, published } = build();
    tutor.sendCurrentPrompt();
    const prompt = published.find((m) => m.t === 'prompt');
    assert.ok(prompt, 'the app cannot render a turn it was never sent');
    assert.equal(encodeMessage(prompt).byteLength > 0, true, 'and it has to survive the wire');
  });
});

describe('a turn that came back with no words', () => {
  test('an empty transcript stops the pipeline reply', async () => {
    const { tutor, calls } = build();

    // Before: this returned early without throwing, which leaves the pipeline
    // free to answer on its own — off the ladder, at whatever length it likes,
    // to a learner who has not said anything.
    await assert.rejects(
      () => tutor.onUserTurnCompleted({} as never, heard('   ')),
      (err: unknown) => err instanceof voice.StopResponse,
      'the pipeline must be told to stay quiet',
    );

    assert.equal(calls.generateReply.length, 0, 'and nothing was generated on the way out');
    assert.equal(tutor.sessionState.turnIndex, 0, 'the turn did not move');
    assert.equal(tutor.sessionState.ladder.rescues, 0, 'nor was it counted against them yet');
  });

  test('an empty transcript leaves the rescue clock running', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { tutor, session, calls } = build();

    tutor.armRescue(session);
    await assert.rejects(() => tutor.onUserTurnCompleted({} as never, heard('')), voice.StopResponse);

    // The noise interrupted the wait; it did not end it. Four more seconds of
    // real silence and the tutor steps in, exactly as it would have.
    t.mock.timers.tick(STUCK_SILENCE_MS + 1);
    await tutor.settled();

    assert.equal(tutor.sessionState.ladder.rescues, 1, 'the learner still gets rescued');
    assert.equal(calls.generateReply.length, 1);
  });
});

describe('a rescue and a learner talking at the same moment', () => {
  test('a rescue that loses the race is discarded', async () => {
    const { tutor, session, calls } = build();

    // The clock runs out and the learner starts talking in the same breath. By
    // then the timer callback is already scheduled, and clearTimeout cannot
    // unschedule what has already fired — so this is the callback arriving late,
    // which is exactly how both used to apply: a rung dropped for silence that
    // had ended, the spoken turn graded against a prompt that had already moved,
    // and two replies for one turn.
    const generation = tutor.armRescue(session);
    await tutor.onUserTurnCompleted({} as never, heard('Bonjour')).catch(() => {});
    await tutor.settled();

    await tutor.runRescue(session, generation);
    await tutor.settled();

    assert.equal(tutor.sessionState.ladder.rescues, 0, 'somebody who spoke was not stuck');
    assert.equal(tutor.sessionState.turnIndex, 1, 'exactly one turn was applied');
    assert.equal(calls.generateReply.length, 1, 'and the tutor answered once');
  });

  test('a rescue in flight is dropped the moment the learner takes the floor', async () => {
    const { tutor, session, calls } = build();

    const generation = tutor.armRescue(session);
    tutor.setLearnerSpeaking(true); // the VAD heard them; the transcript is still coming
    await tutor.runRescue(session, generation);
    await tutor.settled();

    assert.equal(tutor.sessionState.ladder.rescues, 0);
    assert.equal(calls.generateReply.length, 0, 'nothing was said over them');
  });

  test('a rescue still fires when the learner really does say nothing', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { tutor, session } = build();

    tutor.armRescue(session);
    t.mock.timers.tick(STUCK_SILENCE_MS + 1);
    await tutor.settled();

    assert.equal(tutor.sessionState.ladder.rescues, 1);
    assert.equal(tutor.sessionState.ladder.rung, RUNGS.CUED, 'a rung of support, as always');
  });

  test('turns are applied one at a time, never interleaved', async () => {
    const { tutor, calls } = build();

    // Two arriving together is the ordinary case on a busy connection, not an
    // exotic one: nothing guarded `state` between them before.
    await Promise.all([
      tutor.onUserTurnCompleted({} as never, heard('Bonjour')).catch(() => {}),
      tutor.onUserTurnCompleted({} as never, heard("Un café, s'il vous plaît")).catch(() => {}),
    ]);
    await tutor.settled();

    assert.equal(tutor.sessionState.turnIndex, 2, 'both turns landed, neither was lost');
    assert.equal(calls.generateReply.length, 2, 'and each got exactly one reply');
  });
});

describe('a lesson for someone who cannot speak aloud', () => {
  test('a tapped option advances the turn without claiming it was heard', async () => {
    const { tutor, session, calls } = build(RUNGS.CUED);

    // The cards were read-along decoration: the wire has carried `choice` all
    // along and nothing on either end ever sent or handled one. A learner on a
    // train either spoke or sat through rescues and finished having said
    // nothing at all.
    await tutor.handleClientMessage(session, tapped({ t: 'choice', text: 'Bonjour' }));
    await tutor.settled();

    assert.equal(tutor.sessionState.turnIndex, 1, 'the answer counts');
    assert.equal(tutor.sessionState.utterancesScored, 0, 'but nobody heard it, and the end card must not pretend otherwise');
    assert.equal(tutor.sessionState.learnerSpeakingSec, 0, 'a tap is not speaking time');
    assert.equal(calls.generateReply.length, 1, 'the tutor still answers');
  });

  test('a wrong tap is graded like a wrong answer, not waved through', async () => {
    const { tutor, session } = build(RUNGS.CUED);
    await tutor.handleClientMessage(session, tapped({ t: 'choice', text: 'Bonsoir' }));
    await tutor.settled();

    // 'Bonsoir' is the deliberately-wrong option on turn one. Tapping is a way
    // to answer, not a way to skip the ladder.
    assert.equal(tutor.sessionState.turnIndex, 0, 'they get another go at it');
    assert.equal(tutor.sessionState.ladder.rung, RUNGS.ECHO, 'with more support than before');
  });

  test('a lesson can be completed entirely by typing', async () => {
    const { tutor, calls, published } = build(RUNGS.ECHO, { voiceless: true });
    const { session } = stubSession();

    tutor.sendCurrentPrompt(session);
    let guard = 0;
    while (!tutor.sessionState.finished && guard++ < CAFE_LESSON.turns.length * 3) {
      const prompt = tutor.sessionState;
      const turn = CAFE_LESSON.turns[Math.min(prompt.turnIndex, CAFE_LESSON.turns.length - 1)]!;
      await tutor.handleClientMessage(session, tapped({ t: 'say', text: turn.target }));
      await tutor.settled();
    }

    assert.equal(tutor.sessionState.finished, true, 'the whole café lesson, start to end, with no microphone');
    assert.equal(calls.generateReply.length, 0, 'nothing was generated');
    assert.equal(calls.said.length, 0, 'and nothing was spoken');

    const summary = published.find((m) => m.t === 'summary');
    assert.ok(summary, 'a typed lesson still ends with an end card');
    assert.equal(summary.summary.pronunciationStatus, 'unavailable', 'and it says plainly that nobody listened');
  });

  test('a typed lesson still rescues a learner who goes quiet', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { tutor, session } = build(RUNGS.PROMPTED, { voiceless: true });

    // Nothing speaks, so no AgentStateChanged ever fires to start the clock.
    // Rendering the turn is the moment the learner has the floor.
    //
    // The clock is the text one now (F141). Genuine silence still rescues, and
    // it does it at twelve seconds instead of four, because four is a rule
    // about speaking and nobody here is speaking. That is the behaviour change,
    // written into the test that owns the behaviour rather than a new one.
    tutor.sendCurrentPrompt(session);
    t.mock.timers.tick(STUCK_SILENCE_MS + 1);
    assert.equal(tutor.sessionState.ladder.rescues, 0, 'four seconds is not a typed learner going quiet');

    t.mock.timers.tick(TEXT_SILENCE_MS - STUCK_SILENCE_MS);
    await tutor.settled();

    assert.equal(tutor.sessionState.ladder.rescues, 1, 'a quiet learner is still a stuck learner');
  });

  test('a typed lesson waits the text window and typing keeps the clock standing', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { tutor, session } = build(RUNGS.PROMPTED, { voiceless: true });

    // Measured against this class before the fix: a rescue after 4.001s, a
    // rescue after a typing ping and 4.001s, a rescue after "give me a moment"
    // and 4.001s. Every one of them drops a rung, counts a rescue and rewrites
    // the rung tomorrow opens on, for a learner who was in the middle of a
    // sentence.
    tutor.sendCurrentPrompt(session);
    t.mock.timers.tick(STUCK_SILENCE_MS + 1);
    await tutor.settled();
    assert.equal(tutor.sessionState.ladder.rescues, 0, 'typing at human speed is not being stuck');

    // Presence restarts the window from the last keystroke, so eleven more
    // seconds of writing is still writing, twice over.
    for (const presence of [{ t: 'typing' }, { t: 'moment' }] as const) {
      await tutor.handleClientMessage(session, tapped(presence));
      t.mock.timers.tick(TEXT_SILENCE_MS - 1_000);
      await tutor.settled();
      assert.equal(tutor.sessionState.ladder.rescues, 0, `${presence.t} did not stand the clock down`);
    }

    // And presence is never a clock of its own. With nothing running, a ping
    // must not start the tutor waiting on a learner who has not been given the
    // floor.
    tutor.clearRescue();
    await tutor.handleClientMessage(session, tapped({ t: 'typing' }));
    t.mock.timers.tick(TEXT_SILENCE_MS + 1);
    await tutor.settled();
    assert.equal(tutor.sessionState.ladder.rescues, 0, 'a keystroke started a wait nothing had armed');
    assert.equal(tutor.sessionState.turnIndex, 0, 'and none of this moved the lesson');

    // The full window of real silence still rescues.
    tutor.armRescue(session);
    t.mock.timers.tick(TEXT_SILENCE_MS + 1);
    await tutor.settled();
    assert.equal(tutor.sessionState.ladder.rescues, 1, 'twelve silent seconds is still a stuck learner');
  });

  test('asking to hear the line does nothing when there is no voice', async () => {
    const { tutor, session, calls } = build(RUNGS.ECHO, { voiceless: true });
    await tutor.handleClientMessage(session, tapped({ t: 'hear' }));
    assert.equal(calls.said.length, 0);
  });
});

/**
 * Money. Everything here is about what reaches the token server, so the token
 * server is replaced by a recorder rather than mocked away: `reportUsage`
 * builds the request itself, and the body it builds is the bill.
 */
describe('what a session is allowed to bill', () => {
  /** Catch the debit the tutor sends, with no token server in the room. */
  function captureDebits() {
    const debits: { userId: string; sessionId: string; seconds: number; utterancesScored: number }[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async (_input: unknown, init?: { body?: unknown }) => {
      debits.push(JSON.parse(String(init?.body)));
      return { ok: true, json: async () => ({ secondsRemaining: 600 }) };
    }) as unknown as typeof fetch;
    return { debits, restore: () => { globalThis.fetch = real; } };
  }

  /**
   * Backdate the room's start so the wall clock is not zero.
   *
   * Without it every assertion below reads `seconds: 0` whether the guard works
   * or not, which is a test that cannot fail. Sixty seconds because sixty is
   * what the live harness watched being debited for a room nobody spoke in.
   */
  function ranFor(tutor: LuvaniTutor, seconds: number): void {
    (tutor as unknown as { startedAt: number }).startedAt = Date.now() - seconds * 1_000;
  }

  /**
   * One silence rescue, with the clock it re-arms stood back down.
   *
   * A text-mode tutor re-arms on every publish, so a test that leaves the timer
   * running has a tutor quietly rescuing an empty room every four seconds until
   * the lesson runs out — which then debits, under whatever fetch is installed
   * by the time it gets there.
   */
  async function rescueOnce(tutor: LuvaniTutor, session: voice.AgentSession): Promise<void> {
    const generation = tutor.armRescue(session);
    tutor.clearRescue();
    await tutor.runRescue(session, generation);
    await tutor.settled();
    tutor.clearRescue();
  }

  test('a session with no learner turn bills nothing even after a silence rescue', async () => {
    forgetReportedSessions();
    const { debits, restore } = captureDebits();
    const { tutor, session } = build(RUNGS.PROMPTED, {
      voiceless: true,
      sessionId: '11111111-1111-4111-8111-111111111111',
    });
    try {
      tutor.learnerId = 'a-learner-with-a-dead-microphone';
      ranFor(tutor, 60);

      // Nobody said a word, so the rescue fires. The ladder re-asks the same
      // turn for a couple of attempts before it moves on, so drive it until the
      // turn index moves: that index is what the old guard read as "they took a
      // turn", and it is the whole of the defect.
      for (let attempt = 0; attempt < 6 && tutor.sessionState.turnIndex === 0; attempt += 1) {
        await rescueOnce(tutor, session);
      }
      assert.ok(tutor.sessionState.ladder.rescues > 0, 'the learner really was rescued');
      assert.ok(tutor.sessionState.turnIndex > 0, 'and the rescue really did advance the turn index');

      await tutor.finish();

      assert.equal(debits.length, 1, 'the session is still reported, which is what releases the lease');
      assert.equal(debits[0]!.seconds, 0, 'but a room that never carried a learner turn is not a product');
    } finally {
      tutor.clearRescue();
      restore();
    }
  });

  test('a session the learner did speak in is billed for its wall clock', async () => {
    forgetReportedSessions();
    const { debits, restore } = captureDebits();
    const { tutor, session } = build(RUNGS.PROMPTED, {
      voiceless: true,
      sessionId: '22222222-2222-4222-8222-222222222222',
    });
    try {
      ranFor(tutor, 60);

      // The guard has to refuse an unusable room without giving away a real one.
      await tutor.handleClientMessage(session, tapped({ t: 'say', text: 'un café, s\'il vous plaît' }));
      await tutor.settled();
      tutor.clearRescue();
      await tutor.finish();

      assert.equal(debits.length, 1);
      assert.equal(debits[0]!.seconds, 60, 'a session with a learner turn in it is a session');
    } finally {
      tutor.clearRescue();
      restore();
    }
  });

  test('a room rescued into silence over and over still bills nothing', async () => {
    forgetReportedSessions();
    const { debits, restore } = captureDebits();
    const { tutor, session } = build(RUNGS.PROMPTED, {
      voiceless: true,
      sessionId: '55555555-5555-4555-8555-555555555555',
    });
    try {
      ranFor(tutor, 300);
      for (let i = 0; i < 5; i += 1) await rescueOnce(tutor, session);
      await tutor.finish();

      assert.equal(debits.length, 1);
      assert.equal(debits[0]!.seconds, 0, 'five rescues are still nobody speaking');
    } finally {
      tutor.clearRescue();
      restore();
    }
  });
});

/**
 * F77. The join credential is a five minute bearer token, and LiveKit re-creates
 * a closed room for whoever presents one: measured live, with 279s of ttl still
 * on a room whose session had already been reported. The empty room costs
 * nothing. The tutor dispatched into it is what would cost a free session.
 */
describe('a credential that has already been spent', () => {
  test('a join credential cannot re-open a room whose session has already been reported', async () => {
    forgetReportedSessions();
    const debits: { sessionId: string; seconds: number }[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async (_input: unknown, init?: { body?: unknown }) => {
      debits.push(JSON.parse(String(init?.body)));
      return { ok: true, json: async () => ({ secondsRemaining: 600 }) };
    }) as unknown as typeof fetch;

    const sessionId = '33333333-3333-4333-8333-333333333333';
    const first = build(RUNGS.PROMPTED, { voiceless: true, sessionId });
    // Built after the first session has been reported, because that is the
    // order the attack happens in: the room closes, then the captured
    // credential opens it again and a second tutor is dispatched into it.
    let replay: ReturnType<typeof build> | undefined;
    try {
      // One real session: the learner answers, it ends, the seconds are reported.
      await first.tutor.handleClientMessage(first.session, tapped({ t: 'say', text: 'un café, s\'il vous plaît' }));
      await first.tutor.settled();
      first.tutor.clearRescue();
      await first.tutor.finish();
      assert.equal(debits.length, 1, 'the real session reported exactly once');

      // The same credential presented again, inside its ttl, against the room
      // LiveKit just re-created. Every way in is tried.
      replay = build(RUNGS.PROMPTED, { voiceless: true, sessionId });
      replay.tutor.sendCurrentPrompt(replay.session);
      await replay.tutor.handleClientMessage(replay.session, tapped({ t: 'ready' }));
      await replay.tutor.handleClientMessage(replay.session, tapped({ t: 'say', text: 'bonjour' }));
      await replay.tutor.settled();
      await replay.tutor.finish();

      assert.equal(debits.length, 1, 'the replay never reached the token server');
      assert.equal(replay.tutor.sessionState.turnIndex, 0, 'nor moved the ladder');
      assert.equal(replay.calls.generateReply.length, 0, 'nor spent a model call');
      assert.equal(replay.calls.said.length, 0, 'nor a word of synthesis');
      assert.deepEqual(
        replay.published.filter((m) => m.t === 'prompt'),
        [],
        'nor taught a line of the lesson',
      );
      const errors = replay.published.filter((m) => m.t === 'error');
      assert.equal(errors.length, 1, 'and the learner is told, once, in plain words');
      assert.match(errors[0]!.message, /already finished/i);
    } finally {
      first.tutor.clearRescue();
      replay?.tutor.clearRescue();
      globalThis.fetch = real;
      forgetReportedSessions();
    }
  });

  test('an unreported session id is served normally, so the guard cannot lock a learner out', () => {
    forgetReportedSessions();
    const { tutor, published } = build(RUNGS.PROMPTED, {
      voiceless: true,
      sessionId: '44444444-4444-4444-8444-444444444444',
    });
    try {
      tutor.sendCurrentPrompt();
      assert.ok(published.some((m) => m.t === 'prompt'), 'a fresh credential gets its lesson');
      assert.deepEqual(published.filter((m) => m.t === 'error'), []);
    } finally {
      tutor.clearRescue();
    }
  });
});

/**
 * F173. A tapped option is an answer, and every answer passes the boundary.
 *
 * The guard covered `say` only. Ten lines further down, `choice || say`
 * publishes the text as a transcript and hands it to `submitTurn`, so a tapped
 * option's free text reached the transcript, the ladder and the model unread.
 * It is the scripted lesson that carries this, and in the scripted lesson
 * tapping is the ordinary way to answer: a learner on a train taps every turn.
 *
 * Driven through the real class with a captured publisher, because a test that
 * greps for the guard would pass with `handleSafety` emptied out.
 */
describe('a tapped option passes the safety boundary', () => {
  test("a tapped option's text passes the safety boundary before grading or publishing", async () => {
    const { tutor, session, calls, published } = build(RUNGS.CUED);
    try {
      await tutor.handleClientMessage(session, tapped({ t: 'choice', text: 'I want to kill myself' }));
      await tutor.settled();

      // 1. The learner is answered, on the frame the app keeps.
      const safety = published.filter((m) => m.t === 'safety');
      assert.equal(safety.length, 1, 'a crisis tapped into a scripted lesson reaches the app exactly once');
      assert.equal(safety[0]!.category, 'self-harm');
      assert.equal(safety[0]!.action, 'stop');

      // 2. Nothing else happened to those words. No transcript, so they never
      //    reached the screen or the model; no turn, so the ladder never graded
      //    them; no reply, so the tutor did not answer them in character.
      assert.deepEqual(published.filter((m) => m.t === 'transcript'), [], 'the words were published before they were read');
      assert.equal(tutor.sessionState.turnIndex, 0, 'a disclosure was graded as a French answer');
      assert.equal(tutor.sessionState.ladder.rung, RUNGS.CUED, 'the ladder moved on a disclosure');
      assert.deepEqual(calls.generateReply, [], 'the model was asked to answer it in character');

      // 3. And the session is over, exactly as it is for a typed disclosure.
      assert.ok(published.some((m) => m.t === 'summary'), 'a stop leaves the session running');
    } finally {
      tutor.clearRescue();
    }
  });

  test('an ordinary tap is still an ordinary answer', () => {
    // The guard is one condition wider, not one mode narrower. If this stops
    // passing, the fix above took the tap with it.
    const { tutor, session, calls, published } = build(RUNGS.CUED);
    return tutor
      .handleClientMessage(session, tapped({ t: 'choice', text: 'Bonjour' }))
      .then(() => tutor.settled())
      .then(() => {
        assert.deepEqual(published.filter((m) => m.t === 'safety'), [], 'an ordinary tap was answered as a crisis');
        assert.equal(tutor.sessionState.turnIndex, 1, 'the ordinary tap stopped counting');
        assert.equal(calls.generateReply.length, 1);
      })
      .finally(() => tutor.clearRescue());
  });
});

// ─────────────────────────────── the person the learner chose to be taught by

/**
 * F292 gave the tutor a chosen persona, and every test of it called
 * `buildPrompt` directly. Nothing asked whether this CLASS hands the person
 * over, so the option lived on the caller's side of the constructor and nowhere
 * else — agent.ts passed a `persona` that `LuvaniTutor` had never heard of. The
 * gate caught that as a type error, which was luck: had the option been spelled
 * on the constructor and dropped in the body, or threaded into the first prompt
 * and forgotten in the rebuild, it would have compiled and shipped a tutor who
 * changes name partway through a lesson.
 *
 * So these drive the real object and read back the prompt the model would get.
 */
describe('the tutor speaks as the person the learner chose', () => {
  const marie = tutorVoice('marie').persona;

  /** The prompt the model would be handed right now, as a string. */
  function promptOf(tutor: LuvaniTutor): string {
    const instructions = tutor.instructions;
    assert.equal(typeof instructions, 'string', 'the lesson prompt is built as one string, per turn');
    return instructions as string;
  }

  test('a non-default persona reaches the lesson prompt through the tutor, not just the builder', () => {
    const { tutor } = build(RUNGS.PROMPTED, { persona: marie });
    const prompt = promptOf(tutor);

    assert.match(prompt, /You are Marie\b/, 'the tutor opens as somebody the learner will never hear');
    assert.doesNotMatch(prompt, /\bAlexandre\b/, "the default persona's name is still in the prompt somewhere");
    // The pronoun rides with the name or she says "je suis content" out loud in
    // a woman's voice on the first turn. prompt.test.ts makes this assertion of
    // the builder; this one makes it of the object that calls the builder.
    assert.match(prompt, /you are a woman/i, 'the agreement her own French takes went missing on the way through');

    // And it is exactly what the builder produces for her, so this cannot pass
    // on a prompt the tutor assembled some other way.
    const { turn, directive } = currentPrompt(CAFE_LESSON, tutor.sessionState);
    assert.equal(prompt, buildPrompt(CAFE_LESSON, turn, directive, marie));
  });

  test('a non-default persona survives a mid-lesson prompt rebuild', async () => {
    const { tutor } = build(RUNGS.PROMPTED, { persona: marie });

    // One right answer, which is the ordinary case rather than an edge: every
    // applied turn re-renders the whole prompt for the next one. That rebuild is
    // the trap. It is a second `buildPrompt` call, three hundred lines from the
    // constructor, and a persona missing there swaps the tutor one turn into the
    // lesson while the voice saying the words carries straight on — a mismatch
    // nobody would think to look for, because the session started out right.
    await tutor.onUserTurnCompleted({} as never, heard('Bonjour')).catch(() => {});
    await tutor.settled();
    assert.equal(tutor.sessionState.turnIndex, 1, 'the lesson never moved on, so no rebuild was proved');

    const prompt = promptOf(tutor);
    assert.match(prompt, /You are Marie\b/, 'the tutor became somebody else partway through the lesson');
    assert.doesNotMatch(prompt, /\bAlexandre\b/, 'the default persona came back on the second turn');

    const { turn, directive } = currentPrompt(CAFE_LESSON, tutor.sessionState);
    assert.equal(prompt, buildPrompt(CAFE_LESSON, turn, directive, marie), 'the rebuilt prompt is not hers');
    tutor.clearRescue();
  });

  test('a lesson nobody chose a voice for still opens as the catalogue default', () => {
    // The other half of the guarantee: threading the persona through must not
    // move a single byte for a learner who has never picked one. The default is
    // read out of the catalogue rather than written here, and it is answered in
    // one place — the builder — so this class holds no second opinion about who
    // the tutor is when nobody has said.
    const luc = tutorVoice(DEFAULT_TUTOR_VOICE).persona;
    const { tutor } = build();
    const { turn, directive } = currentPrompt(CAFE_LESSON, tutor.sessionState);

    assert.equal(promptOf(tutor), buildPrompt(CAFE_LESSON, turn, directive), 'an unchosen lesson stopped matching the builder');
    assert.equal(promptOf(tutor), buildPrompt(CAFE_LESSON, turn, directive, luc), 'and stopped being the catalogue default');
    assert.match(promptOf(tutor), /\bAlexandre\b/);
  });
});

 test('concurrent scripted finishes await one acknowledged service settlement', async () => {
  forgetReportedSessions();
  const real = globalThis.fetch;
  let answer!: (value: Response) => void;
  const request = new Promise<Response>(resolve => { answer = resolve; });
  let requests = 0;
  globalThis.fetch = (async () => { requests++; return request; }) as typeof fetch;
  const { tutor, published } = build(RUNGS.PROMPTED, { sessionId: '123e4567-e89b-42d3-a456-426614174777' });
  try {
    assert.equal(tutor.terminalFailureFor('tts_error', false, true), 'tts_error');
    const first = tutor.finish();
    let secondSettled = false;
    const second = tutor.finish().then(() => { secondSettled = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(secondSettled, false, 'an in-flight acknowledgement must hold every concurrent close');
    answer(new Response(JSON.stringify({ kind: 'not-charged', refundedSeconds: 0, secondsRemaining: 1800, plan: 'trial' })));
    await Promise.all([first, second]);
    assert.equal(requests, 1);
    assert.equal(published.filter(m => m.t === 'settlement').length, 1);
    assert.equal(tutor.terminalFailureFor('tts_error', false, true), null, 'finished sessions cannot gain a new failure cause');
  } finally { answer(new Response('{}')); globalThis.fetch = real; forgetReportedSessions(); }
 });
