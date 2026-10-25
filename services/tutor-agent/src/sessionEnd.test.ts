/**
 * The end-of-session heads-up and the warm close (sessionEnd.ts), on a fake
 * clock against a scripted tutor. The tutors' own seams are tested beside
 * their classes in convo.test.ts and tutor.test.ts.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CLOSE_BY_MARGIN_MS, CLOSE_LINE_PLAYOUT_MS, HEADS_UP_LEAD_MS, MIN_SESSION_FOR_HEADS_UP_MS, SessionEndClock, boundedPlayout,
  headsUpEnabled, type SessionEndTutor,
} from './sessionEnd.ts';

/** Timers that move only when the test says so. */
class FakeTimers {
  now = 0;
  private next = 1;
  private readonly due = new Map<number, { at: number; fn: () => void }>();
  setTimeout = (fn: () => void, ms: number): unknown => { const id = this.next++; this.due.set(id, { at: this.now + ms, fn }); return id; };
  clearTimeout = (handle: unknown): void => { this.due.delete(handle as number); };
  advance(ms: number): void {
    const until = this.now + ms;
    for (;;) {
      const first = [...this.due.entries()].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!first) break;
      this.due.delete(first[0]);
      this.now = first[1].at;
      first[1].fn();
    }
    this.now = until;
  }
}

class ScriptedTutor implements SessionEndTutor {
  calls: string[] = [];
  learnerTurns = 0;
  busy = false;
  over = false;
  voiceless = false;
  held = false;
  wrapUp(): void { this.calls.push('wrap-up'); }
  async closeForTime(): Promise<void> { this.calls.push('close'); }
  sessionEndView() { return { learnerTurns: this.learnerTurns, busy: this.busy, over: this.over, voiceless: this.voiceless, held: this.held }; }
}

const CAP = 10 * 60_000;

function setUp(cap = CAP) {
  const timers = new FakeTimers();
  const tutor = new ScriptedTutor();
  let closesBegun = 0;
  const clock = new SessionEndClock(tutor, () => cap - timers.now, timers, () => { closesBegun += 1; });
  clock.start();
  clock.agentState('listening');
  return { timers, tutor, clock, closesBegun: () => closesBegun };
}

describe('the end-of-session heads-up', () => {
  test('is said at the first gap a minute before the cap, and not a moment earlier', () => {
    const { timers, tutor } = setUp();
    timers.advance(CAP - HEADS_UP_LEAD_MS - 1);
    assert.deepEqual(tutor.calls, []);
    timers.advance(1);
    assert.deepEqual(tutor.calls, ['wrap-up']);
  });

  test('a session that starts with under 90 seconds left gets neither the heads-up nor the close', () => {
    const { timers, tutor, clock } = setUp(MIN_SESSION_FOR_HEADS_UP_MS - 1);
    assert.equal(clock.state, 'skipped');
    timers.advance(MIN_SESSION_FOR_HEADS_UP_MS);
    assert.deepEqual(tutor.calls, []);
  });

  test('waits for a gap: not while the learner talks, the tutor talks, or a turn is in flight', () => {
    const { timers, tutor, clock } = setUp();
    clock.learnerSpeaking(true);
    timers.advance(CAP - HEADS_UP_LEAD_MS + 2_000);
    assert.deepEqual(tutor.calls, [], 'said over the learner');
    clock.agentState('speaking');
    clock.learnerSpeaking(false);
    timers.advance(2_000);
    assert.deepEqual(tutor.calls, [], 'said over the tutor');
    tutor.busy = true;
    clock.agentState('listening');
    timers.advance(2_000);
    assert.deepEqual(tutor.calls, [], 'said over a reply still being written');
    tutor.busy = false;
    timers.advance(500);
    assert.deepEqual(tutor.calls, ['wrap-up'], 'a queue draining with no event is still noticed');
  });

  test('closes once the learner has had one more exchange and its reply has been spoken', () => {
    const { timers, tutor, clock } = setUp();
    timers.advance(CAP - HEADS_UP_LEAD_MS);
    clock.agentState('speaking'); // the heads-up line itself
    clock.agentState('listening');
    timers.advance(5_000);
    assert.deepEqual(tutor.calls, ['wrap-up'], 'closed without letting them answer');
    clock.learnerSpeaking(true);
    clock.learnerSpeaking(false);
    tutor.learnerTurns += 1;
    tutor.busy = true;
    clock.agentState('thinking');
    clock.agentState('listening');
    timers.advance(1_000);
    assert.deepEqual(tutor.calls, ['wrap-up'], 'closed before the reply was said');
    tutor.busy = false;
    clock.agentState('speaking');
    assert.deepEqual(tutor.calls, ['wrap-up'], 'closed over the reply');
    clock.agentState('listening');
    assert.deepEqual(tutor.calls, ['wrap-up', 'close']);
    timers.advance(HEADS_UP_LEAD_MS);
    assert.deepEqual(tutor.calls, ['wrap-up', 'close'], 'the backstop closed a second time');
  });

  test('a typed session closes once the reply has landed, with no speech to wait for', () => {
    const { timers, tutor } = setUp();
    tutor.voiceless = true;
    timers.advance(CAP - HEADS_UP_LEAD_MS);
    tutor.learnerTurns += 1;
    timers.advance(500);
    assert.deepEqual(tutor.calls, ['wrap-up', 'close']);
  });

  test('closes at the backstop fifteen seconds before the cap, heads-up or not', () => {
    const { timers, tutor, clock } = setUp();
    clock.agentState('speaking'); // never a gap
    timers.advance(CAP - CLOSE_BY_MARGIN_MS - 1);
    assert.deepEqual(tutor.calls, []);
    timers.advance(1);
    assert.deepEqual(tutor.calls, ['close'], 'the heads-up is skipped, only the close is said');
  });

  test('a learner still speaking at the backstop is left to the hard stop', () => {
    const { timers, tutor, clock } = setUp();
    timers.advance(CAP - HEADS_UP_LEAD_MS);
    clock.learnerSpeaking(true);
    timers.advance(HEADS_UP_LEAD_MS);
    assert.deepEqual(tutor.calls, ['wrap-up']);
    assert.equal(clock.state, 'done');
  });

  test('a session that ended some other way hears nothing more', () => {
    const { timers, tutor } = setUp();
    tutor.over = true;
    timers.advance(CAP);
    assert.deepEqual(tutor.calls, []);
  });

  test('a paused tap-to-send recording is not a gap: the heads-up waits for Send', () => {
    const { timers, tutor } = setUp();
    tutor.held = true;
    timers.advance(CAP - HEADS_UP_LEAD_MS + 5_000);
    assert.deepEqual(tutor.calls, [], 'an uninterruptible line was played into an open recording');
    tutor.held = false;
    timers.advance(500);
    assert.deepEqual(tutor.calls, ['wrap-up']);
  });

  test('an open recording at the backstop is left to the hard stop', () => {
    const { timers, tutor, clock } = setUp();
    clock.agentState('speaking');
    tutor.held = true;
    timers.advance(CAP);
    assert.deepEqual(tutor.calls, []);
  });

  test('the worker is told as the close begins, once, so its time-limit notice can stand down', () => {
    const { timers, closesBegun } = setUp();
    timers.advance(CAP - CLOSE_BY_MARGIN_MS);
    assert.equal(closesBegun(), 1);
    timers.advance(CLOSE_BY_MARGIN_MS);
    assert.equal(closesBegun(), 1);
  });

  test('the backstop leaves fifteen seconds for the line, settlement and enrichment', () => {
    assert.equal(CLOSE_BY_MARGIN_MS, 15_000);
    assert.ok(CLOSE_LINE_PLAYOUT_MS < CLOSE_BY_MARGIN_MS);
  });

  test('LUVANI_SESSION_HEADS_UP=0 switches it off; anything else leaves it on', () => {
    assert.equal(headsUpEnabled({}), true);
    assert.equal(headsUpEnabled({ LUVANI_SESSION_HEADS_UP: '1' }), true);
    assert.equal(headsUpEnabled({ LUVANI_SESSION_HEADS_UP: '0' }), false);
  });
});

describe('boundedPlayout', () => {
  test('a playout that never settles is given up on after the bound', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let done = false;
    const waiting = boundedPlayout(new Promise(() => {}), 6_000).then(() => { done = true; });
    t.mock.timers.tick(5_999);
    await Promise.resolve();
    assert.equal(done, false);
    t.mock.timers.tick(1);
    await waiting;
    assert.equal(done, true);
  });
});
