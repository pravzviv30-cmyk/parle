/**
 * The words My French says, held to the rules the tab cannot check for itself.
 *
 * There is no renderer in this workspace, so the only way a heading gets tested
 * is by not living in the component. Every line the tab draws is exported from
 * `copy.ts`, and this walks all of them: the guilt list, the em dash, the digit
 * ban, and the one line written for a learner who has nothing yet.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import {
  BROWSE_LABEL,
  BROWSE_LINE,
  BROWSE_OPEN,
  COLLECTION_LABEL,
  CONVERSATIONS_ROW,
  CONVERSATIONS_SUB,
  DAILY_LABEL,
  DAILY_LINE,
  DAILY_OPEN,
  GOALS_ROW_LABEL,
  GOALS_ROW_OPEN,
  MY_FRENCH_COPY,
  MY_FRENCH_PURPOSE,
  MY_FRENCH_TITLE,
  SAVED_LABEL,
  SHELF_EMPTY,
  SHELF_LABEL,
  SHELF_OPEN,
} from './copy.ts';

describe('the words My French says — F575', () => {
  test('a learner reading this tab meets no count, no dash and no word that scolds', () => {
    for (const line of MY_FRENCH_COPY) {
      const banned = guiltIn(line);
      assert.equal(banned, undefined, `"${line}" carries the banned word "${banned}"`);
      assert.ok(!line.includes('—'), `"${line}" carries an em dash into learner copy`);
      assert.doesNotMatch(line, /\d|%/, `"${line}" counts at a learner who came here to read their own French`);
      assert.notEqual(line.trim(), '', 'a blank line reached the tab');
    }
  });

  test('a learner with an empty shelf is told what it is for, not what they have not done', () => {
    // Forwards, not backwards. "Your first kept phrase lands here" describes the
    // shelf; anything phrased as an absence describes the learner.
    assert.equal(SHELF_EMPTY, 'Your first kept phrase lands here.');
    assert.doesNotMatch(SHELF_EMPTY, /\bno\b|\bnone\b|\bnothing\b|\bempty\b|\byet\b|haven't|have not/i, `"${SHELF_EMPTY}" reports an absence back to the learner`);
    assert.doesNotMatch(SHELF_EMPTY, /\?/, 'the empty shelf asks the learner a question instead of telling them what it holds');
  });

  test('the headline and its line say what the page is a record of, in the founder’s words', () => {
    // Whole-app phase 2: the three-line headline and the slogan under it were
    // read on every visit. The tab is called what the bar calls it, and one
    // plain line says what is on it.
    assert.equal(MY_FRENCH_TITLE, 'My French');
    assert.equal(MY_FRENCH_PURPOSE, 'The French you have used and kept.');
    assert.ok(MY_FRENCH_PURPOSE.split(' ').length <= 8, 'the purpose line grew back into a slogan');
    assert.doesNotMatch(MY_FRENCH_PURPOSE, /Real conversations|independence/, 'the slogan is back');
    // The purpose line is read out of the tab as a SCREAMING_CASE constant by
    // surfaceContract.test.ts. A rename to camelCase reads to it as no purpose
    // line at all, which is why the name is asserted and not only the words.
    const source = readFileSync(fileURLToPath(new URL('./copy.ts', import.meta.url)), 'utf8');
    assert.match(source, /export const MY_FRENCH_PURPOSE = /, 'the purpose line lost the shape the tab contract reads');
  });

  test('every door on the page names where it goes, so nobody taps into the dark', () => {
    // Each of these is the accessible name or the visible words of a control.
    // A door called "Open" or "More" names nothing to somebody who cannot see
    // what it sits under.
    for (const [name, line] of [
      ['the shelf heading', SHELF_LABEL],
      ['the shelf door', SHELF_OPEN],
      ['the saved heading', SAVED_LABEL],
      ['the conversations row', CONVERSATIONS_ROW],
      ['the conversations line', CONVERSATIONS_SUB],
      ['the collection heading', COLLECTION_LABEL],
      ['the daily collection heading', DAILY_LABEL],
      ['the daily collection line', DAILY_LINE],
      ['the daily collection door', DAILY_OPEN],
      ['the catalogue door', BROWSE_LABEL],
      ['the catalogue line', BROWSE_LINE],
      ['the catalogue door, read aloud', BROWSE_OPEN],
    ] as const) {
      assert.ok(line.split(' ').length >= 2, `${name} says "${line}", which names nothing on its own`);
    }
    assert.equal(SHELF_OPEN, 'Open my phrases');
  });

  test('nothing on the page shouts at the learner', () => {
    // Sentence case throughout. The micro-label's caps are the style sheet's
    // doing, not the string's, so a SHOUTED constant would be shouted twice.
    for (const line of MY_FRENCH_COPY) {
      assert.doesNotMatch(line, /\b[A-Z]{3,}\b/, `"${line}" is set in capitals; the caps are the label style's, not the words'`);
      assert.doesNotMatch(line, /!/, `"${line}" carries an exclamation mark at somebody reading their own record`);
    }
  });

  test('the tab is written in British English, like the rest of the app', () => {
    const AMERICAN = ['color', 'organize', 'favorite', 'realize', 'apologize', 'center', 'practicing', 'traveler'];
    for (const line of MY_FRENCH_COPY) {
      for (const word of AMERICAN) {
        assert.ok(!line.toLowerCase().includes(word), `"${line}" spells "${word}" the American way`);
      }
    }
  });

  test('every line finishes its thought, so nothing on the page trails off', () => {
    // A heading names a thing and stops; a sentence ends. What must not happen
    // is a colon or a comma left hanging at the end of a line, which reads as
    // copy somebody meant to come back to.
    for (const line of MY_FRENCH_COPY) {
      assert.doesNotMatch(line, /[:,;]$/, `"${line}" ends mid-thought`);
      assert.equal(line, line.trim(), `"${line}" carries whitespace at one end`);
    }
    // The one deliberate exception, and it is the founder's: the heading runs
    // into the row beneath it, so the three dots are the join. The title is a
    // name now (whole-app phase 2), and a name is not a sentence.
    assert.equal(MY_FRENCH_TITLE.endsWith('.'), false, 'the title is the tab\'s name and does not end as a sentence');
    assert.equal(MY_FRENCH_PURPOSE.endsWith('.'), true, 'the purpose is a sentence and ends as one');
    assert.equal(SHELF_LABEL.endsWith('.'), false, 'a heading is not a sentence and does not end as one');
    assert.equal(COLLECTION_LABEL.endsWith('.'), false, 'a heading is not a sentence and does not end as one');
  });

  // Stage 4 (2026-09-25): "Saved words, phrases and offline audio" read as a
  // promise that every saved item plays. Only the voiced ones have a recording,
  // so the row says audio belongs to those and nothing more.
  test('the daily collection line does not promise audio for every item', () => {
    assert.notEqual(DAILY_LINE, 'Saved words, phrases and offline audio.');
    assert.match(DAILY_LINE, /voiced/, 'the line does not say which items carry audio');
    assert.doesNotMatch(DAILY_LINE, /\ball\b|\bevery\b/i, 'the line claims audio for everything again');
  });

  // Stage 4 (2026-09-25): the goal rows. The heading is the same two words the
  // goal screen opens on, and the spoken name says where the row goes.
  test('the goal row says whose goal it is and where it opens', () => {
    assert.equal(GOALS_ROW_LABEL, 'Your goal');
    assert.equal(GOALS_ROW_OPEN, 'Open your goal');
    assert.ok(MY_FRENCH_COPY.includes(GOALS_ROW_LABEL) && MY_FRENCH_COPY.includes(GOALS_ROW_OPEN), 'the goal row words are not swept');
  });

  test('a line added to this tab cannot arrive without being swept', () => {
    // The list is what the sweep walks, so a ninth export that forgets to join
    // it would be a learner-facing sentence nothing reads. Counted against the
    // file's own exports rather than a number typed twice.
    const source = readFileSync(fileURLToPath(new URL('./copy.ts', import.meta.url)), 'utf8');
    const exported = source.match(/^export const [A-Z_]+ = '/gm) ?? [];
    assert.equal(
      MY_FRENCH_COPY.length,
      exported.length,
      `the tab exports ${exported.length} lines and sweeps ${MY_FRENCH_COPY.length} of them`,
    );
    assert.equal(new Set(MY_FRENCH_COPY).size, MY_FRENCH_COPY.length, 'two of the tab’s lines say the same thing');
  });
});
