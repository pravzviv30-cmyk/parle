/**
 * The run of real passes the living bar glows by (core-loop 2.2). Pure.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { COMBO_GLOW_FROM, comboAfter, comboGlows } from './combo.ts';

describe('the run the bar glows by', () => {
  test('only answers the code judged move the run, and a miss ends it quietly', () => {
    let run = 0;
    for (const verdict of ['good', 'typo', 'good'] as const) run = comboAfter(run, verdict, 'listen-type');
    assert.equal(run, 3);
    assert.equal(comboGlows(run), true, 'three real passes in a row do not glow');
    assert.equal(comboGlows(COMBO_GLOW_FROM - 1), false);
    assert.equal(comboAfter(run, 'miss', 'fill-blank'), 0, 'a miss does not end the run');
  });

  test('a repeat-this never extends the glow, and an own-words retry leaves the run where it stood', () => {
    // Saying it aloud is the learner's own report, so it is neither a pass nor a miss.
    assert.equal(comboAfter(2, 'good', 'repeat-this'), 2, 'a self-report extended the run');
    assert.equal(comboAfter(2, 'miss', 'repeat-this'), 2);
    let run = 0;
    for (let i = 0; i < 5; i += 1) run = comboAfter(run, 'good', 'repeat-this');
    assert.equal(comboGlows(run), false, 'five self-reports lit the glow');
    // Own words, keyed on core's decision.
    assert.equal(comboAfter(2, 'miss', 'own-words', 'retry'), 2, 'a second try is an invitation, not the end of a run');
    assert.equal(comboAfter(2, 'good', 'own-words', 'good'), 3);
    assert.equal(comboAfter(2, 'miss', 'own-words', 'reveal'), 0);
    // A run that is not a whole number starts again from nothing.
    assert.equal(comboAfter(Number.NaN, 'good', 'translate'), 1);
    assert.equal(comboAfter(-4, 'typo', 'translate'), 1);
  });
});
