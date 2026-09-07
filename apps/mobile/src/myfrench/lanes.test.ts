/**
 * Two lanes, and the control that is absent when one of them is empty.
 *
 * The founder chose the two words, so they are asserted literally rather than
 * described. The rest is one rule: a segmented control with an empty half is an
 * invitation to find nothing.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { guiltIn } from '../copy/guilt.ts';
import { LANES, LANES_LABEL, MY_FRENCH_PURPOSE, openingLane, showLanes } from './lanes.ts';
import { levelFor } from '@luvani/core';

import type { MyFrench } from './model.ts';

/** A learner with nothing yet: both lanes empty, and no card to deal. */
function model(): MyFrench {
  return {
    oneLine: null,
    ledger: { featured: null, rows: [], cadenceLine: null, moreLine: null },
    evidence: { situations: 0, lines: 0, standing: levelFor(0), stats: [] },
    situations: [],
    readyLine: null,
    acoustic: null,
    cadence: { words: [], earned: 0 },
    showStamps: false,
    saved: [],
    next: null,
    book: { groups: [], count: 0, topics: 0 },
    packs: [],
  };
}

/** Something in the Spoken Map lane: one situation row is enough to give it a body. */
function withMap(base: MyFrench): MyFrench {
  return {
    ...base,
    evidence: { ...base.evidence, situations: 1, stats: [{ value: '1', label: 'Situation handled' }] },
  };
}

/** Something in the Memory Deck lane: one phrase the learner has used unprompted. */
function withDeck(base: MyFrench): MyFrench {
  return {
    ...base,
    ledger: {
      featured: {
        id: 'phrase:one',
        front: 'du coup',
        back: 'so, therefore',
        wholeLine: false,
        transferLine: null,
        claim: 'This one came out in conversation. Nobody asked you for it.',
        note: null,
        ipa: '',
      },
      rows: [],
      cadenceLine: null,
      moreLine: null,
    },
  };
}

describe('the lanes — the founder’s two words', () => {
  test('the switch says exactly Spoken Map and Memory Deck, in that order', () => {
    assert.deepEqual(LANES, [
      { key: 'map', label: 'Spoken Map' },
      { key: 'deck', label: 'Memory Deck' },
    ]);
  });

  test('the group says what it is a choice of', () => {
    // F368: "tab one of two" names nothing. The group carries its own label.
    assert.equal(LANES_LABEL, 'What to look at');
  });

  test('the purpose line and the labels are clean copy', () => {
    for (const line of [MY_FRENCH_PURPOSE, LANES_LABEL, ...LANES.map((lane) => lane.label)]) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a banned word`);
      assert.ok(!line.includes('—'), `"${line}" carries an em dash`);
    }
  });

  test('the purpose line is a real sentence, since the tab is refused without one', () => {
    assert.ok(MY_FRENCH_PURPOSE.length > 0);
    assert.match(MY_FRENCH_PURPOSE, /\.$/);
  });
});

describe('the lanes — when the control is drawn at all', () => {
  const empty: MyFrench = model();

  test('a learner with nothing meets no switch', () => {
    assert.equal(showLanes(empty), false);
  });

  test('one lane with something in it renders bare, with no half to find empty', () => {
    assert.equal(showLanes(withMap(empty)), false);
    assert.equal(showLanes(withDeck(empty)), false);
  });

  test('the switch appears once both lanes have a body', () => {
    assert.equal(showLanes(withDeck(withMap(empty))), true);
  });

  test('a learner whose whole history is conversation does not open on a blank map', () => {
    assert.equal(openingLane(withDeck(empty)), 'deck');
  });

  test('everyone else opens on the map', () => {
    assert.equal(openingLane(empty), 'map');
    assert.equal(openingLane(withMap(empty)), 'map');
    assert.equal(openingLane(withDeck(withMap(empty))), 'map');
  });
});
