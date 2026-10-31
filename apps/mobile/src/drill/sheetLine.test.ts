import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import * as F from '../dev/drillFixtures.ts';
import { sheetLine } from './sheetLine.ts';

describe('sheetLine: the right sheet shows the exercise\'s own French, never the learner\'s typing', () => {
  test('each kind gives its authored line and gloss', () => {
    assert.deepEqual(sheetLine(F.BEST_SENTENCE, 0), { fr: 'L’addition, s’il vous plaît.', en: 'The bill, please.' });
    assert.deepEqual(sheetLine(F.FILL_BLANK_CHOICE, 'voudrais'), { fr: 'Je voudrais un café.', en: 'I would like a coffee.' });
    assert.deepEqual(sheetLine(F.TAP_TRANSLATE, 'whatever was tapped'), { fr: 'L’addition s’il vous plaît', en: 'The bill, please.' });
    assert.deepEqual(sheetLine(F.LISTEN_TYPE, 'je voudrais un cafe'), { fr: 'Je voudrais un café.', en: null });
    assert.deepEqual(sheetLine(F.TRANSLATE_INTO_EN, 'the bill please'), { fr: 'L’addition, s’il vous plaît.', en: 'The bill, please.' });
    assert.deepEqual(sheetLine(F.REPEAT_THIS, 'Je voudrais un café.'), { fr: 'Je voudrais un café.', en: 'I would like a coffee.' });
    assert.equal(sheetLine(F.OWN_WORDS, 'Combien je vous dois ?'), null);
  });
  test('a typed blank shows the authored word, so a typo is never the model', () => {
    assert.deepEqual(sheetLine(F.FILL_BLANK_TYPED, 'combein'), { fr: 'Je vous dois combien ?', en: 'How much do I owe you?' });
  });
  test('a reply with several right answers shows the one chosen', () => {
    const two = { ...F.APPROPRIATE_REPLY, acceptableIndexes: [0, 1] };
    assert.deepEqual(sheetLine(two, 1), { fr: 'Je vous dois combien ?', en: 'How much do I owe you?' });
    assert.equal(sheetLine(two, 9), null);
  });
});
