/**
 * One line, and the order it is chosen in.
 *
 * The tiers are the whole design. If the pick were "any due card" the page
 * would be a one card review screen, and the reason printed above it would be a
 * decoration. These hold the order, and they hold the two refusals that make
 * the tier list honest: a card the learner has never recalled is never asked
 * for, and a card the scheduler is not asking for is shown rather than tested.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evidenceStateOf, firstReturn, isSettled, type ReviewCard } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import {
  CLOSING_LINE,
  GRADE_LABELS,
  ONE_LINE_LABEL,
  REASONS,
  oneLineFrom,
} from './oneLine.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-09-07T09:00:00Z');

function card(over: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id: 'phrase:addition',
    kind: 'vocab',
    front: "l'addition, s'il vous plaît",
    back: 'the bill, please',
    context: "Je peux avoir l'addition, s'il vous plaît ?",
    ipa: 'ladisjɔ̃',
    addedAt: NOW - 30 * DAY,
    due: NOW - DAY,
    intervalDays: 6,
    ease: 2.5,
    reps: 3,
    lapses: 0,
    ...over,
  };
}

/** A card got right exactly once, a day ago, and back for its first real test. */
const firstReturnCard = (over: Partial<ReviewCard> = {}): ReviewCard =>
  card({ id: 'phrase:first', reps: 1, intervalDays: 1, due: NOW - 60_000, ...over });

/** A card the learner has already used in a real conversation, and it is due. */
const usedCard = (over: Partial<ReviewCard> = {}): ReviewCard =>
  card({ id: 'phrase:used', evidence: { retrievals: 2, convoUses: 2, transfers: 0 }, ...over });

/** Earned, and not currently wanted back. */
const settledCard = (over: Partial<ReviewCard> = {}): ReviewCard =>
  card({ id: 'phrase:settled', due: NOW + 20 * DAY, intervalDays: 21, reps: 5, ...over });

describe('one line — which card, and why', () => {
  test('an empty deck deals nothing at all', () => {
    assert.equal(oneLineFrom({ deck: [], now: NOW }), null);
  });

  test('a first return outranks a due phrase the learner already uses', () => {
    // Both are due and both are worth asking for. The first return happens on
    // exactly one day in a card's life and today is that day.
    const deck = [usedCard(), firstReturnCard()];
    assert.ok(firstReturn(deck[1]!, NOW), 'the fixture stopped being a first return');
    assert.equal(evidenceStateOf(deck[0]!, NOW), 'used', 'the fixture stopped being a used card');

    const dealt = oneLineFrom({ deck, now: NOW });

    assert.equal(dealt?.tier, 'firstReturn');
    assert.equal(dealt?.card.id, 'phrase:first');
    assert.equal(dealt?.reason, REASONS.firstReturn);
    assert.equal(dealt?.askable, true);
  });

  test('a phrase used in conversation outranks an ordinary due card', () => {
    const dealt = oneLineFrom({ deck: [card({ id: 'phrase:plain' }), usedCard()], now: NOW });

    assert.equal(dealt?.tier, 'used');
    assert.equal(dealt?.card.id, 'phrase:used');
    assert.equal(dealt?.reason, REASONS.used);
  });

  test('a transferred phrase counts as used, and is not skipped past', () => {
    // `evidenceStateOf` answers 'transferred' the moment transfers reaches one.
    // A tier that only matched 'used' would drop the strongest phrase the
    // learner owns straight into the ordinary pile.
    const transferred = card({ id: 'phrase:moved', evidence: { retrievals: 1, convoUses: 1, transfers: 1 } });
    assert.equal(evidenceStateOf(transferred, NOW), 'transferred');

    const dealt = oneLineFrom({ deck: [card({ id: 'phrase:plain' }), transferred], now: NOW });

    assert.equal(dealt?.tier, 'used');
    assert.equal(dealt?.card.id, 'phrase:moved');
  });

  test('among plain due cards the one carrying a real note is preferred', () => {
    // The note is the memory hook. A card whose context merely repeats a face
    // is carrying nothing, and must not win on the strength of a duplicate.
    const bare = card({ id: 'phrase:bare', context: '' });
    const echoing = card({ id: 'phrase:echo', back: 'the bill', context: 'the bill' });
    const noted = card({ id: 'phrase:noted' });

    assert.equal(oneLineFrom({ deck: [bare, echoing, noted], now: NOW })?.card.id, 'phrase:noted');
  });

  test('a learner who is up to date is shown a phrase and not tested on it', () => {
    const dealt = oneLineFrom({ deck: [settledCard()], now: NOW });

    assert.ok(isSettled(settledCard(), NOW), 'the fixture stopped being settled');
    assert.equal(dealt?.tier, 'settled');
    assert.equal(dealt?.reason, REASONS.settled);
    assert.equal(dealt?.askable, false, 'a card the scheduler is not asking for was dressed as a task');
  });

  test('a card the learner has never recalled is never dealt', () => {
    // Producing a phrase nobody has ever recalled is a test with no teaching in
    // it, and `phrasebook.ts` refuses to call it something they can say.
    const fresh = card({ id: 'phrase:new', reps: 0, intervalDays: 0, due: NOW - DAY });
    assert.equal(oneLineFrom({ deck: [fresh], now: NOW }), null);
  });

  test('a sound is not a line, so a phoneme card is never dealt', () => {
    const phoneme = card({ id: 'phoneme:y', kind: 'phoneme', front: 'y', back: 'the u sound' });
    assert.equal(oneLineFrom({ deck: [phoneme], now: NOW }), null);
  });
});

describe('one line — what it is allowed to say', () => {
  test('no line names a day, because a first return may be a week old', () => {
    // cardView.ts records the reason: a card is due from the moment its day is
    // up, so a learner returning after a week meets a first return whose one
    // day was six days ago. Naming the day would be wrong for exactly the
    // learner who most needs this page.
    const days = /\b(yesterday|today|tomorrow|last night|this morning|this week)\b/i;
    for (const line of [...Object.values(REASONS), CLOSING_LINE, ONE_LINE_LABEL, ...Object.values(GRADE_LABELS)]) {
      assert.doesNotMatch(line, days, `"${line}" dates a memory this page cannot date`);
    }
  });

  test('every word of it passes the guilt list and carries no em dash', () => {
    for (const line of [...Object.values(REASONS), CLOSING_LINE, ONE_LINE_LABEL, ...Object.values(GRADE_LABELS)]) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a banned word`);
      assert.ok(!line.includes('—'), `"${line}" carries an em dash`);
    }
  });

  test('the grades are two, because a third is a sitting decided about itself', () => {
    assert.deepEqual(Object.keys(GRADE_LABELS), ['good', 'again']);
  });
});
