/**
 * The pill on a situation, and the four things the mockup's pills said.
 *
 * "100%", "85% Spoken", "70% Active" and "Locked - Next" are all claims this
 * product cannot make: three are shares with no denominator, and the fourth is
 * a state that does not exist, because every situation is open in any order.
 * These hold what replaced them to the same bar the rest of the tab keeps.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { MissionState } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { STAMP_STATES } from '../progress/passport.ts';
import { CHIP, SITUATIONS, chipFor, ownLine } from './situations.ts';

const STATES: MissionState[] = ['new', 'in-progress', 'complete', 'needs-review'];

describe('the situation pill — F467', () => {
  test('only a scene handled with nothing handed over is filled', () => {
    // The same claim the passport's mark made, in words. If any other state
    // took the green, "on your own" would stop meaning anything.
    for (const stamp of STAMP_STATES) {
      for (const state of STATES) {
        const chip = chipFor(stamp, state);
        assert.equal(chip.earned, stamp === 'on-your-own', `${stamp}/${state} was filled as though it were earned`);
      }
    }
  });

  test('every combination says something, and nothing says it is locked', () => {
    // `suggestedMission` deliberately gates nothing, so a pill claiming a
    // situation is unavailable would be inventing a wall the product refuses.
    for (const stamp of STAMP_STATES) {
      for (const state of STATES) {
        const { text } = chipFor(stamp, state);
        assert.notEqual(text.trim(), '', `${stamp}/${state} produced an empty pill`);
        assert.doesNotMatch(text, /lock|unlock|not available|coming soon/i, `${stamp}/${state} says "${text}"`);
      }
    }
  });

  test('the three ways of not having finished are told apart', () => {
    // "Never walked into", "walked into and unfinished" and "the phrases are
    // going quiet" are different things, and only one of them is a first visit.
    assert.equal(chipFor('not-yet', 'new').text, CHIP.ready);
    assert.equal(chipFor('not-yet', 'in-progress').text, CHIP.started);
    assert.equal(chipFor('not-yet', 'needs-review').text, CHIP.again);
    assert.notEqual(CHIP.again, CHIP.ready, 'coming back to a scene and never having walked into it read the same');
    assert.equal(chipFor('with-help', 'complete').text, CHIP.helped);
    assert.equal(chipFor('on-your-own', 'complete').text, CHIP.own);
  });

  test('no pill carries a number, a share, or a word that scolds', () => {
    for (const text of Object.values(CHIP)) {
      assert.doesNotMatch(text, /\d|%/, `"${text}" counts at the learner on a row`);
      assert.equal(guiltIn(text), undefined, `"${text}" carries a banned word`);
      assert.ok(!text.includes('—'), `"${text}" carries an em dash`);
    }
  });

  test('a pill is short enough to sit beside a title', () => {
    // The whole reason this module exists, and the number is not arbitrary. At
    // 375pt an eighteen-character pill left the title column narrower than
    // "réception", so the word hyphenated itself in the middle. Twelve is what
    // fits beside the longest situation name this catalogue carries.
    for (const text of Object.values(CHIP)) {
      assert.ok(text.length <= 12, `"${text}" is ${text.length} characters and will break a title mid-word`);
    }
  });
});

describe('the count above the situations — F467', () => {
  test('nothing is claimed until something is earned', () => {
    // A tick beside a nought is the rail of empty marks in another shape.
    assert.equal(ownLine(0), null);
    assert.equal(ownLine(-1), null);
  });

  test('it counts, and it never divides', () => {
    // My French may count; `progress/evidence.ts` settled that. What it may not
    // do is put a denominator under the number, and there is none to put.
    assert.equal(ownLine(1), '1 handled on your own');
    assert.equal(ownLine(4), '4 handled on your own');
    for (const n of [1, 3, 6]) {
      assert.doesNotMatch(ownLine(n)!, /%|of \d|\/\d/, `the count for ${n} became a share`);
    }
  });

  test('the section says what it judges from, and does not overclaim it', () => {
    for (const line of Object.values(SITUATIONS)) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a banned word`);
      assert.ok(!line.includes('—'), `"${line}" carries an em dash`);
    }
    assert.match(SITUATIONS.blurb, /conversation/i, 'the blurb does not say where the judgement comes from');
  });
});
