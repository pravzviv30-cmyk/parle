/**
 * The fold, and the two promises it makes to the screen above it.
 *
 * The first is that it decides everything, so `MyFrenchTab.tsx` can decide
 * nothing. The second is that it writes nothing: `sync/policy.ts` states the
 * rule, and a model that quietly sorted its own input in place would be a
 * derived value with a side effect attached.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { levelFor, missionStates, type ReviewCard } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { OPENING, hasDeckLane, hasMapLane, hasMyFrench, myFrenchFrom } from './model.ts';

const NOW = Date.parse('2026-09-07T09:00:00Z');
const MISSIONS = missionStates([], [], NOW);

const EMPTY = {
  deck: [] as readonly ReviewCard[],
  missions: [],
  checks: [],
  evidence: { situations: 0, lines: 0, standing: levelFor(0), stats: [] },
  book: { groups: [], count: 0, topics: 0 },
  saved: [],
  next: null,
  packs: [],
  now: NOW,
};

describe('the model — it decides, and it writes nothing', () => {
  test('a brand new learner gets a page with nothing on it and no blanks', () => {
    const model = myFrenchFrom(EMPTY);

    assert.equal(model.oneLine, null);
    assert.equal(model.ledger.featured, null);
    assert.deepEqual(model.situations, []);
    assert.equal(model.showStamps, false);
    assert.equal(hasMyFrench(model), false);
  });

  test('the situations arrive with every word on them already chosen', () => {
    // The screen maps and spells none of it. A ternary on `independence` here
    // would be a second ladder one screen away from the first.
    const model = myFrenchFrom({ ...EMPTY, missions: MISSIONS });

    assert.equal(model.situations.length, MISSIONS.length);
    for (const row of model.situations) {
      assert.equal(typeof row.status, 'string');
      assert.notEqual(row.status, '', 'a situation row arrived with no status line');
      assert.equal(typeof row.earned, 'boolean');
      assert.equal(typeof row.action.label, 'string');
    }
  });

  test('nothing it is handed is mutated', () => {
    const deck: ReviewCard[] = [
      {
        id: 'phrase:one', kind: 'vocab', front: 'du coup', back: 'so', context: '', ipa: '',
        addedAt: NOW, due: NOW, intervalDays: 6, ease: 2.5, reps: 3, lapses: 0,
        evidence: { retrievals: 1, convoUses: 2, transfers: 0 },
      },
      {
        id: 'phrase:two', kind: 'vocab', front: 'en fait', back: 'actually', context: '', ipa: '',
        addedAt: NOW, due: NOW, intervalDays: 6, ease: 2.5, reps: 3, lapses: 0,
        evidence: { retrievals: 1, convoUses: 9, transfers: 0 },
      },
    ];
    const before = JSON.stringify(deck);
    const missions = [...MISSIONS];

    myFrenchFrom({ ...EMPTY, deck, missions });

    assert.equal(JSON.stringify(deck), before, 'the deck came back in a different order or shape');
    assert.deepEqual(missions, [...MISSIONS], 'the missions were sorted in place');
  });

  test('a lane is empty until something is actually in it', () => {
    assert.equal(hasMapLane(myFrenchFrom(EMPTY)), false);
    assert.equal(hasMapLane(myFrenchFrom({ ...EMPTY, missions: MISSIONS })), true);
    assert.equal(hasDeckLane(myFrenchFrom(EMPTY)), false);
    assert.equal(
      hasDeckLane(myFrenchFrom({ ...EMPTY, book: { groups: [], count: 3, topics: 1 } })),
      true,
    );
  });
});

describe('the model — the words a learner meets first', () => {
  test('the opening card is warm, clean and promises only what the page can do', () => {
    for (const line of Object.values(OPENING)) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a banned word`);
      assert.ok(!line.includes('—'), `"${line}" carries an em dash`);
      assert.doesNotMatch(line, /\d/, `"${line}" counts at a learner who has nothing yet`);
    }
  });

  test('the zero-state predicate is not a second copy of the evidence row’s gate', () => {
    // `progress/evidence.ts` already exports `hasEvidence` for a narrower
    // question on this same screen. Two near-identical predicates deciding two
    // zero states is how one of them quietly stops being consulted.
    const source = readFileSync(fileURLToPath(new URL('./model.ts', import.meta.url)), 'utf8');
    assert.match(source, /export function hasMyFrench/);
    assert.doesNotMatch(source, /export function hasEvidence/, 'the model grew its own hasEvidence');
  });
});
