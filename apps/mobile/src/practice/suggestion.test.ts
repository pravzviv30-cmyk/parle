import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DAILY_SCENARIOS, scenariosForLevel } from '@luvani/core';

import { reshuffle, suggestionFor, walkOn, SUGGESTION, type Walk } from './suggestion.ts';
import { guiltIn } from '../copy/guilt.ts';

const START: Walk = { seed: 4242, position: 0 };

describe('the suggestion card deals the pool, and never asks a model', () => {
  test('walking meets every situation in the pool before repeating one', () => {
    // The founder wants five hundred situations worth tapping through. That is
    // only true if the walk is a deal rather than a sample.
    const pool = scenariosForLevel(DAILY_SCENARIOS, 0);
    assert.ok(pool.length > 0, 'the beginner tier is empty, so a new learner has no situations at all');

    const seen = new Set<string>();
    let walk = START;
    for (let i = 0; i < pool.length; i += 1) {
      const shown = suggestionFor(pool, walk);
      assert.ok(shown !== null, 'the walk ran off the end of the pool');
      seen.add(shown.id);
      walk = walkOn(walk, pool.length);
    }

    assert.equal(seen.size, pool.length, 'one turn of the pool showed the same situation twice');
    assert.equal(walk.position, 0, 'the walk did not come back round to where it started');
    assert.equal(walk.seed, START.seed, 'the deal changed under the learner part way through');
  });

  test('the order is the learner\'s own, not the order the pool was written in', () => {
    // The reason this exists. The authored order is grouped by theme, so
    // walking it met eleven cafes and then twelve hotels.
    const pool = scenariosForLevel(DAILY_SCENARIOS, 0);
    const dealt = [suggestionFor(pool, START)?.id, suggestionFor(pool, walkOn(START, pool.length))?.id];
    const authored = [pool[0]?.id, pool[1]?.id];
    assert.notDeepEqual(dealt, authored, 'the deal handed back the pool in the order it was written');
  });

  test('two learners get different orders, and one learner gets the same one twice', () => {
    const pool = scenariosForLevel(DAILY_SCENARIOS, 0);
    assert.equal(suggestionFor(pool, START)?.id, suggestionFor(pool, { ...START })?.id);
    assert.notEqual(suggestionFor(pool, START)?.id, suggestionFor(pool, { seed: 99, position: 0 })?.id);
  });

  test('a reshuffle starts a new order from the top', () => {
    const fresh = reshuffle(777);
    assert.equal(fresh.position, 0, 'a fresh deal started part way through itself');
    assert.equal(fresh.seed, 777);
    assert.equal(reshuffle(Number.NaN).seed, 0, 'a corrupt seed produced a corrupt deal');
  });

  test('the pool is pitched, so a beginner never meets a scene meant for somebody else', () => {
    // The founder asked for this on 2026-09-06. A nervous beginner opening the
    // card onto an official and a deadline is the anxiety the product exists to
    // lower, and the tier is read through the same rule the word of the day
    // already uses rather than a second opinion.
    for (const levelIndex of [0, 1, 2, 3, 4, 5]) {
      const pool = scenariosForLevel(DAILY_SCENARIOS, levelIndex);
      assert.ok(pool.length > 0, `level ${levelIndex} has no situations at all`);
      const tiers = new Set(pool.map((scenario) => scenario.tier));
      assert.equal(tiers.size, 1, `level ${levelIndex} was shown situations from ${tiers.size} tiers at once`);
    }
    assert.equal(scenariosForLevel(DAILY_SCENARIOS, 0)[0]?.tier, 1, 'a beginner is not pitched at the first tier');
  });

  test('an empty pool says so by drawing nothing, rather than throwing behind a screen', () => {
    assert.equal(suggestionFor([], START), null);
    assert.deepEqual(walkOn(START, 0), { seed: START.seed, position: 0 });
  });

  test('the card says what it does, and what it does is suggest rather than generate', () => {
    // Nothing here reaches a model. The founder asked for the authored pool
    // precisely so a nervous learner tapping three times waits for nothing.
    assert.equal(SUGGESTION.another, 'Suggest another');
    assert.ok(!/generat/i.test(SUGGESTION.another), 'the button claims to generate something it looks up');

    for (const line of Object.values(SUGGESTION)) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a word this app does not say to a learner`);
      assert.ok(!line.includes('—'), `"${line}" has an em dash in copy a learner reads`);
    }
  });
});
