import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  NEXT_PRACTICE_LABEL,
  PACK_ACTION,
  PRACTICE_COPY,
  PRACTICE_PURPOSE,
  PRACTICE_TITLE,
  REVIEW_ACTION,
} from './copy.ts';
import { guiltIn } from '../copy/guilt.ts';

describe('what the Practice tab says about itself — F574', () => {
  test('the learner is told where this page came from before they are asked to do anything', () => {
    // The title is the answer to "why am I looking at this": it was made from
    // conversations the learner had, and the purpose says what will be in it.
    assert.equal(PRACTICE_TITLE, 'Made from your conversations');
    assert.equal(
      PRACTICE_PURPOSE,
      'Talk with your tutor and this fills with what you said, the phrases worth keeping, and short drills built from them.',
    );
    assert.equal(NEXT_PRACTICE_LABEL, 'Your next practice');
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
