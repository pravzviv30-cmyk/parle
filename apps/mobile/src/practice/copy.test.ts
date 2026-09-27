import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALTERNATIVES,
  NEXT_PRACTICE_LABEL,
  PACK_ACTION,
  PRACTICE_ALTERNATIVES,
  PRACTICE_COPY,
  PRACTICE_PURPOSE,
  PRACTICE_TITLE,
  REVIEW_ACTION,
} from './copy.ts';
import * as COPY from './copy.ts';
import { guiltIn } from '../copy/guilt.ts';

describe('what the Practice tab says about itself — F574', () => {
  test('the learner is told where this page came from before they are asked to do anything', () => {
    // Whole-app phase 2: the tab is called what the bar calls it, with one
    // short line under it. Where the practice came from is said once, on the
    // card that names the conversation, rather than in a two-line heading and
    // again as a second heading over the rows.
    assert.equal(PRACTICE_TITLE, 'Practice');
    assert.equal(PRACTICE_PURPOSE, 'Short practice from what you have said.');
    assert.ok(PRACTICE_PURPOSE.split(' ').length <= 8, 'the purpose line grew back into a slogan');
    assert.equal(NEXT_PRACTICE_LABEL, 'Your next practice');
    assert.equal(ALTERNATIVES.label, 'More ways to practise');
    assert.equal(ALTERNATIVES.from, 'From');
  });

  test('there is one door into the archive, and one word for it', () => {
    // "Choose a conversation" and "See your conversations" opened the same
    // screen from two places on one page. One survives, as a quiet door.
    assert.equal(PRACTICE_ALTERNATIVES.choose, 'Choose a conversation');
    assert.ok(!('CONVERSATION_ARCHIVE_ACTION' in COPY), 'the second archive door is still exported');
    assert.ok(!('MADE_FROM_LABEL' in COPY), 'the second heading naming the conversation is still exported');
    assert.ok(!PRACTICE_COPY.includes('See your conversations'), 'the second archive door still has words');
  });

  test('the two controls name the thing they open, and practise is spelled as a verb', () => {
    assert.equal(REVIEW_ACTION, 'Review');
    assert.equal(PACK_ACTION, 'Practise this conversation');
    assert.ok(!PACK_ACTION.includes('Practice '), 'the control says the noun where the learner is being asked to do something');
  });

  test('nothing the tab says to a learner scolds, counts, or carries a dash they cannot read aloud', () => {
    assert.ok(PRACTICE_COPY.length >= 5, 'the sweep runs over fewer lines than the module exports');
    for (const line of PRACTICE_COPY) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a word this app does not say to a learner`);
      assert.ok(!line.includes('—'), `"${line}" has an em dash in copy a learner reads`);
      assert.ok(!/\d/.test(line), `"${line}" counts something at a learner who came here to speak`);
    }
  });
});
