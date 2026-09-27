/**
 * Which daily items may call themselves "of the day".
 *
 * Home draws one word and one phrase picked for today, and says so. The daily
 * collection draws the same items as a library of two thousand, and a card
 * there that calls itself today's word is a claim the page cannot keep. The
 * Stage 3 browser proof of the whole-app upgrade (2026-09-25) found every
 * library card, the three starters on an empty Saved tab included, labelled
 * "Word of the day" or "Phrase of the day", because the label was baked into
 * the catalogue rather than given by the one place that picks today's items.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DAILY_ITEMS, dailyItem, todayItems } from './catalogue.ts';

test("only Home's pick calls itself today's; a collection card says what it is", () => {
  for (const item of DAILY_ITEMS) {
    assert.doesNotMatch(item.label, /of the day/i, `${item.id} calls itself today's in a library of ${DAILY_ITEMS.length}`);
    assert.equal(item.label, item.id.startsWith('word:') ? 'Word' : 'Phrase', `${item.id} is labelled as something it is not`);
  }
  const sample = DAILY_ITEMS[DAILY_ITEMS.length - 1]!;
  assert.equal(dailyItem(sample.id)?.label, sample.label, 'an item opened by id reads a different label from the library');

  for (const level of [0, 1, 2, 3, 4, 5]) {
    const now = new Date(2026, 8, 25, 12).getTime();
    const today = todayItems(level, now);
    assert.equal(today.word.label, 'Word of the day', "Home's word no longer says it is today's");
    assert.equal(today.phrase.label, 'Phrase of the day', "Home's phrase no longer says it is today's");
    // The pick is the library's own item, only named as today's.
    const { label: _wordLabel, ...word } = today.word;
    const { label: _phraseLabel, ...phrase } = today.phrase;
    const { label: _libWord, ...libraryWord } = dailyItem(today.word.id)!;
    const { label: _libPhrase, ...libraryPhrase } = dailyItem(today.phrase.id)!;
    assert.deepEqual(word, libraryWord, "Home's word is not the library's item");
    assert.deepEqual(phrase, libraryPhrase, "Home's phrase is not the library's item");
  }
});
