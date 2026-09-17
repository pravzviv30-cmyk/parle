/**
 * Today's word for a learner whose standing could not be read.
 *
 * Home's word waits on storage, because it is pitched at the learner's tier and
 * the tier comes from XP that has to be read off the disk. That is right, and
 * it left one hole: a read that never answered left the card missing for the
 * rest of the visit, so a phone with unreadable storage drew Home with a gap
 * where the day's word goes.
 *
 * `daily/tier.ts` already settled what to do about an unreadable standing, in
 * as many words: "a learner whose stored XP is somehow unreadable should meet
 * the gentlest pool rather than a blank screen". This is that sentence, on the
 * one path in the app that can reach it.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_WORDS, wordsForLevel } from '@luvani/core';

import { UNREAD_LEVEL, gentlestWord } from './gentlestWord.ts';

/** Two days apart, in the middle of each, so no assertion rides on a boundary. */
const MONDAY = Date.parse('2026-09-07T12:00:00Z');
const TUESDAY = Date.parse('2026-09-08T12:00:00Z');

describe('the day still has a word when the disk does not answer', () => {
  test('a learner with no readable standing meets the gentlest tier, not an empty card', () => {
    const word = gentlestWord(MONDAY);
    assert.notEqual(word, null, 'a failed read leaves Home with a hole where the word of the day goes');
    assert.equal(word!.tier, 1, 'a learner whose standing could not be read is pitched above the gentlest pool');
    assert.ok(
      wordsForLevel(DAILY_WORDS, UNREAD_LEVEL).some((w) => w.fr === word!.fr),
      'the word comes from somewhere other than the tier this module claims to read',
    );
  });

  test('it is the day that picks, so the same day gives the same word', () => {
    assert.deepEqual(gentlestWord(MONDAY), gentlestWord(MONDAY), 'the word changes under a learner within one day');
    assert.notDeepEqual(gentlestWord(MONDAY), gentlestWord(TUESDAY), 'every day gives the same word');
  });

  test('a pool with nothing in it answers nothing rather than throwing', () => {
    // `dailyPick` throws on an empty pool on purpose, so that a content bug is
    // never drawn over. This is the one caller that must not pass the throw on:
    // it runs inside the rescue of a read that already failed, and a throw here
    // would be an unhandled rejection instead of a card.
    assert.equal(gentlestWord(MONDAY, []), null, 'an empty pool throws out of the rescue path rather than answering nothing');
    assert.doesNotThrow(() => gentlestWord(MONDAY, []), 'the rescue path throws while rescuing');
  });
});
