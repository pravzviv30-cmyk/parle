/**
 * A count is felt as steps and heard as a few clicks, never a buzz (come alive
 * section 3, CountUp).
 *
 * countTicks.ts imports nothing, so this suite drives whole runs of a count
 * with a stepped clock: every redraw CountUp can make (one each 33 ms) across
 * the count's 900 ms, on the out curve the count really uses.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { HAPTIC_TICKS, SOUND_TICKS, createCountTicks, type TickKind } from './countTicks.ts';

/** The out curve, `EASE.out` (0.22, 1, 0.36, 1), close enough to step a count with. */
const easeOut = (t: number): number => 1 - (1 - t) ** 4;

/** Every step a run of `kind` from `from` to `to` takes, and the ticks each one fired. */
function run(from: number, to: number, kind: TickKind, frameMs = 33, durationMs = 900) {
  const ticks = createCountTicks(to, kind);
  const fired: { at: number; value: number; haptic: boolean; sound: boolean }[] = [];
  for (let at = 0; at <= durationMs + frameMs; at += frameMs) {
    const value = Math.round(from + (to - from) * easeOut(Math.min(1, at / durationMs)));
    const tick = ticks.step(at, value);
    fired.push({ at, value, ...tick });
  }
  return fired;
}

function gaps(times: number[]): number[] {
  return times.slice(1).map((t, i) => t - times[i]!);
}

describe('a count ticks in steps, not a buzz', () => {
  test('a count ticks by touch at most 12 times, never closer than 70 ms apart', () => {
    assert.deepEqual(HAPTIC_TICKS, { max: 12, gapMs: 70 });
    for (const to of [3, 12, 40, 250, 5000]) {
      const touches = run(0, to, 'haptic').filter((s) => s.haptic).map((s) => s.at);
      assert.ok(touches.length <= 12, `a count to ${to} ticked ${touches.length} times by touch`);
      for (const gap of gaps(touches)) assert.ok(gap >= 70, `a count to ${to} ticked ${gap} ms after the last tick`);
    }
    // And it does tick: a long count on a fine clock reaches the cap and stops there.
    assert.equal(run(0, 5000, 'haptic', 10, 2000).filter((s) => s.haptic).length, 12);
  });

  test('a count ticks by sound at most 10 times, never closer than 90 ms apart', () => {
    assert.deepEqual(SOUND_TICKS, { max: 10, gapMs: 90 });
    for (const to of [3, 12, 40, 250, 5000]) {
      const sounds = run(0, to, 'sound').filter((s) => s.sound).map((s) => s.at);
      assert.ok(sounds.length <= 10, `a count to ${to} ticked ${sounds.length} times by sound`);
      for (const gap of gaps(sounds)) assert.ok(gap >= 90, `a count to ${to} sounded ${gap} ms after the last tick`);
    }
    assert.equal(run(0, 5000, 'sound', 10, 2000).filter((s) => s.sound).length, 10);
  });

  test('a count never ticks on its final value, nor on a number it already showed', () => {
    for (const kind of ['haptic', 'sound', 'both'] as const) {
      for (const to of [1, 7, 120]) {
        const steps = run(0, to, kind);
        const landing = steps.filter((s) => s.value === to);
        assert.ok(landing.length > 0, 'the run never reached its final value, so this check reads nothing');
        assert.ok(landing.every((s) => !s.haptic && !s.sound), `a ${kind} count to ${to} ticked on its final value`);
      }
    }
    // A step that shows the same number again is not a step.
    const ticks = createCountTicks(10, 'both');
    assert.deepEqual(ticks.step(0, 3), { haptic: true, sound: true });
    assert.deepEqual(ticks.step(500, 3), { haptic: false, sound: false });
    assert.deepEqual(ticks.step(1000, 4), { haptic: true, sound: true });
    // Counting down lands on its final value silently too.
    assert.ok(run(20, 0, 'both').filter((s) => s.value === 0).every((s) => !s.haptic && !s.sound));
  });

  test('a count asked for no ticks makes none, and one kind never fires the other', () => {
    assert.ok(run(0, 400, 'none').every((s) => !s.haptic && !s.sound), 'a silent count ticked');
    assert.ok(run(0, 400, 'haptic').every((s) => !s.sound), 'a touch-only count made a sound');
    assert.ok(run(0, 400, 'sound').every((s) => !s.haptic), 'a sound-only count ticked under the finger');
    const both = run(0, 400, 'both');
    assert.ok(both.some((s) => s.haptic) && both.some((s) => s.sound), 'a count asked for both made only one');
  });
});
