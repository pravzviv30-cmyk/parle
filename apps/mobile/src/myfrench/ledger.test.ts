/**
 * The lines that became the learner's.
 *
 * Two of these matter more than the rest. The first is that the featured phrase
 * is the same phrase Home calls first, held by construction rather than by
 * agreement: they read one comparator. The second is that nothing here ever
 * captions the tutor's note as the learner's own words, because the learner's
 * own words are not kept anywhere and a caption cannot conjure them.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { ReviewCard } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { isRetained, retainedOrder } from '../progress/momentum.ts';
import { CLAIMS, LEDGER, RETAINED_ROWS, hasLedger, ledgerFrom } from './ledger.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-09-07T09:00:00Z');

function card(over: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id: 'phrase:one',
    kind: 'vocab',
    front: 'du coup',
    back: 'so, therefore',
    context: '',
    ipa: '',
    addedAt: NOW - 10 * DAY,
    due: NOW + DAY,
    intervalDays: 6,
    ease: 2.5,
    reps: 3,
    lapses: 0,
    evidence: { retrievals: 1, convoUses: 1, transfers: 0 },
    ...over,
  };
}

describe('the ledger — what it features, and what it refuses to claim', () => {
  test('a deck with nothing used in conversation draws no lane at all', () => {
    // Not an empty heading. A heading over an empty list here would tell the
    // learner they have spoken no French, which is the one thing this page
    // must never imply.
    const never = card({ evidence: { retrievals: 4, convoUses: 0, transfers: 0 } });
    assert.equal(isRetained(never), false, 'the fixture stopped being un-retained');

    const ledger = ledgerFrom({ deck: [never], now: NOW });

    assert.equal(ledger.featured, null);
    assert.deepEqual(ledger.rows, []);
    assert.equal(hasLedger(ledger), false);
  });

  test('the featured phrase is the phrase Home calls first, by construction', () => {
    // The one assertion that stops the two surfaces drifting. Both read
    // `retainedOrder`, so this can only fail if somebody re-sorts here.
    const deck = [
      card({ id: 'phrase:a', front: 'du coup', evidence: { retrievals: 0, convoUses: 1, transfers: 0 } }),
      card({ id: 'phrase:b', front: 'en fait', evidence: { retrievals: 0, convoUses: 9, transfers: 0 } }),
      card({ id: 'phrase:c', front: 'bah oui', evidence: { retrievals: 0, convoUses: 4, transfers: 0 } }),
    ];

    const ledger = ledgerFrom({ deck, now: NOW });

    assert.equal(ledger.featured?.front, retainedOrder(deck)[0]?.front);
    assert.equal(ledger.featured?.front, 'en fait', 'most used first is the order Home reads');
  });

  test('the featured phrase never appears again in the rows beneath it', () => {
    const deck = [
      card({ id: 'phrase:a', front: 'je voudrais un café', evidence: { retrievals: 0, convoUses: 5, transfers: 0 } }),
      card({ id: 'phrase:b', front: 'en fait', evidence: { retrievals: 0, convoUses: 2, transfers: 0 } }),
    ];

    const ledger = ledgerFrom({ deck, now: NOW });

    assert.equal(ledger.rows.some((row) => row.id === ledger.featured?.id), false);
    assert.equal(ledger.rows.length, 1);
  });

  test('a two-word connector is not a whole line, so the ordering does something', () => {
    // Found by looking at the rendered lane. A space was the whole test, which
    // made "en fait" and "bah oui" whole lines, which made nearly every row one
    // and the ordering a no-op with a sentence under it claiming otherwise. A
    // line the learner can deploy is a clause, not a two-word connector.
    const deck = [
      card({ id: 'phrase:ducoup', front: 'du coup', evidence: { retrievals: 0, convoUses: 9, transfers: 0 } }),
      card({ id: 'phrase:enfait', front: 'en fait', evidence: { retrievals: 0, convoUses: 6, transfers: 0 } }),
      card({ id: 'phrase:meme', front: 'je prends la même chose', evidence: { retrievals: 0, convoUses: 1, transfers: 0 } }),
    ];

    const ledger = ledgerFrom({ deck, now: NOW });

    assert.equal(ledger.rows[0]?.front, 'je prends la même chose', 'a two-word connector outranked a real line');
    assert.equal(ledger.rows[0]?.wholeLine, true);
    assert.equal(ledger.rows[1]?.wholeLine, false, '"en fait" is being counted as a whole line');
  });

  test('whole lines are ordered before single words', () => {
    // The founder's cadence idea, made honest: an ordering and one sentence,
    // never a second list of connectors the app cannot count separately.
    const deck = [
      card({ id: 'phrase:head', front: 'alors', evidence: { retrievals: 0, convoUses: 9, transfers: 0 } }),
      card({ id: 'phrase:word', front: 'voilà', evidence: { retrievals: 0, convoUses: 5, transfers: 0 } }),
      card({ id: 'phrase:line', front: 'je prends la même chose', evidence: { retrievals: 0, convoUses: 1, transfers: 0 } }),
    ];

    const ledger = ledgerFrom({ deck, now: NOW });

    assert.equal(ledger.rows[0]?.front, 'je prends la même chose', 'a single word outranked a whole line');
    assert.equal(ledger.cadenceLine, LEDGER.cadence);
  });

  test('the cadence line is absent when no whole line is among the rows', () => {
    const deck = [
      card({ id: 'phrase:head', front: 'alors', evidence: { retrievals: 0, convoUses: 9, transfers: 0 } }),
      card({ id: 'phrase:word', front: 'voilà', evidence: { retrievals: 0, convoUses: 5, transfers: 0 } }),
    ];
    assert.equal(ledgerFrom({ deck, now: NOW }).cadenceLine, null);
  });

  test('a transferred phrase is claimed as transferred, and a used one as used', () => {
    const moved = card({ evidence: { retrievals: 1, convoUses: 2, transfers: 1 } });
    assert.equal(ledgerFrom({ deck: [moved], now: NOW }).featured?.claim, CLAIMS.transferred);
    assert.equal(ledgerFrom({ deck: [card()], now: NOW }).featured?.claim, CLAIMS.used);
  });

  test('a note that merely repeats a face is not drawn as a note', () => {
    // `review/store.ts` writes the tutor's note into `context`, and a lesson
    // card writes the gloss there instead. Neither is provenance, and only one
    // of them is worth a line.
    assert.equal(ledgerFrom({ deck: [card({ context: 'so, therefore' })], now: NOW }).featured?.note, null);
    assert.equal(ledgerFrom({ deck: [card({ context: 'du coup' })], now: NOW }).featured?.note, null);
    assert.equal(ledgerFrom({ deck: [card({ context: 'Very common in speech.' })], now: NOW }).featured?.note, 'Very common in speech.');
  });

  test('the rows are capped, and what is left over is offered rather than hidden', () => {
    const deck = Array.from({ length: RETAINED_ROWS + 5 }, (_, i) =>
      card({ id: `phrase:${i}`, front: `mot ${i}`, evidence: { retrievals: 0, convoUses: 20 - i, transfers: 0 } }),
    );

    const ledger = ledgerFrom({ deck, now: NOW });

    assert.equal(ledger.rows.length, RETAINED_ROWS);
    assert.equal(ledger.moreLine, '+4 more');
  });

  test('nothing is left over when the door hides nothing', () => {
    assert.equal(ledgerFrom({ deck: [card()], now: NOW }).moreLine, null);
  });
});

describe('the ledger — its words', () => {
  test('every line it can say is clean and carries no digit-free promise it cannot keep', () => {
    const lines = [...Object.values(LEDGER), ...Object.values(CLAIMS), 'It held when the situation changed.'];
    for (const line of lines) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a banned word`);
      assert.ok(!line.includes('—'), `"${line}" carries an em dash`);
    }
  });

  test('the tutor keeps the credit for the tutor’s note', () => {
    // The learner's own sentence is not kept anywhere in this app. A caption
    // saying "you said this" would be a fabrication with a warm voice.
    assert.match(LEDGER.noteLabel, /tutor/i);
    assert.doesNotMatch(LEDGER.noteLabel, /you said|your words/i);
  });
});
