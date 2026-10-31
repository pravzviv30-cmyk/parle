/**
 * The end scene's phrase list: each answered phrase with its own authored
 * French and its LEARN-018 mark.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AnsweredExercise } from '@luvani/core';

import * as F from '../dev/drillFixtures.ts';
import { endPhrases, phraseFrench } from './endPhrases.ts';

const a = (id: string, phraseKey: string, outcome: AnsweredExercise['outcome'], attempts: number): AnsweredExercise => ({ id, phraseKey, outcome, attempts });

describe('end scene phrases', () => {
  test('every kind yields its authored French, never an attempt', () => {
    assert.equal(phraseFrench(F.BEST_SENTENCE), 'L’addition, s’il vous plaît.');
    assert.equal(phraseFrench(F.APPROPRIATE_REPLY), 'Je voudrais un café.');
    assert.equal(phraseFrench(F.FILL_BLANK_CHOICE), 'Je voudrais un café.');
    assert.equal(phraseFrench(F.FILL_BLANK_TYPED), 'Je vous dois combien ?');
    assert.equal(phraseFrench(F.TAP_TRANSLATE), 'L’addition s’il vous plaît');
    assert.equal(phraseFrench(F.TRANSLATE_INTO_EN), 'L’addition, s’il vous plaît.');
    assert.equal(phraseFrench(F.LISTEN_TYPE), 'Je voudrais un café.');
    assert.equal(phraseFrench(F.REPEAT_THIS), 'Je voudrais un café.');
    assert.equal(phraseFrench(F.OWN_WORDS), 'Je vous dois combien ?');
  });

  test('marks follow settledMarks, in first-answered order, one row per phrase', () => {
    const ex = [F.BEST_SENTENCE, F.TRANSLATE_INTO_FR];
    const answered = [a(F.BEST_SENTENCE.id, F.BEST_SENTENCE.phraseKey, 'good', 1), a(F.TRANSLATE_INTO_FR.id, F.TRANSLATE_INTO_FR.phraseKey, 'good', 2)];
    assert.deepEqual(endPhrases(answered, ex), [
      { phraseKey: F.BEST_SENTENCE.phraseKey, fr: 'L’addition, s’il vous plaît.', mark: 'settled' },
      { phraseKey: F.TRANSLATE_INTO_FR.phraseKey, fr: 'Je vous dois combien ?', mark: 'still-settling' },
    ]);
  });

  test('a phrase whose exercise is gone keeps its mark and has no French', () => {
    assert.deepEqual(endPhrases([a('gone', 'p', 'unresolved', 2)], []), [{ phraseKey: 'p', fr: null, mark: 'still-settling' }]);
  });
});
