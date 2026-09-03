import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { authoredPhraseKeys, buildPath, newCard, phraseKeyOf, type ReviewCard } from '@luvani/core';

import { NEXT_STEP, nextStep, reviewLine } from './nextStep.ts';
import { guiltIn } from '../copy/guilt.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

/** A card the scheduler wants back right now. */
function due(fr: string): ReviewCard {
  const card = newCard({ id: phraseKeyOf(fr), kind: 'vocab', front: fr, back: 'x', context: '', ipa: '' }, NOW - DAY);
  return { ...card, due: NOW - DAY };
}

/**
 * A card earned and held back until tomorrow, keyed by its own id.
 *
 * Keyed on the id directly, not through `phraseKeyOf`, because the ids here come
 * from `authoredPhraseKeys()` and are already the `phrase:...` keys the path
 * projects over; running them through the keyer again would double the prefix
 * and match nothing.
 */
function settled(id: string): ReviewCard {
  const card = newCard({ id, kind: 'vocab', front: id, back: 'x', context: '', ipa: '' }, NOW);
  return { ...card, due: NOW + DAY };
}

describe('The Practice tab\'s next step — what to do now, decided in one rule', () => {
  test("review outranks the path's next row when cards are due", () => {
    // Two cards the scheduler wants back, and a path that has plenty it could
    // point at. The rule is that a phrase slipping away beats new ground, so the
    // step is the review, and its count is exactly the due count.
    const deck = [due('Un café'), due('Une eau')];
    const units = buildPath(deck, [], [], { lessonDone: false }, NOW);

    // Precondition: the path really does mark a row next, so this proves review
    // wins a contest rather than walking in unopposed.
    assert.ok(
      units.flatMap((u) => u.nodes).some((n) => n.isNext),
      'the path should mark a next row for review to outrank',
    );
    assert.deepEqual(nextStep(units, deck, NOW), { kind: 'review', due: 2 });
  });

  test('with nothing due, the step is exactly the row the path marked next', () => {
    const units = buildPath([], [], [], { lessonDone: false }, NOW);
    const marked = units.flatMap((u) => u.nodes).find((n) => n.isNext);
    assert.ok(marked !== undefined, 'the path should mark exactly one next row');

    const step = nextStep(units, [], NOW);
    if (step === null || step.kind !== 'node') {
      throw new Error('expected a node step when nothing is due');
    }
    // The very object the path marked, not a copy: the tab opens that same row.
    assert.equal(step.node, marked);
  });

  test('with nothing due and nothing to do, there is no step at all', () => {
    // Every authored phrase earned and none due makes every phrases row
    // complete; a finished lesson completes the lesson row; an empty bank leaves
    // the "mine" row locked. So the path marks nothing next, and with the deck
    // settled there is nothing to review either.
    const deck = [...new Set(authoredPhraseKeys())].map(settled);
    const units = buildPath(deck, [], [], { lessonDone: true }, NOW);

    assert.equal(
      units.flatMap((u) => u.nodes).some((n) => n.isNext),
      false,
      'a finished path marks no next row',
    );
    assert.equal(nextStep(units, deck, NOW), null);
  });

  test('nothing the practice headline says carries a word that scolds', () => {
    for (const line of [...Object.values(NEXT_STEP), reviewLine(1), reviewLine(3)]) {
      const guilt = guiltIn(line);
      assert.equal(guilt, undefined, `"${line}" leans on guilt with "${guilt}"`);
    }
    assert.equal(reviewLine(1), '1 card is ready');
    assert.equal(reviewLine(3), '3 cards are ready');
  });
});
