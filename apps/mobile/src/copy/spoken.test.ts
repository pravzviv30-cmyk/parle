/**
 * Labels read aloud as sentences, with no doubled marks.
 *
 * Whole-app upgrade browser proofs found the same fault in three places: a
 * part that already ends a sentence gained a second mark when the label was
 * joined ("café., Sur place" in Stage 2, "s'il vous plaît.. I'd like" and
 * "ça a été ?. Talk about your day" in Stage 4). A screen reader reads each
 * stray mark as a pause, or aloud.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SENTENCE_END, asSentences } from './spoken.ts';

const DOUBLED = /[.!?…][»"”’)\]]*\s*[.,]/;

test('a part that already ends a sentence keeps its own mark and gains no second one', () => {
  assert.equal(
    asSentences(['Je voudrais un café, s’il vous plaît.', 'I’d like a coffee, please.']),
    'Je voudrais un café, s’il vous plaît. I’d like a coffee, please.',
  );
  assert.equal(
    asSentences(['Ta journée, ça a été ?', 'Talk about your day', 'Ready when you are']),
    'Ta journée, ça a été ? Talk about your day. Ready when you are.',
  );
  assert.equal(asSentences(['Bonne journée !', 'Have a good day']), 'Bonne journée ! Have a good day.');
  assert.equal(asSentences(['Et puis…', 'And then']), 'Et puis… And then.');
  assert.equal(asSentences(['Il a dit « Bonjour ! »', 'He said hello']), 'Il a dit « Bonjour ! » He said hello.');
  for (const label of [
    asSentences(['Je voudrais un café, s’il vous plaît.', 'I’d like a coffee, please.']),
    asSentences(['Ta journée, ça a été ?', 'Talk about your day', 'Ready when you are']),
  ]) {
    assert.doesNotMatch(label, DOUBLED, `"${label}" doubles a sentence mark`);
  }
});

test('absent and blank parts are skipped, and parts are trimmed', () => {
  assert.equal(asSentences(['Title', null, undefined, '', '   ', 'Line']), 'Title. Line.');
  assert.equal(asSentences(['  Café du coin  ', 'Ready ']), 'Café du coin. Ready.');
  assert.equal(asSentences([]), '');
});

test('the sentence end is a mark, optionally closed by a quote or bracket', () => {
  for (const ends of ['Fin.', 'Quoi ?', 'Oui !', 'Et…', '« Oui. »', '(Oui.)']) assert.ok(SENTENCE_END.test(ends), `"${ends}" is not read as closed`);
  for (const open of ['Fin', 'Quoi ,', 'Oui »', 'Et (', 'café,']) assert.ok(!SENTENCE_END.test(open), `"${open}" is read as closed`);
});
