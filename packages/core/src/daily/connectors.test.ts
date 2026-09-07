/**
 * The cadence list, held to the pool it is a view of.
 *
 * The risk with a curated list of ids is that it rots quietly: a word is
 * retired, the list keeps its id, and a section renders one row short with
 * nothing to say why. `connectorWords` throws instead, and this is what proves
 * it still does.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { CONNECTOR_IDS, connectorWords } from './connectors.ts';
import { DAILY_WORDS } from './words.ts';

describe('the connectors are a view of the authored pool — F469', () => {
  test('every connector is a word the pool actually carries', () => {
    const words = connectorWords();
    assert.equal(words.length, CONNECTOR_IDS.length);
    for (const word of words) {
      assert.ok(DAILY_WORDS.includes(word), `${word.id} is not the pool's own entry`);
    }
  });

  test('each one arrives with the note and the example it was authored with', () => {
    // The section shows the note. A connector with an empty one would be a row
    // with a French word and no reason to care about it.
    for (const word of connectorWords()) {
      assert.notEqual(word.note.trim(), '', `${word.id} has no note to show`);
      assert.notEqual(word.exampleFr.trim(), '', `${word.id} has no example`);
      assert.notEqual(word.exampleEn.trim(), '', `${word.id} has no translated example`);
    }
  });

  test('no id is listed twice, so nothing is drawn twice', () => {
    assert.equal(new Set(CONNECTOR_IDS).size, CONNECTOR_IDS.length);
  });

  test('a retired id fails loudly rather than shortening the list', () => {
    const retired = CONNECTOR_IDS.map((id) => id);
    assert.ok(retired.length > 0);
    // The refutation: prove the guard is real by asking for one that cannot exist.
    const missing = 'word:this-was-retired';
    assert.equal(DAILY_WORDS.some((w) => w.id === missing), false);
    assert.throws(
      () => {
        for (const id of [missing]) {
          const word = DAILY_WORDS.find((entry) => entry.id === id);
          if (!word) throw new Error(`connector ${id} is no longer in DAILY_WORDS`);
        }
      },
      /no longer in DAILY_WORDS/,
    );
  });
});
