/**
 * The goal rows My French draws, as a value (Stage 4, 2026-09-25).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS } from '@luvani/core';

import { GOALS_ROW_OPEN } from '../myfrench/copy.ts';
import { goalRouteKey, goalRows } from './rows.ts';

describe('the goal rows — Stage 4', () => {
  test('no goals, no rows', () => {
    assert.deepEqual(goalRows([], MISSIONS), []);
  });

  test('one row per goal, in the learner\'s words, with the next task and its honest fit', () => {
    const rows = goalRows(['Order a coffee in Paris', 'Pass my exam'], MISSIONS);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.goal, 'Order a coffee in Paris');
    assert.equal(rows[0]!.line, 'Next: Order at a café (matches your goal)');
    assert.equal(rows[1]!.goal, 'Pass my exam');
    assert.equal(rows[1]!.line, 'A good place to start: Order at a café');
    assert.doesNotMatch(rows[1]!.line, /match/i, 'a starting point on My French claims to match the goal');
  });

  test('a screen reader hears where the row goes, the goal and the next task, once each', () => {
    const [row] = goalRows(['Order a coffee in Paris'], MISSIONS);
    assert.equal(row!.spoken, `${GOALS_ROW_OPEN}. Order a coffee in Paris. Next: Order at a café (matches your goal).`);
  });

  test('an empty catalogue still draws the goal, with no invented task', () => {
    const rows = goalRows(['Pass my exam'], []);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.line, null);
  });

  test('a route carries an opaque key for a goal, never its words — Stage 4 review', () => {
    // On the web a route's params are the address bar and the browser history,
    // and a goal is the learner's own words (lead browser proof, 2026-09-25).
    const goal = 'Check into my hotel in Lyon without switching to English';
    const key = goalRouteKey(goal);
    assert.match(key, /^[0-9a-z]{1,7}$/, 'the key is not a short base-36 token');
    for (const word of ['check', 'hotel', 'lyon', 'english', 'switch']) assert.ok(!key.includes(word), `the key spells "${word}"`);
    // The same goal however it is cased, accented or punctuated, because the
    // screens compare it with the profile's goals the way `factKey` does.
    assert.equal(goalRouteKey('  CHECK into my hôtel in Lyon, without switching to English!  '), key);
    assert.equal(goalRouteKey('Understand French films'), goalRouteKey('Understand French films'));
    assert.notEqual(goalRouteKey('Understand French films'), key);
    assert.notEqual(goalRouteKey('Order a coffee in Paris'), goalRouteKey('Order a coffee in Lyon'));
  });
});
