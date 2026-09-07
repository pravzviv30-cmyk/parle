/**
 * One pill renders, and the count of two is honest.
 *
 * `surfaceContract.test.ts` counts `<PillButton` per tab file and pins each at
 * exactly what it draws. Moving My French from one to two is only defensible
 * while the two branches cannot both be true, so that is held here as a
 * property over every combination rather than as one happy example. If a third
 * branch is ever added, the exhaustive walk below fails before the count does.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { levelFor, type MissionProgress, type ReviewCard } from '@luvani/core';

import type { MyFrench } from './model.ts';
import type { OneLine } from './oneLine.ts';
import { primaryFor } from './primary.ts';

const NOW = Date.parse('2026-09-07T09:00:00Z');

const CARD: ReviewCard = {
  id: 'phrase:one',
  kind: 'vocab',
  front: 'du coup',
  back: 'so, therefore',
  context: '',
  ipa: '',
  addedAt: NOW,
  due: NOW,
  intervalDays: 6,
  ease: 2.5,
  reps: 3,
  lapses: 0,
};

const NEXT = { mission: { id: 'mission:cafe', titleEn: 'Order at a café' } } as unknown as MissionProgress;

function model(over: Partial<MyFrench> = {}): MyFrench {
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
    ...over,
  };
}

const askable: OneLine = { card: CARD, tier: 'due', reason: 'One that is round again.', askable: true };
const shownOnly: OneLine = { card: CARD, tier: 'settled', reason: 'Nothing is waiting.', askable: false };

describe('the primary — which branch draws the pill', () => {
  test('a line the learner can be asked for is the primary', () => {
    // Producing French outranks navigating to a place to produce it.
    assert.deepEqual(primaryFor(model({ oneLine: askable, next: NEXT })), { kind: 'line' });
  });

  test('a learner whose deck cannot deal a line still has one clear thing to do', () => {
    assert.deepEqual(primaryFor(model({ next: NEXT })), { kind: 'situation' });
  });

  test('a card that is shown rather than asked for carries no primary', () => {
    // The settled tier is a gift. Dressing it as a task would make being up to
    // date cost something, which is the quota this app refuses everywhere else.
    assert.deepEqual(primaryFor(model({ oneLine: shownOnly, next: NEXT })), { kind: 'situation' });
  });

  test('a learner with neither draws no pill at all', () => {
    assert.equal(primaryFor(model()), null);
    assert.equal(primaryFor(model({ oneLine: shownOnly })), null);
  });

  test('the two branches are mutually exclusive over every combination', () => {
    // This is what makes the surface contract's count of two honest: the file
    // holds two `<PillButton`, and no input can put both on screen.
    for (const line of [null, askable, shownOnly]) {
      for (const next of [null, NEXT]) {
        const primary = primaryFor(model({ oneLine: line, next }));
        assert.ok(
          primary === null || primary.kind === 'line' || primary.kind === 'situation',
          'a third branch appeared without the count moving',
        );
      }
    }
  });
});
