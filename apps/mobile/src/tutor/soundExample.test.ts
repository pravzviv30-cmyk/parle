/**
 * A sound is introduced by a word, and the symbol is optional (whole-app
 * Stage 3A, 2026-09-25). A learner meets "the sound in « tu »" before they
 * meet "/y/": a familiar word is something they can hear in their head, and
 * notation is a detail for those who want it.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { getPhoneme } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { acousticFor } from '../myfrench/acoustic.ts';
import { SOUND_DETAIL, exampleFirstHeading, heldSoundsLine, soundExampleWord, soundInWord } from './soundExample.ts';

/** IPA between slashes, the way every screen in this app draws it. */
const NOTATION = /\/[^/\s«»]+\//;

describe('a sound is shown with an example word first', () => {
  test('the example is a word the learner said when there is one, and a familiar word otherwise', () => {
    assert.equal(soundExampleWord('y', 'rue'), 'rue', 'the word from this lesson is not used');
    assert.equal(soundExampleWord('y', '  '), getPhoneme('y')!.examples[0], 'a blank word is used as the example');
    assert.equal(soundExampleWord('y'), getPhoneme('y')!.examples[0]);
    assert.equal(soundExampleWord('not-a-sound'), null, 'an unknown sound is given an invented example');
  });

  test('the lead line names words and carries no notation', () => {
    assert.equal(soundInWord('tu'), 'The sound in « tu »');
    assert.equal(soundInWord('tu', 'tout'), 'The sound in « tu », not « tout »');
    assert.equal(heldSoundsLine(['bon']), 'You held the sound in « bon » steady in this lesson.');
    assert.equal(heldSoundsLine(['bon', 'tu']), 'You held the sounds in « bon », « tu » steady in this lesson.');
    for (const line of [soundInWord('tu', 'tout'), heldSoundsLine(['bon', 'tu']), SOUND_DETAIL.show, SOUND_DETAIL.hide]) {
      assert.doesNotMatch(line, NOTATION, `"${line}" leads with notation`);
      assert.doesNotMatch(line, /—/, `"${line}" carries an em dash`);
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
    }
  });

  test("the recap's sound heading is said with the drill's own two words, and never invents a pair", () => {
    const y = acousticFor('y');
    assert.ok(y !== null && y.pair !== null, 'this fixture stopped having a minimal pair');
    assert.match(y.heading, NOTATION, 'this fixture stopped being the notation-led heading');
    // The drill's two words win over the inventory's single example word.
    const lead = exampleFirstHeading(y, soundExampleWord('y'));
    assert.equal(lead, soundInWord(y.pair.a.word, y.pair.b.word));
    assert.doesNotMatch(lead, NOTATION, 'the recap still leads a sound with notation');
    // No pair, no honest example: the authored heading stands.
    assert.equal(exampleFirstHeading({ heading: 'Your /a/', pair: null }, null), 'Your /a/');
    // Stage 3A Fable review (2026-09-25): five sounds a focus can name have a
    // drill with no minimal pair (/ɑ̃/, /œ̃/, /p/, /t/, /z/), and the recap still
    // led those with notation. The inventory's own example word is an honest
    // lead, the same one the lesson summary already uses.
    const p = acousticFor('p');
    assert.ok(p !== null && p.pair === null, 'this fixture stopped being a sound with no minimal pair');
    const word = soundExampleWord('p');
    assert.ok(word !== null && word.length > 0, 'the inventory has no example word for /p/');
    assert.equal(exampleFirstHeading(p, word), soundInWord(word));
    assert.doesNotMatch(exampleFirstHeading(p, word), NOTATION, 'a sound with no pair is still led with notation');
    assert.equal(exampleFirstHeading(p, '  '), p.heading, 'a blank example was used as a word');
  });
});
