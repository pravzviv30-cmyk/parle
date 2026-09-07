/**
 * The connectors, and the one number that may not be drawn.
 *
 * The authored half has to be there on a first morning, and the earned half has
 * to be genuinely earned: the mark says the learner produced the word
 * unprompted in a real conversation, which is the only claim `convoUses`
 * licenses and the strongest one this product can make.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { connectorWords, type ReviewCard } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { CADENCE, cadenceFrom } from './cadence.ts';

const NOW = Date.parse('2026-09-07T09:00:00Z');

function card(front: string, convoUses: number): ReviewCard {
  return {
    id: `phrase:${front.replace(/\s+/g, '-')}`,
    kind: 'vocab',
    front,
    back: 'a meaning',
    context: '',
    ipa: '',
    addedAt: NOW,
    due: NOW,
    intervalDays: 6,
    ease: 2.5,
    reps: 2,
    lapses: 0,
    evidence: { retrievals: 1, convoUses, transfers: 0 },
  };
}

describe('the cadence set — authored, then earned — F469', () => {
  test('a learner on their first morning still meets the whole set', () => {
    // The point of authoring it. A section that waited for the learner to
    // produce a connector by accident would be empty for the people who most
    // need to be told these words exist.
    const cadence = cadenceFrom({ deck: [] });

    assert.equal(cadence.words.length, connectorWords().length);
    assert.equal(cadence.earned, 0);
    for (const word of cadence.words) {
      assert.equal(word.yours, false, `${word.fr} was marked as the learner's on an empty deck`);
      assert.notEqual(word.note.trim(), '', `${word.fr} arrived with no note`);
    }
  });

  test('a connector is theirs only once they used it unprompted', () => {
    // Reviewing a card is not using it. `isRetained` is convoUses, and that is
    // the whole difference between this mark and a flashcard's.
    const reviewedOnly = cadenceFrom({ deck: [card('du coup', 0)] });
    assert.equal(reviewedOnly.earned, 0, 'a card with no conversation use was counted as spoken');

    const spoken = cadenceFrom({ deck: [card('du coup', 3)] });
    assert.equal(spoken.earned, 1);
    assert.equal(spoken.words.find((w) => w.fr === 'du coup')?.yours, true);
  });

  test('the ones they own are lifted to the top, and the rest keep their order', () => {
    const cadence = cadenceFrom({ deck: [card('bref', 2)] });

    assert.equal(cadence.words[0]?.fr, 'bref', 'an earned connector was left where it was authored');
    const rest = cadence.words.slice(1).map((w) => w.fr);
    const authored = connectorWords().map((w) => w.fr).filter((fr) => fr !== 'bref');
    assert.deepEqual(rest, authored, 'the unearned connectors were reordered');
  });

  test('nothing anywhere in it counts at the learner', () => {
    // The mockup said "Spoken 14x naturally in sessions". The number is real
    // and it still may not be drawn: a count invites a target, and a target you
    // are under is a quota. The claim sentence says the same thing instead.
    const cadence = cadenceFrom({ deck: [card('du coup', 14)] });
    const said = [...Object.values(CADENCE), ...cadence.words.flatMap((w) => [w.fr, w.en, w.note])];

    for (const line of said) {
      assert.doesNotMatch(line, /\d/, `"${line}" draws a digit at a learner`);
      assert.equal(guiltIn(line), undefined, `"${line}" carries a banned word`);
      assert.ok(!line.includes('—'), `"${line}" carries an em dash`);
    }
  });

  test('the deck is not mutated on the way past', () => {
    const deck = [card('du coup', 2), card('en fait', 1)];
    const before = JSON.stringify(deck);
    cadenceFrom({ deck });
    assert.equal(JSON.stringify(deck), before);
  });
});
