/**
 * LEARN-018: the end scene's settled marks and the assisted retry.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AnsweredExercise, DrillExercise } from '@luvani/core';

import { firstTry } from '../drill/firstTry.ts';
import { guiltIn } from '../copy/guilt.ts';
import {
  SETTLED_LABEL,
  STILL_SETTLING_LABEL,
  retryButtonLabel,
  retryEnd,
  retrySitting,
  settledMarks,
  stillSettling,
} from './stillSettling.ts';

const a = (id: string, phraseKey: string, outcome: AnsweredExercise['outcome'], attempts: number): AnsweredExercise => ({ id, phraseKey, outcome, attempts });
const ex = (id: string, phraseKey: string, kind: string): DrillExercise => ({ id, phraseKey, kind }) as unknown as DrillExercise;

describe('still settling (LEARN-018)', () => {
  test('a first-try typo is settled; a second-try right and an unresolved are still settling', () => {
    const answered = [a('1', 'p:typo', 'typo', 1), a('2', 'p:second', 'good', 2), a('3', 'p:lost', 'unresolved', 2), a('4', 'p:clean', 'good', 1)];
    assert.deepEqual(settledMarks(answered), [
      { phraseKey: 'p:typo', mark: 'settled' },
      { phraseKey: 'p:second', mark: 'still-settling' },
      { phraseKey: 'p:lost', mark: 'still-settling' },
      { phraseKey: 'p:clean', mark: 'settled' },
    ]);
    assert.deepEqual(stillSettling(answered), ['p:second', 'p:lost']);
  });

  test('a phrase drilled twice is only as settled as its worse exercise, in either order', () => {
    assert.deepEqual(stillSettling([a('1', 'p', 'good', 1), a('2', 'p', 'good', 2)]), ['p']);
    assert.deepEqual(stillSettling([a('1', 'p', 'good', 2), a('2', 'p', 'good', 1)]), ['p']);
  });

  test('own-words and repeat-this follow core outcome: first-try good settles, a reveal does not', () => {
    const answered = [a('ow1', 'p:ow-good', 'good', 1), a('ow2', 'p:ow-reveal', 'unresolved', 1), a('r1', 'p:rep', 'good', 1), a('r2', 'p:rep-miss', 'good', 2)];
    assert.deepEqual(stillSettling(answered), ['p:ow-reveal', 'p:rep-miss']);
  });

  test('nothing still settling hides the button and offers no retry', () => {
    const answered = [a('1', 'p', 'good', 1)];
    assert.equal(retryButtonLabel(stillSettling(answered).length), null);
    assert.equal(retrySitting(answered, [ex('1', 'p', 'translate')], { isRetry: false }), null);
    assert.equal(retrySitting([], [], { isRetry: false }), null);
  });

  test('the retry asks only the exercises that did not come out first time, and writes nothing', () => {
    const answered = [a('1', 'p', 'good', 1), a('2', 'p', 'good', 2), a('3', 'q', 'unresolved', 2), a('4', 'r', 'typo', 1)];
    const exercises = [ex('1', 'p', 'translate'), ex('2', 'p', 'listen-type'), ex('3', 'q', 'own-words'), ex('4', 'r', 'translate')];
    const retry = retrySitting(answered, exercises, { isRetry: false });
    assert.ok(retry);
    assert.deepEqual(retry.exercises.map((e) => e.id), ['2', '3']);
    assert.deepEqual(retry.phraseKeys, ['p', 'q']);
    assert.equal(retry.assisted, true);
    assert.equal(retry.countsFirstTry, false);
    assert.equal(retry.xp, 0);
    assert.equal(retry.writesProgress, false);
    assert.equal(retry.canRetryAgain, false);
  });

  test('a missing exercise is skipped, not invented', () => {
    assert.equal(retrySitting([a('9', 'p', 'good', 2)], [], { isRetry: false }), null);
  });

  test('a retry sitting never offers another retry, even with misses in it', () => {
    const answered = [a('2', 'p', 'unresolved', 2)];
    assert.equal(retrySitting(answered, [ex('2', 'p', 'translate')], { isRetry: true }), null);
    assert.deepEqual(retryEnd().actions, ['done']);
  });

  test('retry answers are out of first try and XP: the end shows no first-try tile and no XP', () => {
    const end = retryEnd();
    assert.equal(end.firstTry, null);
    assert.equal(end.xp, 0);
    // Even a clean retry answer would count under firstTry, which is why the retry end must not call it.
    assert.equal(firstTry({ answered: [a('2', 'p', 'good', 1)] }).right, 1);
  });

  test('copy: one or many, no em dash, nothing scolding', () => {
    assert.equal(retryButtonLabel(1), 'Practise the one still settling');
    assert.equal(retryButtonLabel(3), 'Practise the ones still settling');
    for (const line of [retryButtonLabel(1)!, retryButtonLabel(2)!, SETTLED_LABEL, STILL_SETTLING_LABEL]) {
      assert.ok(!line.includes('—') && !line.includes('–'), line);
      assert.equal(guiltIn(line), undefined, line);
    }
  });
});
