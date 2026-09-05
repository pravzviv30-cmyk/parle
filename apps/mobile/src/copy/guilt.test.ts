/**
 * The one ban list, held to the record of what was once banned.
 *
 * "No streak guilt" is the hardest promise in PRODUCT.md (:90-93, and principle
 * 4 at :138), and until F216 three suites kept it with three different
 * contents: eleven phrases on Home, four words on the mix offer, and a source
 * scan on the review screen. The gate can see a lowered test floor and a ledger
 * box ticked without a passing test. It cannot see a ban list getting shorter,
 * which is the cheapest way to make an unkind sentence pass.
 *
 * So the list lives in one place now, and this file is its memory. ONCE_BANNED
 * below is a separate literal that names where every word came from. It is
 * deliberately not derived from BANNED_IN_COPY: a test that re-lists the array
 * under test and compares it to itself proves nothing, and this one has to hold
 * when the array is the thing being edited.
 *
 * What is deliberately NOT here: review/cardView.test.ts keeps its own
 * `/ProgressBar|percent|streak/i`. That regex reads the review screen's
 * *source* looking for a progress surface, which is a different guard from
 * banned copy strings. Pointing it at this list would make a check about
 * component shape answer to a word list, and would quietly stop it catching a
 * `<ProgressBar>` that never says anything at all. Leave it alone.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BANNED_IN_COPY, guiltIn } from './guilt.ts';

/**
 * Every word a Luvani surface has ever banned, written down with its origin.
 *
 * This is the historical record, not a copy of the list under test. When a word
 * is removed from BANNED_IN_COPY to let a nice sentence through, it is still
 * here, and the first test below fails naming it and the surface that wanted it
 * gone. Adding to BANNED_IN_COPY never fails: the guard is allowed to get
 * stronger, only never weaker.
 */
const ONCE_BANNED: readonly { readonly word: string; readonly from: string }[] = [
  // progress/today.test.ts, "it cannot become a streak". Home's daily count has
  // refused these eleven since the five-tab redesign dropped the streak for the
  // second time.
  { word: 'streak', from: "Home's daily count" },
  { word: 'missed', from: "Home's daily count" },
  { word: 'lost', from: "Home's daily count" },
  { word: 'lose', from: "Home's daily count" },
  { word: 'break', from: "Home's daily count" },
  { word: 'keep it up', from: "Home's daily count" },
  { word: "don't", from: "Home's daily count" },
  { word: 'do not', from: "Home's daily count" },
  { word: 'again tomorrow or', from: "Home's daily count" },
  { word: 'failed', from: "Home's daily count" },
  { word: 'behind', from: "Home's daily count" },
  // practice/mix.test.ts, "the offer is warm, forward, and free of numbers".
  // That list was streak, behind, missed and owe; the first three were already
  // above, so owe is the one word the mix offer contributed to the union.
  { word: 'owe', from: 'the mix offer' },
];

describe('the words no Luvani surface may say', () => {
  test('the shared ban list still carries every word each surface ever banned', () => {
    const dropped = ONCE_BANNED.filter(({ word }) => guiltIn(word) === undefined).map(
      ({ word, from }) => `"${word}", banned by ${from}`,
    );
    assert.deepEqual(
      dropped,
      [],
      'BANNED_IN_COPY no longer catches a word a surface used to ban. If a sentence you like ' +
        'trips one of these, change the sentence. Shortening this list is how the no-guilt ' +
        'promise is lost one word at a time.',
    );
  });

  test('a banned word cannot hide inside a longer one', () => {
    // Substring, not word boundary, and on purpose. See guilt.ts.
    assert.equal(guiltIn('Breakfast in Lyon'), 'break');
    assert.equal(guiltIn('unmissed'), 'missed');
  });

  test('case and a curly apostrophe do not smuggle a word past', () => {
    assert.equal(guiltIn('STREAK'), 'streak');
    assert.equal(guiltIn('Streak'), 'streak');
    // A designer pasting copy out of a doc brings U+2019 with it, and "don’t"
    // is not "don't" to includes(). The matcher folds them together so the
    // list does not have to carry each word twice.
    assert.equal(guiltIn('Don’t'), "don't");
  });

  test('warm copy passes, so the guard is not simply always on', () => {
    // Without this the first test would pass just as well against a matcher
    // that answered every string, which would prove nothing about the list.
    assert.equal(guiltIn('You practised today. Room for one more if you want it.'), undefined);
    assert.equal(guiltIn('A little of everything you have learned.'), undefined);
    assert.equal(guiltIn(''), undefined);
  });

  test('every entry is lowercase and unique, which is what the matcher assumes', () => {
    for (const word of BANNED_IN_COPY) {
      assert.equal(word, word.toLowerCase(), `"${word}" is not lowercase, so the matcher can never see it`);
      assert.notEqual(word.trim(), '', 'an empty entry matches every string, including the good ones');
    }
    assert.equal(
      new Set(BANNED_IN_COPY).size,
      BANNED_IN_COPY.length,
      'the union carries a duplicate, which means two surfaces were merged by hand',
    );
  });
});

/**
 * The brand commitment, and the third time it was asked.
 *
 * PRODUCT.md records two refusals of a streak. A "Days active" tile ships now,
 * and it is not the thing that was refused: it only ever rises, reads no
 * yesterday, has no state a loss could be written into, and is absent at zero.
 * Those properties are held by name in `progress/momentum.test.ts`. What this
 * checks is that the commitment itself says so, because the next reader of
 * PRODUCT.md, human or agent, will otherwise see a days tile beside a sentence
 * saying days tiles were dropped, and one of the two will get changed on a
 * guess.
 */
describe('the brand commitment records what shipped — F414', () => {
  test('PRODUCT.md records why days active is not the streak it refused — F414', () => {
    const product = readFileSync(fileURLToPath(new URL('../../../../PRODUCT.md', import.meta.url)), 'utf8');
    assert.match(product, /No streak guilt/, 'PRODUCT.md no longer carries the commitment this is about');
    assert.match(product, /Days active/, 'PRODUCT.md never names the tile that ships, beside the streak it refused');
    for (const [property, pattern] of [
      ['that it only ever rises', /only ever rises/],
      ['that it reads no yesterday', /yesterday is never read/],
      ['that it has no loss state', /no state a loss could be written into/],
      // F396 kept the whole block off a first run and PRODUCT.md said so. The
      // founder overturned that on 2026-09-05, so the commitment now rests on
      // the wording rather than on the absence: the tile ships from day one and
      // writes a start line where a nought would have gone. Both halves are
      // checked, because "present" without "worded as a start" is the version
      // of this that would be a scoreboard of noughts.
      ['that it ships on a first run', /present from the first day/],
      ['that a nought is worded as a start instead', /worded as a start/],
    ] as const) {
      assert.match(product, pattern, `PRODUCT.md does not say ${property}, which is what makes the tile legal`);
    }
    // And the word itself is still unsayable to a learner.
    assert.equal(guiltIn('Days active'), undefined, 'the tile label itself trips the ban list');
    assert.ok(BANNED_IN_COPY.includes('streak'), 'the word this commitment is about left the ban list');
  });
});
