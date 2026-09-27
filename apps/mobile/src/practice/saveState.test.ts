import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { guiltIn } from '../copy/guilt.ts';
import { PRACTICE_END } from './copy.ts';
import { practiceEndCard, saveStateOf, saveStateOfResult } from './saveState.ts';

describe('what the end card may say about saving', () => {
  test('each completion status maps to exactly what reached the disk', () => {
    assert.equal(saveStateOf('completed'), 'saved');
    assert.equal(saveStateOf('already-completed'), 'saved', 'a sitting already finished is reported as unsaved');
    assert.equal(saveStateOf('kept'), 'saved-locally');
    for (const status of ['failed', 'nothing-to-save', 'account-changed'] as const) {
      assert.equal(saveStateOf(status), 'not-saved', `${status} was reported as saved`);
    }
  });

  test('only a confirmed save says what happens next, and only a failure offers a retry', () => {
    const saved = practiceEndCard('saved', 'recalled-some');
    assert.deepEqual(saved, { title: PRACTICE_END['recalled-some'], body: PRACTICE_END.after, retry: false });

    const kept = practiceEndCard('saved-locally', 'practised');
    assert.equal(kept.body, PRACTICE_END.savedLocally, 'a sitting kept on this phone is described as fully saved');
    assert.equal(kept.retry, false);

    const failed = practiceEndCard('not-saved', 'recalled-some');
    assert.equal(failed.title, PRACTICE_END.notSaved, 'an unsaved sitting still claims what it recalled');
    assert.equal(failed.retry, true, 'an unsaved sitting offers no way to try again');
  });

  test('a sitting saved but aged out of the history says so, and promises nothing about My French', () => {
    assert.equal(saveStateOfResult({ status: 'completed', history: 'aged-out' }), 'saved-outside-history');
    assert.equal(saveStateOfResult({ status: 'completed', history: 'recorded' }), 'saved');
    // The history field never upgrades a status that did not save.
    assert.equal(saveStateOfResult({ status: 'failed', history: 'aged-out' }), 'not-saved');
    assert.equal(saveStateOfResult({ status: 'kept', history: 'pending' }), 'saved-locally');
    const card = practiceEndCard('saved-outside-history', 'recalled-some');
    assert.deepEqual(card, { title: PRACTICE_END.savedOutsideHistory, body: PRACTICE_END.savedOutsideHistoryBody, retry: false });
    assert.doesNotMatch(`${card.title} ${card.body}`, /My French|recalled|without choices/i, 'an aged-out sitting claims a history entry or a recall it cannot back');
    for (const line of [PRACTICE_END.savedOutsideHistory, PRACTICE_END.savedOutsideHistoryBody]) {
      assert.equal(guiltIn(line), undefined);
      assert.ok(!line.includes('—') && !/\d/.test(line));
    }
  });

  test('a resume with nothing saved never claims the phrases are gone', () => {
    assert.equal(PRACTICE_END.nothingToResume, 'There is no unfinished practice to resume.');
    assert.doesNotMatch(`${PRACTICE_END.nothingToResume} ${PRACTICE_END.nothingToResumeBody}`, /no longer|gone|deleted|lost/i, 'a finished sitting is described as missing');
  });

  test('the save lines are warm, plain and count nothing', () => {
    for (const line of [PRACTICE_END.notSaved, PRACTICE_END.notSavedBody, PRACTICE_END.savedLocally, PRACTICE_END.retry, PRACTICE_END.retrying, PRACTICE_END.cannotResume, PRACTICE_END.cannotResumeBody, PRACTICE_END.nothingToResume, PRACTICE_END.nothingToResumeBody]) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a banned word`);
      assert.ok(!line.includes('—'));
      assert.ok(!/\d/.test(line), `"${line}" counts at the learner`);
    }
  });
});
