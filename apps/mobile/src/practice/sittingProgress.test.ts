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
import { SITTING_PROGRESS_MAX, sittingProgress } from './sittingProgress.ts';

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
