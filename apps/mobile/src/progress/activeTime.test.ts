/**
 * Active learning time: the pure clock every practice surface folds its
 * learner-driven events through.
 *
 * The rules under test are the ones the product decision rests on. Opening a
 * screen earns nothing. Only the gap between two real touches can count, and
 * only when it is short enough to be one stretch of attention. A long gap is
 * dropped whole, never clipped to the cutoff, because a clipped gap would pay
 * thirty seconds for every coffee break. A clock that runs backwards pays
 * nothing. Backgrounding forgets the anchor, so time away is never credited.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_CUTOFF_MS,
  cleanActiveMs,
  idleClock,
  learnerEngaged,
  suspended,
  touched,
  type ActiveClock,
} from './activeTime.ts';

const CUT = ACTIVE_CUTOFF_MS.drill;

function run(times: readonly number[], cutoff = CUT, from: ActiveClock = idleClock()): ActiveClock {
  return times.reduce((clock, at) => touched(clock, at, cutoff), from);
}

describe('cutoffs', () => {
  test('drill, review and lesson share thirty seconds; a conversation gets forty-five', () => {
    assert.equal(ACTIVE_CUTOFF_MS.drill, 30_000);
    assert.equal(ACTIVE_CUTOFF_MS.review, 30_000);
    assert.equal(ACTIVE_CUTOFF_MS.lesson, 30_000);
    assert.equal(ACTIVE_CUTOFF_MS.convo, 45_000);
  });
});

describe('touching', () => {
  test('a fresh clock holds nothing and no anchor', () => {
    assert.deepEqual(idleClock(), { lastTouchAt: null, activeMs: 0 });
  });

  test('the first touch anchors and adds nothing, so opening a screen is never credit', () => {
    const clock = touched(idleClock(), 1_000_000, CUT);
    assert.deepEqual(clock, { lastTouchAt: 1_000_000, activeMs: 0 });
  });

  test('typing keystrokes a few seconds apart all count, typed work is active', () => {
    const clock = run([0, 2_000, 5_000, 9_000, 20_000].map((t) => t + 1_000));
    assert.equal(clock.activeMs, 20_000);
  });

  test('a gap exactly at the cutoff counts', () => {
    assert.equal(run([1_000, 1_000 + CUT]).activeMs, CUT);
  });

  test('a gap one millisecond past the cutoff is excluded whole, not clipped', () => {
    const clock = run([1_000, 1_001 + CUT]);
    assert.equal(clock.activeMs, 0);
    assert.equal(clock.lastTouchAt, 1_001 + CUT, 'the late touch re-anchors, so work after it counts');
    assert.equal(touched(clock, 1_001 + CUT + 4_000, CUT).activeMs, 4_000);
  });

  test('two minutes idle in the middle of a sitting adds nothing for the idle stretch', () => {
    const clock = run([1_000, 11_000, 131_000, 136_000]);
    assert.equal(clock.activeMs, 15_000);
  });

  test('the conversation cutoff lets a slower turn-taking gap count', () => {
    assert.equal(run([1_000, 41_000], ACTIVE_CUTOFF_MS.convo).activeMs, 40_000);
    assert.equal(run([1_000, 41_000], ACTIVE_CUTOFF_MS.drill).activeMs, 0);
  });

  test('a clock that runs backwards adds nothing and re-anchors at the new reading', () => {
    const back = run([100_000, 110_000, 50_000]);
    assert.equal(back.activeMs, 10_000);
    assert.equal(back.lastTouchAt, 50_000);
    assert.equal(touched(back, 55_000, CUT).activeMs, 15_000, 'work after the jump still counts from the new anchor');
  });

  test('the same instant twice adds nothing', () => {
    assert.equal(run([5_000, 5_000, 5_000]).activeMs, 0);
  });

  test('a non-finite instant is ignored and leaves the clock as it was', () => {
    const clock = run([1_000, 3_000]);
    assert.deepEqual(touched(clock, Number.NaN, CUT), clock);
    assert.deepEqual(touched(clock, Number.POSITIVE_INFINITY, CUT), clock);
  });

  test('touching never mutates the clock it was handed', () => {
    const clock = Object.freeze(run([1_000]));
    touched(clock, 2_000, CUT);
    assert.deepEqual(clock, { lastTouchAt: 1_000, activeMs: 0 });
  });
});

describe('suspending', () => {
  test('backgrounding keeps the total and forgets the anchor', () => {
    const clock = suspended(run([1_000, 6_000]));
    assert.deepEqual(clock, { lastTouchAt: null, activeMs: 5_000 });
  });

  test('coming back five seconds or five hours later earns nothing for the time away', () => {
    for (const away of [5_000, 5 * 3_600_000]) {
      const back = touched(suspended(run([1_000, 6_000])), 6_000 + away, CUT);
      assert.equal(back.activeMs, 5_000, `away ${away}ms was credited`);
      assert.equal(touched(back, 6_000 + away + 3_000, CUT).activeMs, 8_000, 'work after returning counts');
    }
  });

  test('a resumed sitting starts from its saved total and never credits the overnight gap', () => {
    const saved = run([1_000, 21_000]).activeMs;
    const morning = 1_000 + 12 * 3_600_000;
    const resumed = run([morning, morning + 7_000], CUT, idleClock(saved));
    assert.equal(resumed.activeMs, 27_000);
  });
});

describe('a conversation partner is evidence only while the learner is there — Stage 1 idle credit', () => {
  const CONVO = ACTIVE_CUTOFF_MS.convo;

  test('learnerEngaged holds only within the cutoff after a learner action', () => {
    assert.equal(learnerEngaged(null, 10_000, CONVO), false, 'with no learner action yet, the tutor alone is not the learner working');
    assert.equal(learnerEngaged(10_000, 10_000, CONVO), true);
    assert.equal(learnerEngaged(10_000, 10_000 + CONVO, CONVO), true, 'exactly at the cutoff still counts');
    assert.equal(learnerEngaged(10_000, 10_001 + CONVO, CONVO), false, 'one millisecond past the cutoff is away');
    assert.equal(learnerEngaged(10_000, 9_000, CONVO), false, 'a clock that ran backwards is not evidence');
    assert.equal(learnerEngaged(10_000, Number.NaN, CONVO), false);
  });

  /**
   * The conversation screen's rule, folded purely: a learner action always
   * touches and marks the learner present; a tutor speaking boundary touches
   * only while `learnerEngaged` says the learner acted recently.
   */
  type ConvoEvent = { at: number; who: 'learner' | 'tutor' };
  function convo(events: readonly ConvoEvent[]): number {
    let clock = idleClock();
    let lastLearnerAt: number | null = null;
    for (const { at, who } of events) {
      if (who === 'learner') {
        lastLearnerAt = at;
        clock = touched(clock, at, CONVO);
      } else if (learnerEngaged(lastLearnerAt, at, CONVO)) {
        clock = touched(clock, at, CONVO);
      }
    }
    return clock.activeMs;
  }
  /** The agent re-arming its silence rescue: speaking starts, then stops, every few seconds. */
  function rescues(from: number, until: number, every = 8_000): ConvoEvent[] {
    const out: ConvoEvent[] = [];
    for (let t = from; t <= until; t += every) out.push({ at: t, who: 'tutor' }, { at: t + 3_000, who: 'tutor' });
    return out;
  }

  test('repeated tutor rescues with no learner action accrue nothing', () => {
    assert.equal(convo(rescues(1_000, 10 * 60_000)), 0, 'ten minutes of the tutor talking to an empty room was credited');
  });

  test('a learner who walks away stops accruing once the cutoff passes, however long the rescues go on', () => {
    const walkedAway = (minutes: number) => convo([{ at: 1_000, who: 'learner' }, ...rescues(5_000, minutes * 60_000)]);
    const twoMinutes = walkedAway(2);
    assert.ok(twoMinutes <= CONVO, `a walked-away learner earned ${twoMinutes}ms, more than one cutoff after their last action`);
    assert.equal(walkedAway(30), twoMinutes, 'half an hour of rescues kept adding time after the learner left');
  });

  test('a normal learner and tutor exchange still credits the whole stretch', () => {
    // Tutor speaks at +2s, stops at +12s; learner answers at +20s; repeated.
    const events: ConvoEvent[] = [{ at: 0, who: 'learner' }];
    for (let turn = 0; turn < 10; turn += 1) {
      const base = turn * 20_000;
      events.push({ at: base + 2_000, who: 'tutor' }, { at: base + 12_000, who: 'tutor' }, { at: base + 20_000, who: 'learner' });
    }
    assert.equal(convo(events), 200_000, 'a real exchange lost time it should have earned');
    // And the tutor's long turn between two learner turns is listening, which counts.
    assert.equal(
      convo([{ at: 0, who: 'learner' }, { at: 30_000, who: 'tutor' }, { at: 60_000, who: 'tutor' }, { at: 70_000, who: 'learner' }]),
      70_000,
      'listening to the tutor between two learner turns is work too',
    );
  });
});

describe('cleaning a stored or passed value', () => {
  test('finite non-negative numbers pass, floored to whole milliseconds', () => {
    assert.equal(cleanActiveMs(0), 0);
    assert.equal(cleanActiveMs(12_345.9), 12_345);
  });

  test('anything else is unknown, never zero', () => {
    for (const bad of [undefined, null, -1, Number.NaN, Number.POSITIVE_INFINITY, '9000', {}]) {
      assert.equal(cleanActiveMs(bad), undefined, `${String(bad)} was accepted`);
    }
  });

  test('idleClock refuses a malformed starting total rather than carrying it', () => {
    assert.equal(idleClock(-5).activeMs, 0);
    assert.equal(idleClock(Number.NaN).activeMs, 0);
  });
});
