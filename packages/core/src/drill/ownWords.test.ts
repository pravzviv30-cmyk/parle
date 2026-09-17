import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  decideOwnWords,
  meaningWords,
  ownWordsFrom,
  scopedOwnWordsSession,
  MUST_KEEP_MAX,
  type OwnWordsVerdict,
} from './ownWords.ts';
import { answerCurrent, stageOf, summarise, DRILL_STAGES, MAX_MISSES } from './session.ts';
import { gradeAnswer } from './grading.ts';
import { validateExercise } from './validate.ts';

const PHRASE = { fr: "Un café, s'il vous plaît", en: 'A coffee please', key: "phrase:un café, s'il vous plaît" };
const SITUATION = 'You are at the counter and the queue behind you is long.';

function verdict(overrides: Partial<OwnWordsVerdict> = {}): OwnWordsVerdict {
  return { meaningKept: true, comprehensible: true, natural: 'yes', betterLine: null, note: 'That works.', ...overrides };
}

describe('the judgement — what a learner has to do to have said it', () => {
  test('a verdict that keeps the meaning is good even when it is awkward', () => {
    const awkward = verdict({ natural: 'awkward', betterLine: "Un café, s'il vous plaît", note: 'A French person would say it shorter.' });
    assert.equal(decideOwnWords(awkward, 0), 'good');
    // Awkward is recorded so the better line can be shown; it never costs the
    // learner the outcome, because clumsy French that lands is speaking.
    assert.equal(decideOwnWords(verdict({ natural: 'no' }), 0), 'good');
  });

  test('a verdict that loses the meaning retries once then reveals', () => {
    const lost = verdict({ meaningKept: false, comprehensible: true, note: 'That asked for tea.' });
    assert.equal(decideOwnWords(lost, 0), 'retry');
    assert.equal(decideOwnWords(lost, 1), 'reveal');
    assert.equal(MAX_MISSES, 2, 'the retry bound is the drill engine own bound, not a second number to keep in step');
  });

  test('French nobody could understand is not a success, however faithful the learner meant it', () => {
    assert.equal(decideOwnWords(verdict({ comprehensible: false }), 0), 'retry');
    assert.equal(decideOwnWords(verdict({ meaningKept: false, comprehensible: false }), 1), 'reveal');
  });

  test('a learner who keeps trying is never held past the second attempt', () => {
    const lost = verdict({ meaningKept: false });
    for (const misses of [1, 2, 5]) assert.equal(decideOwnWords(lost, misses), 'reveal');
  });
});

describe('the exercise — a situation, not an answer key', () => {
  test('the learner is asked for a meaning and never handed a right string to copy', () => {
    const exercise = ownWordsFrom(PHRASE, SITUATION);
    assert.equal(exercise.kind, 'own-words');
    assert.equal(exercise.id, "own:phrase:un café, s'il vous plaît");
    assert.equal(exercise.phraseKey, PHRASE.key);
    assert.equal(exercise.difficulty, 'production');
    assert.equal(exercise.situation, SITUATION);
    assert.deepEqual(exercise.accepted, [], 'an accepted answer would turn this back into a recall drill');
    assert.equal(validateExercise(exercise).ok, true);
  });

  test('what the meaning cannot lose is written down before anybody judges the attempt', () => {
    assert.deepEqual(ownWordsFrom(PHRASE, SITUATION).mustKeep, ['coffee', 'please']);
    assert.deepEqual(meaningWords('I would like a table for the evening'), ['like', 'table', 'evening']);
    assert.ok(meaningWords('Could you tell me where the station is and how long it takes').length <= MUST_KEEP_MAX);
  });

  test('a meaning made only of small words still says what to keep', () => {
    assert.deepEqual(meaningWords('It is for me'), ['it is for me']);
  });

  test('the learner keeps their own words off the ladder until somebody decides where it belongs', () => {
    assert.equal(stageOf(ownWordsFrom(PHRASE, SITUATION)), null);
    assert.equal(([...DRILL_STAGES] as string[]).includes('own-words'), false);
  });

  test('nothing compares the attempt to a string, so the grade stays pending until a judge speaks', () => {
    const result = gradeAnswer(ownWordsFrom(PHRASE, SITUATION), 'je veux du cafe');
    assert.deepEqual(result, { verdict: 'pending', closest: null });
  });
});

describe('the sitting — one exercise, opened like any other drill', () => {
  test('a scoped sitting can be asked for own-words alone and synthesises one', () => {
    const state = scopedOwnWordsSession(PHRASE, SITUATION);
    assert.equal(state.finished, false);
    assert.equal(state.queue.length, 1);
    assert.equal(state.queue[0]?.kind, 'own-words');
    assert.equal(state.queue[0]?.phraseKey, PHRASE.key);
    assert.deepEqual(state.answered, []);
  });

  test('a learner who gets the meaning across finishes, and the phrase counts as known', () => {
    const state = scopedOwnWordsSession(PHRASE, SITUATION);
    const { state: done, feedback } = answerCurrent(state, 'je voudrais un cafe', decideOwnWords(verdict({ natural: 'awkward' }), 0));
    assert.equal(done.finished, true);
    assert.equal(feedback?.verdict, 'good');
    assert.deepEqual(summarise(done).grades, [{ phraseKey: PHRASE.key, grade: 'good' }]);
  });

  test('a learner who loses the meaning is asked again before the phrase is ever shown', () => {
    const start = scopedOwnWordsSession(PHRASE, SITUATION);
    const lost = verdict({ meaningKept: false });
    const first = answerCurrent(start, 'je voudrais un the', decideOwnWords(lost, 0));
    assert.equal(first.feedback?.advanced, false, 'the exercise comes back rather than ending the sitting');
    assert.equal(first.feedback?.closest, null, 'showing the phrase now would make the retry copying');
    assert.equal(first.state.queue.length, 1);

    const second = answerCurrent(first.state, 'je voudrais un the', decideOwnWords(lost, 1));
    assert.equal(second.feedback?.advanced, true);
    assert.equal(second.feedback?.closest, PHRASE.fr, 'the reveal shows the phrase in its real spelling');
    assert.equal(second.state.finished, true);
    assert.deepEqual(summarise(second.state).grades, [{ phraseKey: PHRASE.key, grade: 'again' }]);
  });

  test('a reveal ends the exercise even when the learner asked for it on the first try', () => {
    const start = scopedOwnWordsSession(PHRASE, SITUATION);
    const { state, feedback } = answerCurrent(start, '', 'reveal');
    assert.equal(feedback?.advanced, true, 'showing the phrase and then asking again would be copying');
    assert.equal(state.finished, true);
    assert.equal(summarise(state).unresolved, 1);
  });

  test('an attempt nobody has judged yet is never read as one the learner lost', () => {
    const start = scopedOwnWordsSession(PHRASE, SITUATION);
    const { state, feedback } = answerCurrent(start, 'je voudrais un cafe');
    assert.equal(feedback, null, 'core does not guess what a judge would have said');
    assert.deepEqual(state, start, 'the sitting is left exactly as it was found');
  });

  test('a decision handed in for an ordinary exercise cannot talk the engine out of comparing', () => {
    const typed = {
      kind: 'fill-blank' as const,
      id: 'a-typ',
      phraseKey: 'phrase:bonjour',
      difficulty: 'production' as const,
      sentence: '___ !',
      options: null,
      accepted: ['bonjour'],
      en: 'Hello!',
    };
    const state = { queue: [typed], missesById: {}, answered: [], startedAt: 0, finished: false };
    const { feedback } = answerCurrent(state, 'pas du tout', 'good');
    assert.equal(feedback?.verdict, 'miss');
  });
});
