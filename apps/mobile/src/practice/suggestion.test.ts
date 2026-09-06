import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DAILY_SCENARIOS, dailyPick } from '@luvani/core';

import { nextOffset, suggestionFor, SUGGESTION } from './suggestion.ts';
import { guiltIn } from '../copy/guilt.ts';

const NOW = new Date(2026, 8, 2, 12, 0, 0).getTime();

describe('the suggestion card walks an authored pool and never asks a model', () => {
  test('the first thing a learner sees is the situation the app already chose for today', () => {
    // Not a second opinion about what today is. `dailyPick` decides, and this
    // starts where it landed, so Home and Practice cannot disagree on day one.
    assert.equal(suggestionFor(DAILY_SCENARIOS, NOW, 0)?.id, dailyPick(DAILY_SCENARIOS, NOW).id);
  });

  test('tapping walks forward one at a time and meets every situation before repeating', () => {
    const seen = new Set<string>();
    let offset = 0;
    for (let i = 0; i < DAILY_SCENARIOS.length; i += 1) {
      const shown = suggestionFor(DAILY_SCENARIOS, NOW, offset);
      assert.ok(shown !== null, 'the walk ran off the end of the pool');
      seen.add(shown.id);
      offset = nextOffset(offset, DAILY_SCENARIOS.length);
    }

    assert.equal(seen.size, DAILY_SCENARIOS.length, 'one turn of the pool showed the same situation twice');
    assert.equal(offset, 0, 'the walk did not come back round to where it started');
  });

  test('a corrupt stored offset draws a card rather than refusing to draw one', () => {
    // It can only arrive from a value somebody edited or a partial write. A
    // card that will not render is worse than a card showing something.
    for (const bad of [-4, Number.NaN, 2.7, Number.POSITIVE_INFINITY]) {
      assert.ok(suggestionFor(DAILY_SCENARIOS, NOW, bad) !== null, `an offset of ${bad} drew nothing`);
    }
    assert.equal(nextOffset(Number.NaN, DAILY_SCENARIOS.length), 1);
    assert.equal(nextOffset(0, 0), 0, 'an empty pool produced an offset into it');
  });

  test('an empty pool says so by drawing nothing, rather than throwing behind a rendered screen', () => {
    assert.equal(suggestionFor([], NOW, 0), null);
  });

  test('the card says what it does, and what it does is suggest rather than generate', () => {
    // The mockup calls this Generate New Scenario. Nothing here reaches a
    // model, so nothing here claims to. The founder asked for the pool
    // precisely so a nervous learner tapping three times waits for nothing.
    assert.equal(SUGGESTION.another, 'Suggest another');
    assert.ok(!/generat/i.test(SUGGESTION.another), 'the button claims to generate something it looks up');

    for (const line of Object.values(SUGGESTION)) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a word this app does not say to a learner`);
      assert.ok(!line.includes('—'), `"${line}" has an em dash in copy a learner reads`);
    }
  });
});
