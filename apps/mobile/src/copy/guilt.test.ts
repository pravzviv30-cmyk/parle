/**
 * The one ban list, held to the record of what was once banned.
 *
 * "No streak guilt" is the hardest promise in PRODUCT.md (Brand Commitments,
 * and principle 4), and until F216 three suites kept it with three different
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
import { BANNED_IN_COPY, BANNED_IN_STREAK_COPY, RETIRED_FROM_BAN, guiltIn, streakGuiltIn } from './guilt.ts';

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
    // One way out, and it is written down. A word leaves the list only through
    // RETIRED_FROM_BAN, which names the founder decision that retired it, and
    // the record below still holds the word so the history is not rewritten.
    const retired = new Set(RETIRED_FROM_BAN.map(({ word }) => word));
    const dropped = ONCE_BANNED.filter(({ word }) => !retired.has(word) && guiltIn(word) === undefined).map(
      ({ word, from }) => `"${word}", banned by ${from}`,
    );
    assert.deepEqual(
      dropped,
      [],
      'BANNED_IN_COPY no longer catches a word a surface used to ban. If a sentence you like ' +
        'trips one of these, change the sentence. Shortening this list is how the no-guilt ' +
        'promise is lost one word at a time.',
    );
    // The retired list cannot grow quietly. "streak" left on 2026-10-04 because
    // the founder chose a full daily streak (D2); every shaming word stayed.
    assert.deepEqual(
      RETIRED_FROM_BAN.map(({ word }) => word),
      ['streak'],
      'a second word left the ban list. That needs its own founder decision, recorded here.',
    );
    for (const { word, by } of RETIRED_FROM_BAN) {
      assert.ok(
        ONCE_BANNED.some((once) => once.word === word),
        `"${word}" is retired but was never banned, so the record is not a record`,
      );
      assert.match(by, /^founder decision \d{4}-\d{2}-\d{2}: \S/, `"${word}" is retired without a dated decision`);
    }
  });

  test('a banned word cannot hide inside a longer one', () => {
    // Substring, not word boundary, and on purpose. See guilt.ts.
    assert.equal(guiltIn('Breakfast in Lyon'), 'break');
    assert.equal(guiltIn('unmissed'), 'missed');
  });

  test('case and a curly apostrophe do not smuggle a word past', () => {
    // "streak" was the word here until it was retired (F718); "missed" makes
    // the same point about case and is still banned.
    assert.equal(guiltIn('MISSED'), 'missed');
    assert.equal(guiltIn('Missed'), 'missed');
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

  test('streak copy states facts and never threatens', () => {
    // F718, founder decision D2 (2026-10-04): a full daily streak that never
    // shames. The word came off the shared list; the threat did not. Streak
    // and reminder copy answers to a stricter list, kept separate so that a
    // word like "protect" in privacy copy is not swept up with it.
    for (const word of BANNED_IN_COPY) {
      assert.ok(BANNED_IN_STREAK_COPY.includes(word), `streak copy may say "${word}", which no surface may`);
    }
    for (const word of BANNED_IN_STREAK_COPY) {
      assert.equal(word, word.toLowerCase(), `"${word}" is not lowercase, so the matcher can never see it`);
    }
    assert.equal(new Set(BANNED_IN_STREAK_COPY).size, BANNED_IN_STREAK_COPY.length, 'the streak list carries a duplicate');
    assert.ok(!BANNED_IN_COPY.includes('streak') && !BANNED_IN_STREAK_COPY.includes('streak'));
    // The stricter list's own words, written down so it can grow but not shrink.
    // Each is checked by name because a sample line can trip two of them, and
    // then losing one would pass unseen.
    for (const word of [
      'at risk',
      'last chance',
      'hurry',
      'ends tonight',
      'midnight',
      'before it ends',
      'save your streak',
      'disappear',
      'miss you',
      'ignor',
      'disappoint',
      'shame',
      'sad',
      'hours left',
      'minutes left',
    ]) {
      assert.ok(BANNED_IN_STREAK_COPY.includes(word), `streak copy may now say "${word}"`);
    }

    // Facts: a count, a day, a lifetime total, a calm word about repair.
    for (const line of [
      'Your 12-day streak is waiting',
      'Day 13 is ready when you are',
      'One week of French',
      'A 7-day streak. One week of French.',
      'Practised today. That makes 30 days in a row.',
      '214 practice days so far',
      'Start a new streak today',
      'Subscribers can repair a streak within 2 days.',
      'Léa has a phrase for you.',
    ]) {
      assert.equal(streakGuiltIn(line), undefined, `"${line}" trips "${streakGuiltIn(line) ?? ''}"`);
      assert.equal(guiltIn(line), undefined, `"${line}" trips the shared list on "${guiltIn(line) ?? ''}"`);
    }

    // Threats: the countdown, the loss, the plea, the sad face in words.
    for (const line of [
      'Save your streak before midnight',
      "Don't lose your streak",
      'Don’t lose your streak',
      'Your streak is at risk',
      'Last chance to keep your streak',
      'Hurry! Your streak ends tonight',
      'Only 3 hours left to practise',
      '20 minutes left today',
      'Your streak will disappear',
      'We miss you',
      'You ignored Léa yesterday',
      "Don't disappoint Léa",
      'Your tutor is sad',
      'You lost your 40-day streak',
      'You missed a day',
      'Practise before it ends',
    ]) {
      assert.notEqual(streakGuiltIn(line), undefined, `"${line}" threatens and passed`);
    }
  });
});

/**
 * The brand commitment, and the third time it was asked.
 *
 * PRODUCT.md records two refusals of a streak. A "Days active" tile then
 * shipped, and it was not the thing that was refused: it only ever rises, reads
 * no yesterday, has no state a loss could be written into, and is present from
 * the first day, worded as a start. Those properties are held by name in
 * `progress/momentum.test.ts`. What this checks is that the commitment itself
 * says so, because the next reader of PRODUCT.md, human or agent, would
 * otherwise see a days count beside a sentence saying days counts were dropped,
 * and one of the two would get changed on a guess.
 *
 * 2026-09-27, notebook redesign: the tile left Today and nothing renders
 * `progress/MomentumCards.tsx` now. PRODUCT.md records the tile as history and
 * keeps its properties as the rule any days count that comes back must follow,
 * so the assertions below are unchanged and still hold the wording of that rule.
 *
 * 2026-10-04, founder decision D2 (F718): the refusal was reversed and a daily
 * streak is coming, on the condition that it never shames or threatens. The
 * tile's properties now belong to the lifetime count of practice days that sits
 * beside the streak, so every property assertion stays. What changed is the
 * last one: the word left the ban list, and the record of why is checked here.
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
    // 2026-10-04: the founder reversed the refusal (D2). The streak is back as
    // a fact that never shames, and the properties above now belong to the
    // lifetime count that sits beside it. The commitment says all three.
    for (const [property, pattern] of [
      ['that streak copy never shames or threatens', /never shames or threatens/],
      ['that a lifetime count sits beside the streak', /lifetime count of practice days/],
      ['that any finished practice counts', /any finished practice/],
    ] as const) {
      assert.match(product, pattern, `PRODUCT.md does not say ${property}`);
    }
    assert.equal(guiltIn('Days active'), undefined, 'the tile label itself trips the ban list');
    // The word left the ban list by a recorded decision, not by an edit.
    assert.deepEqual(
      RETIRED_FROM_BAN.find(({ word }) => word === 'streak'),
      { word: 'streak', by: 'founder decision 2026-10-04: a full daily streak' },
      'the word this commitment is about left the ban list without its record',
    );
  });
});
