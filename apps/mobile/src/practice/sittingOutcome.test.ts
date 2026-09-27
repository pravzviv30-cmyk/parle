import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  answerCurrent,
  buildPracticeSession,
  newCard,
  phraseKeyOf,
  practiceGrades,
  summariseDrill,
  type DrillExercise,
  type PracticeTarget,
  type ReviewCard,
} from '@luvani/core';

import { hasAnsweredWork, sittingStatement } from './sittingOutcome.ts';
import { practiceCardGrades, practiceOutcomes } from './completion.ts';

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

function card(fr: string, dueIn: number): ReviewCard {
  return { ...newCard({ id: phraseKeyOf(fr), kind: 'vocab', front: fr, back: 'x', context: '', ipa: '' }, NOW - 10 * DAY), due: NOW + dueIn, reps: 2 };
}

const enFr = (fr: string): DrillExercise => ({
  id: `t:${fr}`, phraseKey: phraseKeyOf(fr), difficulty: 'production', kind: 'translate', fr, en: `meaning ${fr}`, direction: 'en-fr', accepted: [fr],
});
const listen = (fr: string): DrillExercise => ({
  id: `l:${fr}`, phraseKey: phraseKeyOf(fr), difficulty: 'production', kind: 'listen-type', fr, accepted: [fr],
} as DrillExercise);

const target = (ex: DrillExercise, scheduled: boolean, source: PracticeTarget['source'] = { kind: 'pack', packId: 'p1' }): PracticeTarget =>
  ({ phraseKey: ex.phraseKey, exerciseId: ex.id, source, scheduled });

describe('a practice sitting says only what it showed', () => {
  test('an early success hands the scheduler nothing, where an ordinary drill would have graded it good', () => {
    // The pin the verifier asked for. Same answers, same cards, two paths: the
    // ordinary summary grades the not-due phrase 'good', which would push its
    // interval out, and practiceGrades withholds it. The practice path must
    // use the second, and DrillScreen's own test proves it calls it.
    const ex = enFr('Sur place');
    const deck = [card('Sur place', 4 * DAY)];
    const built = buildPracticeSession([target(ex, false)], [ex], deck, NOW);
    const done = answerCurrent(built.state, 'Sur place').state;

    assert.deepEqual(summariseDrill(done).grades.map((g) => g.grade), ['good'], 'the ordinary summary changed shape; this pin is stale');
    assert.deepEqual(practiceGrades(done, built.targets), [], 'a successful early rehearsal moved the schedule');
  });

  test('a due target in a practice sitting grades exactly as ordinary review does, and a miss on an early one still counts', () => {
    const due = enFr('Merci');
    const early = enFr('Pardon');
    const deck = [card('Merci', -DAY), card('Pardon', 4 * DAY)];
    const built = buildPracticeSession([target(due, true, { kind: 'review' }), target(early, false)], [due, early], deck, NOW);
    let state = answerCurrent(built.state, 'Merci').state;
    state = answerCurrent(state, 'nope').state;
    state = answerCurrent(state, 'still nope').state;

    assert.deepEqual(practiceGrades(state, built.targets), [
      { phraseKey: phraseKeyOf('Merci'), grade: 'good' },
      { phraseKey: phraseKeyOf('Pardon'), grade: 'again' },
    ]);
  });

  test('recalled is claimed only for a first-time English-to-French answer with no warm-up before it', () => {
    const t = enFr('Je voudrais un café');
    const l = listen('Sur place');
    const deck = [card('Je voudrais un café', 4 * DAY), card('Sur place', 4 * DAY)];
    const built = buildPracticeSession([target(t, false), target(l, false)], [t, l], deck, NOW);
    let state = answerCurrent(built.state, 'Je voudrais un café').state;
    state = answerCurrent(state, 'Sur place').state;

    const cold = practiceOutcomes({ state, targets: built.targets, exercises: [t, l], exposed: false });
    assert.deepEqual(cold.map((o) => o.outcome), ['recalled', 'practised'], 'transcription was counted as recall');

    // Straight after the warm-up that showed and played these very lines.
    const warm = practiceOutcomes({ state, targets: built.targets, exercises: [t, l], exposed: true });
    assert.deepEqual(warm.map((o) => o.outcome), ['practised', 'practised'], 'a phrase just shown was reported as recalled without help');
  });

  test('a retry, a typo or a miss is never recall, and a later miss lowers an earlier claim', () => {
    const t = enFr('Ça marche');
    const built = buildPracticeSession([target(t, false)], [t], [card('Ça marche', 4 * DAY)], NOW);
    let state = answerCurrent(built.state, 'wrong').state;
    state = answerCurrent(state, 'Ça marche').state;
    assert.deepEqual(practiceOutcomes({ state, targets: built.targets, exercises: [t], exposed: false }).map((o) => o.outcome), ['practised']);

    const doubled = {
      ...built.state,
      answered: [
        { id: t.id, phraseKey: t.phraseKey, outcome: 'good' as const, attempts: 1 },
        { id: t.id, phraseKey: t.phraseKey, outcome: 'unresolved' as const, attempts: 2 },
      ],
    };
    assert.deepEqual(practiceOutcomes({ state: doubled, targets: built.targets, exercises: [t], exposed: false }).map((o) => o.outcome), ['unresolved']);
  });

  test('attribution rides on each outcome, and an answer with no target is left out', () => {
    const r = enFr('Bonjour');
    const p = enFr('Au revoir');
    const built = buildPracticeSession([target(r, true, { kind: 'review' }), target(p, false)], [r, p], [card('Bonjour', -DAY), card('Au revoir', DAY)], NOW);
    let state = answerCurrent(built.state, 'Bonjour').state;
    state = answerCurrent(state, 'Au revoir').state;
    const outcomes = practiceOutcomes({ state: { ...state, answered: [...state.answered, { id: 'x', phraseKey: 'phrase:stray', outcome: 'good', attempts: 1 }] }, targets: built.targets, exercises: [r, p], exposed: false });
    assert.deepEqual(outcomes.map((o) => o.source.kind), ['review', 'pack']);
    assert.equal(outcomes.length, 2, 'an answer nobody targeted was recorded against something');
  });

  test('after the warm-up even a due target is not a spaced return, and an early miss still counts', () => {
    // The completion owner's grade rule, pinned against the screen's path: the
    // warm-up showed the French, so a success there moves no interval.
    const due = enFr('Merci');
    const deck = [card('Merci', -DAY)];
    const built = buildPracticeSession([target(due, true, { kind: 'review' })], [due], deck, NOW);
    const done = answerCurrent(built.state, 'Merci').state;
    assert.deepEqual(practiceCardGrades(done, built.targets, false), [{ id: phraseKeyOf('Merci'), grade: 'good' }], 'a cold due success is not graded as review');
    assert.deepEqual(practiceCardGrades(done, built.targets, true), [], 'a success straight after the warm-up moved the schedule');
    let missed = answerCurrent(built.state, 'nope').state;
    missed = answerCurrent(missed, 'still nope').state;
    assert.deepEqual(practiceCardGrades(missed, built.targets, true), [{ id: phraseKeyOf('Merci'), grade: 'again' }]);
  });

  test('an empty sitting has nothing to finish, whatever its finished flag says', () => {
    const empty = buildPracticeSession([], [], [], NOW);
    assert.equal(empty.state.finished, true, 'core changed how it builds an empty sitting; this guard is still needed either way');
    assert.equal(hasAnsweredWork(empty.state), false);
    assert.equal(sittingStatement([]), 'nothing');
  });

  test('the end card statement never claims more than the outcomes', () => {
    const o = (outcome: 'recalled' | 'practised' | 'unresolved') => ({ phraseKey: 'k', exerciseId: 'e', source: { kind: 'review' as const }, outcome });
    assert.equal(sittingStatement([o('practised'), o('recalled')]), 'recalled-some');
    assert.equal(sittingStatement([o('practised'), o('unresolved')]), 'practised');
    assert.equal(sittingStatement([o('unresolved')]), 'coming-back');
  });
});
