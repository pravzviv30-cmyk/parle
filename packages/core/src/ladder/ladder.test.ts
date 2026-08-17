import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyTurn,
  directiveFor,
  initialState,
  nextSessionRung,
  unassistedRate,
  PROMOTION_STREAK,
  RUNGS,
  STUCK_SILENCE_MS,
  type LadderState,
  type TurnEvent,
} from './ladder.ts';

/** Run a sequence of events and return the final state. */
function run(events: TurnEvent[], start: LadderState = initialState()): LadderState {
  return events.reduce((s, e) => applyTurn(s, e).state, start);
}

const good: TurnEvent = { type: 'spoke', quality: 'good' };
const partial: TurnEvent = { type: 'spoke', quality: 'partial' };
const poor: TurnEvent = { type: 'spoke', quality: 'poor' };
const stuck: TurnEvent = { type: 'silence', durationMs: STUCK_SILENCE_MS };

describe('ladder — the stuck learner', () => {
  test('four seconds of silence drops a rung and triggers a rescue', () => {
    const { state, directive } = applyTurn(initialState(RUNGS.PROMPTED), stuck);
    assert.equal(state.rung, RUNGS.CUED);
    assert.equal(state.rescues, 1);
    assert.equal(directive.rescued, true);
  });

  test('a rescue tells the tutor to offer the line and say nothing about the struggle', () => {
    const { directive } = applyTurn(initialState(RUNGS.PROMPTED), stuck);
    assert.match(directive.tutorInstruction, /stuck/i);
    assert.match(directive.tutorInstruction, /do not mention that they hesitated/i);
    assert.match(directive.tutorInstruction, /do not apologise/i);
  });

  test('a short pause is thinking, and is left completely alone', () => {
    const before = initialState(RUNGS.PROMPTED);
    const { state, directive } = applyTurn(before, { type: 'silence', durationMs: STUCK_SILENCE_MS - 1 });
    assert.deepEqual(state, before, 'a brief pause must not change anything');
    assert.equal(directive.rescued, false);
  });

  test('a learner who never speaks always lands on Echo — never stranded', () => {
    const state = run([stuck, stuck, stuck, stuck, stuck], initialState(RUNGS.FREE));
    assert.equal(state.rung, RUNGS.ECHO);
    assert.equal(directiveFor(state.rung).support, 'full-line', 'at the bottom the tutor simply says the line for them');
  });

  test('asking for help works exactly like silence, and is never counted against them', () => {
    const { state, directive } = applyTurn(initialState(RUNGS.FREE), { type: 'help-requested' });
    assert.equal(state.rung, RUNGS.PROMPTED);
    assert.equal(directive.rescued, true);
    assert.equal(state.unassistedTurns, 0);
  });

  test('the ladder never drops below rung 1', () => {
    const state = run([poor, poor, poor], initialState(RUNGS.ECHO));
    assert.equal(state.rung, RUNGS.ECHO);
  });
});

describe('ladder — withdrawing support', () => {
  test('two consecutive good turns withdraw one level of support', () => {
    const state = run([good, good]);
    assert.equal(state.rung, RUNGS.CUED);
    assert.equal(state.streak, 0, 'streak resets after promotion');
  });

  test('one good turn is not enough', () => {
    assert.equal(run([good]).rung, RUNGS.ECHO);
  });

  test('a partial turn holds position rather than punishing normal beginner performance', () => {
    const state = run([partial, partial, partial], initialState(RUNGS.CUED));
    assert.equal(state.rung, RUNGS.CUED);
  });

  test('a partial turn breaks the promotion streak', () => {
    assert.equal(run([good, partial, good]).rung, RUNGS.ECHO);
  });

  test('a poor turn drops a rung immediately', () => {
    assert.equal(run([poor], initialState(RUNGS.PROMPTED)).rung, RUNGS.CUED);
  });

  test('the ladder never climbs above rung 4', () => {
    const state = run(Array<TurnEvent>(10).fill(good), initialState(RUNGS.FREE));
    assert.equal(state.rung, RUNGS.FREE);
  });

  test('a competent learner climbs from Echo to Free without interference', () => {
    const state = run(Array<TurnEvent>(PROMOTION_STREAK * 3).fill(good));
    assert.equal(state.rung, RUNGS.FREE);
    assert.equal(state.rescues, 0);
  });
});

describe('ladder — support and instructions per rung', () => {
  test('each rung renders the right kind of support', () => {
    assert.equal(directiveFor(RUNGS.ECHO).support, 'full-line');
    assert.equal(directiveFor(RUNGS.CUED).support, 'options');
    assert.equal(directiveFor(RUNGS.PROMPTED).support, 'hint');
    assert.equal(directiveFor(RUNGS.FREE).support, 'none');
  });

  test('the cued rung insists the learner speaks rather than taps', () => {
    assert.match(directiveFor(RUNGS.CUED).tutorInstruction, /say their choice out loud/i);
    assert.match(directiveFor(RUNGS.CUED).tutorInstruction, /never let them tap it silently/i);
  });

  test('the prompted rung withholds the French', () => {
    assert.match(directiveFor(RUNGS.PROMPTED).tutorInstruction, /do not give them the French/i);
  });

  test('the echo rung asks for nothing new', () => {
    assert.match(directiveFor(RUNGS.ECHO).tutorInstruction, /do not ask them to produce anything new/i);
  });
});

describe('ladder — progress signals', () => {
  test('only turns composed at rung 3+ count as unassisted', () => {
    const climbed = run([good, good, good, good]); // reaches PROMPTED after 4 good turns
    assert.equal(climbed.rung, RUNGS.PROMPTED);
    assert.equal(climbed.unassistedTurns, 0, 'turns spent climbing were all scaffolded');

    const composing = run([good], climbed);
    assert.equal(composing.unassistedTurns, 1);
  });

  test('unassisted rate is zero for a fully scaffolded session', () => {
    assert.equal(unassistedRate(run([good, partial, good, partial])), 0);
  });

  test('unassisted rate rises as the learner composes for themselves', () => {
    const state = run([good, good, good, good, good, good], initialState(RUNGS.FREE));
    assert.ok(unassistedRate(state) > 0.9);
  });

  test('rate is zero, not NaN, before any turns are taken', () => {
    assert.equal(unassistedRate(initialState()), 0);
  });

  test('the next session opens one rung below where they finished', () => {
    assert.equal(nextSessionRung({ ...initialState(), rung: RUNGS.FREE }), RUNGS.PROMPTED);
  });

  test('a learner who finished at the bottom still opens at the bottom', () => {
    assert.equal(nextSessionRung({ ...initialState(), rung: RUNGS.ECHO }), RUNGS.ECHO);
  });
});
