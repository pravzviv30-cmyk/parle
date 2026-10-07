/**
 * Where a learner is in a practice sitting — whole-app phase 2.
 *
 * A practice sitting is bounded: core's selector deals at most six distinct
 * phrases. The learner could not see that bound, so a sitting read as an
 * open-ended queue with no place to stop. This is the honest answer: which
 * phrase of how many, counted in distinct phrases rather than asks, so a miss
 * that comes round again never moves the learner backwards or inflates the
 * total. It says nothing about how well anybody did: no score, no share, no
 * percentage, and every number is written as a word.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { DrillSessionState, PracticeTarget } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { SITTING_PROGRESS_MAX, queueFill, sittingFill, sittingProgress } from './sittingProgress.ts';

const target = (key: string): PracticeTarget => ({ phraseKey: key, source: { kind: 'review' }, exerciseId: `ex:${key}`, scheduled: true });
const state = (answered: string[], finished = false): DrillSessionState => ({
  queue: [],
  missesById: {},
  answered: answered.map((key) => ({ id: `ex:${key}`, phraseKey: key, outcome: 'correct' as never, attempts: 1 })),
  startedAt: 0,
  finished,
});

describe('where a learner is in a practice sitting', () => {
  test('it counts distinct phrases, starting on the first and never past the last', () => {
    const targets = ['a', 'b', 'c'].map(target);
    assert.deepEqual(sittingProgress(state([]), targets), { step: 1, total: 3, label: 'Phrase one of three' });
    assert.deepEqual(sittingProgress(state(['a']), targets), { step: 2, total: 3, label: 'Phrase two of three' });
    // The last phrase answered: still the last, never "four of three".
    assert.deepEqual(sittingProgress(state(['a', 'b', 'c']), targets), { step: 3, total: 3, label: 'Phrase three of three' });
  });

  test('a phrase answered twice, or an answer outside the sitting, moves nothing', () => {
    const targets = ['a', 'b'].map(target);
    assert.equal(sittingProgress(state(['a', 'a']), targets)!.step, 2, 'a repeat counted twice');
    assert.equal(sittingProgress(state(['zzz']), targets)!.step, 1, 'an answer outside the sitting moved it on');
  });

  test('nothing is drawn where there is no bounded sitting to place the learner in', () => {
    assert.equal(sittingProgress(state([]), []), null, 'an empty sitting was given a strip');
    assert.equal(sittingProgress(null, [target('a')]), null, 'a sitting still being read was given a strip');
    assert.equal(sittingProgress(state(['a'], true), [target('a')]), null, 'a finished sitting still shows where it is');
    const long = Array.from({ length: SITTING_PROGRESS_MAX + 1 }, (_, i) => target(`k${i}`));
    assert.equal(sittingProgress(state([]), long), null, 'a sitting too long to say in words was counted in digits');
  });

  test('every label is words, not digits, and claims nothing about how it went', () => {
    const targets = Array.from({ length: SITTING_PROGRESS_MAX }, (_, i) => target(`k${i}`));
    for (let done = 0; done < targets.length; done += 1) {
      const answered = targets.slice(0, done).map((t) => t.phraseKey);
      const { label } = sittingProgress(state(answered), targets)!;
      assert.doesNotMatch(label, /\d|%|score|right|wrong|correct/i, `"${label}" counts at the learner or grades them`);
      assert.equal(guiltIn(label), undefined, `"${label}" carries a banned word`);
      assert.ok(!label.includes('—'), `"${label}" carries an em dash`);
    }
    assert.ok(SITTING_PROGRESS_MAX >= 6, 'the words run out before core\'s own cap on a sitting');
  });
});

describe('the living bar fills by phrases settled, and only ever fills (come alive, F759)', () => {
  const queued = (keys: string[]): DrillSessionState['queue'] => keys.map((key) => ({ id: `ex:${key}`, phraseKey: key }) as DrillSessionState['queue'][number]);

  test('a practice sitting fills by its own targets, a miss coming round moves nothing, and the last answer fills it', () => {
    const targets = ['a', 'b', 'c', 'd'].map(target);
    const fills = [state([]), state(['a']), state(['a', 'a']), state(['a', 'b', 'zzz']), state(['a', 'b', 'c', 'd'], true)].map((s) => sittingFill(s, targets));
    assert.deepEqual(fills, [0, 0.25, 0.25, 0.5, 1], 'the fill is not settled phrases over phrases in the sitting');
    for (let i = 1; i < fills.length; i += 1) assert.ok(fills[i]! >= fills[i - 1]!, 'the bar moved backwards');
    // Nothing to place: no bar.
    assert.equal(sittingFill(null, targets), null);
    assert.equal(sittingFill(state([]), [target('a')]), null, 'a one-phrase sitting drew a bar with nowhere to go');
  });

  test('an ordinary sitting fills by what its queue and its answers hold', () => {
    const start = { ...state([]), queue: queued(['a', 'b', 'c']) };
    assert.equal(queueFill(start), 0);
    // A miss goes to the back of the queue: same phrase, same total.
    const missed = { ...state([]), queue: queued(['b', 'c', 'a']) };
    assert.equal(queueFill(missed), 0, 'a miss moved the bar');
    const one = { ...state(['a']), queue: queued(['b', 'c']) };
    assert.equal(queueFill(one), 1 / 3);
    assert.equal(queueFill({ ...state(['a', 'b', 'c'], true), queue: [] }), 1);
    assert.equal(queueFill({ ...state([]), queue: queued(['a']) }), null, 'a single exercise drew a bar');
    assert.equal(queueFill(null), null);
    // Longer than the words strip can place, the bar is not drawn either.
    const long = Array.from({ length: SITTING_PROGRESS_MAX + 1 }, (_, i) => `p${i}`);
    assert.equal(queueFill({ ...state([]), queue: queued(long) }), null, 'a sitting too long to place drew a bar');
    assert.equal(sittingFill(state([]), long.map(target)), null);
    assert.equal(queueFill({ ...state([]), queue: queued(long.slice(0, SITTING_PROGRESS_MAX)) }), 0);
  });
});
