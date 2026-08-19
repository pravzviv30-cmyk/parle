import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';

import { voice } from '@livekit/agents';
import { CAFE_LESSON, RUNGS, STUCK_SILENCE_MS, encodeMessage, type ServerMessage } from '@parle/core';
import { ParleTutor } from './tutor.ts';

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

function build(startRung = RUNGS.PROMPTED) {
  const tutor = new ParleTutor(CAFE_LESSON, startRung);
  const { session, calls } = stubSession();
  Object.defineProperty(tutor, 'session', { value: session, configurable: true });
  const published: ServerMessage[] = [];
  tutor.attach((message) => published.push(message));
  return { tutor, session, calls, published };
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
