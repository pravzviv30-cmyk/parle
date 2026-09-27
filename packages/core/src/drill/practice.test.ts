import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPracticeSession,
  practiceGrades,
  practiceOutcomeOf,
  selectPackQueue,
  selectPracticeQueue,
  PER_SOURCE_CAP,
  PRACTICE_QUEUE_CAP,
  type PracticeTarget,
} from './practice.ts';
import { answerCurrent, buildDrillSession, summarise, type AnsweredExercise, type DrillSessionState } from './session.ts';
import { applyGrade, newCard, type ReviewCard } from '../review/scheduler.ts';
import type {
  DrillExercise,
  FillBlankExercise,
  ListenTypeExercise,
  OwnWordsExercise,
  RepeatThisExercise,
  TapTranslateExercise,
  TranslationExercise,
} from './types.ts';

const NOW = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

function card(id: string, overrides: Partial<ReviewCard> = {}): ReviewCard {
  return { ...newCard({ id, kind: 'vocab', front: id, back: id, context: '', ipa: '' }, NOW - 30 * DAY_MS), ...overrides };
}

/** Due `ago` days before NOW: larger means more overdue. */
function due(id: string, ago: number, overrides: Partial<ReviewCard> = {}): ReviewCard {
  return card(id, { due: NOW - ago * DAY_MS, reps: 1, intervalDays: 1, ...overrides });
}

/** Scheduled for later: rehearsing it is early. */
function later(id: string, overrides: Partial<ReviewCard> = {}): ReviewCard {
  return card(id, { due: NOW + 5 * DAY_MS, reps: 2, intervalDays: 6, ...overrides });
}

function optionsEx(id: string, phraseKey: string): FillBlankExercise {
  return { kind: 'fill-blank', id, phraseKey, difficulty: 'recognition', sentence: '___ !', options: ['bonjour', 'bonsoir'], accepted: ['bonjour'], en: 'Hello!' };
}
function tapEx(id: string, phraseKey: string): TapTranslateExercise {
  return { kind: 'tap-translate', id, phraseKey, difficulty: 'recognition', en: 'Hello', tokens: ['bonjour', 'bonsoir'], accepted: ['bonjour'] };
}
function typedEx(id: string, phraseKey: string): FillBlankExercise {
  return { kind: 'fill-blank', id, phraseKey, difficulty: 'production', sentence: '___ !', options: null, accepted: ['bonjour'], en: 'Hello!' };
}
function listenEx(id: string, phraseKey: string): ListenTypeExercise {
  return { kind: 'listen-type', id, phraseKey, difficulty: 'production', fr: 'Bonjour', accepted: ['Bonjour'] };
}
function spokenEx(id: string, phraseKey: string): RepeatThisExercise {
  return { kind: 'repeat-this', id, phraseKey, difficulty: 'production', reference: 'Bonjour', referenceEn: 'Hello', ipa: null, noMicTwin: listenEx(`${id}-silent`, phraseKey) };
}
function translateEx(id: string, phraseKey: string, direction: 'fr-en' | 'en-fr'): TranslationExercise {
  return {
    kind: 'translate',
    id,
    phraseKey,
    difficulty: 'production',
    fr: 'Bonjour',
    en: 'Hello',
    direction,
    accepted: direction === 'en-fr' ? ['Bonjour'] : ['Hello'],
  };
}
function ownWordsEx(id: string, phraseKey: string): OwnWordsExercise {
  return { kind: 'own-words', id, phraseKey, difficulty: 'production', fr: 'Bonjour', en: 'Hello', situation: 'At a cafe', mustKeep: ['hello'], accepted: [] };
}

/** One options exercise per key: enough to make a phrase playable. */
function bankFor(...keys: string[]): DrillExercise[] {
  return keys.map((k) => optionsEx(`ex:${k}`, k));
}

const keysOf = (targets: readonly PracticeTarget[]) => targets.map((t) => t.phraseKey);

describe('selectPracticeQueue: the balanced recommendation', () => {
  test('the caps are the agreed numbers', () => {
    assert.equal(PRACTICE_QUEUE_CAP, 6);
    assert.equal(PER_SOURCE_CAP, 3);
  });

  test('three due reviews in due order, then three from the latest pack', () => {
    const deck = [due('r:c', 1), due('r:a', 5), due('r:b', 3), due('r:d', 0.5), later('p:1'), later('p:2'), later('p:3'), later('p:4')];
    const bank = bankFor('r:a', 'r:b', 'r:c', 'r:d', 'p:1', 'p:2', 'p:3', 'p:4');
    const packs = [{ id: 'pack-new', phraseKeys: ['p:1', 'p:2', 'p:3', 'p:4'] }];

    const sel = selectPracticeQueue({ deck, bank, packs, now: NOW });

    assert.equal(sel.shape, 'balanced');
    assert.equal(sel.packId, 'pack-new');
    assert.deepEqual(keysOf(sel.targets), ['r:a', 'r:b', 'r:c', 'p:1', 'p:2', 'p:3']);
    assert.deepEqual(
      sel.targets.map((t) => t.source),
      [{ kind: 'review' }, { kind: 'review' }, { kind: 'review' }, { kind: 'pack', packId: 'pack-new' }, { kind: 'pack', packId: 'pack-new' }, { kind: 'pack', packId: 'pack-new' }],
    );
    assert.deepEqual(sel.targets.map((t) => t.scheduled), [true, true, true, false, false, false]);
    assert.deepEqual(sel.targets.map((t) => t.exerciseId), ['ex:r:a', 'ex:r:b', 'ex:r:c', 'ex:p:1', 'ex:p:2', 'ex:p:3']);
  });

  test('a phrase both due and in the pack is attributed to review and the pack takes its next phrase', () => {
    const deck = [due('shared', 9), due('r:b', 3), due('r:c', 1), later('p:1'), later('p:2'), later('p:3')];
    const bank = bankFor('shared', 'r:b', 'r:c', 'p:1', 'p:2', 'p:3');
    const packs = [{ id: 'pk', phraseKeys: ['shared', 'p:1', 'p:2', 'p:3'] }];

    const sel = selectPracticeQueue({ deck, bank, packs, now: NOW });

    assert.deepEqual(keysOf(sel.targets), ['shared', 'r:b', 'r:c', 'p:1', 'p:2', 'p:3']);
    assert.deepEqual(sel.targets[0]!.source, { kind: 'review' });
    assert.equal(new Set(keysOf(sel.targets)).size, sel.targets.length, 'no phrase appears twice');
  });

  test('a short review side is filled from the pack, up to the queue cap', () => {
    const deck = [due('r:a', 2), later('p:1'), later('p:2'), later('p:3'), later('p:4'), later('p:5'), later('p:6')];
    const bank = bankFor('r:a', 'p:1', 'p:2', 'p:3', 'p:4', 'p:5', 'p:6');
    const packs = [{ id: 'pk', phraseKeys: ['p:1', 'p:2', 'p:3', 'p:4', 'p:5', 'p:6'] }];

    const sel = selectPracticeQueue({ deck, bank, packs, now: NOW });

    assert.equal(sel.targets.length, PRACTICE_QUEUE_CAP);
    assert.deepEqual(keysOf(sel.targets), ['r:a', 'p:1', 'p:2', 'p:3', 'p:4', 'p:5']);
    assert.equal(sel.shape, 'balanced');
  });

  test('a short pack side is filled from review, in due order', () => {
    const deck = [due('r:a', 8), due('r:b', 7), due('r:c', 6), due('r:d', 5), due('r:e', 4), due('r:f', 3), later('p:1')];
    const bank = bankFor('r:a', 'r:b', 'r:c', 'r:d', 'r:e', 'r:f', 'p:1');
    const packs = [{ id: 'pk', phraseKeys: ['p:1'] }];

    const sel = selectPracticeQueue({ deck, bank, packs, now: NOW });

    assert.deepEqual(keysOf(sel.targets), ['r:a', 'r:b', 'r:c', 'r:d', 'r:e', 'p:1']);
  });

  test('phrases with no exercise are skipped, never queued empty', () => {
    const deck = [due('r:none', 9), due('r:a', 2), later('p:none'), later('p:1')];
    const bank = bankFor('r:a', 'p:1');
    const packs = [{ id: 'pk', phraseKeys: ['p:none', 'p:1'] }];

    const sel = selectPracticeQueue({ deck, bank, packs, now: NOW });

    assert.deepEqual(keysOf(sel.targets), ['r:a', 'p:1']);
    for (const t of sel.targets) assert.ok(bank.some((e) => e.id === t.exerciseId && e.phraseKey === t.phraseKey));
  });

  test('a latest pack with nothing playable gives way to the next pack in the order supplied', () => {
    const deck = [later('dead:1'), later('old:1')];
    const bank = bankFor('old:1');
    const packs = [
      { id: 'dead', phraseKeys: ['dead:1'] },
      { id: 'old', phraseKeys: ['old:1'] },
    ];

    const sel = selectPracticeQueue({ deck, bank, packs, now: NOW });

    assert.equal(sel.shape, 'pack-only');
    assert.equal(sel.packId, 'old');
    assert.deepEqual(sel.targets.map((t) => t.source), [{ kind: 'pack', packId: 'old' }]);
  });

  test('review only, with no playable pack, fills to the cap and names no pack', () => {
    const keys = ['r:1', 'r:2', 'r:3', 'r:4', 'r:5', 'r:6', 'r:7'];
    const deck = keys.map((k, i) => due(k, 10 - i));
    const sel = selectPracticeQueue({ deck, bank: bankFor(...keys), packs: [{ id: 'dead', phraseKeys: ['nothing'] }], now: NOW });

    assert.equal(sel.shape, 'review-only');
    assert.equal(sel.packId, null);
    assert.deepEqual(keysOf(sel.targets), keys.slice(0, 6));
  });

  test('nothing due and nothing playable is an empty selection, not a session', () => {
    const sel = selectPracticeQueue({ deck: [later('x')], bank: [], packs: [{ id: 'pk', phraseKeys: ['x'] }], now: NOW });
    assert.deepEqual(sel, { targets: [], shape: 'empty', packId: null });
  });

  test('a pack phrase that is also due is scheduled, and a never-met pack phrase is not', () => {
    const deck = [due('p:due', 1)];
    const bank = bankFor('p:due', 'p:new');
    // Nothing else is due, so review contributes p:due first; use a deck with
    // no due review to see the pack's own view of it.
    const packOnly = selectPracticeQueue({ deck: [], bank, packs: [{ id: 'pk', phraseKeys: ['p:new'] }], now: NOW });
    assert.deepEqual(packOnly.targets.map((t) => t.scheduled), [false]);

    const both = selectPracticeQueue({ deck, bank, packs: [{ id: 'pk', phraseKeys: ['p:due', 'p:new'] }], now: NOW });
    assert.deepEqual(both.targets.map((t) => [t.phraseKey, t.source.kind, t.scheduled]), [
      ['p:due', 'review', true],
      ['p:new', 'pack', false],
    ]);
  });

  test('deterministic, and the inputs are neither mutated nor made due', () => {
    const deck = [due('r:a', 3), later('p:1'), later('p:2')];
    const bank = bankFor('r:a', 'p:1', 'p:2');
    const packs = [{ id: 'pk', phraseKeys: ['p:1', 'p:2'] }];
    const snapshot = JSON.stringify({ deck, bank, packs });

    const a = selectPracticeQueue({ deck, bank, packs, now: NOW });
    const b = selectPracticeQueue({ deck, bank, packs, now: NOW });

    assert.deepEqual(a, b);
    assert.equal(JSON.stringify({ deck, bank, packs }), snapshot);
  });

  test('the ordinary due selector is untouched by a practice selection', () => {
    const deck = [due('r:a', 3), later('p:1')];
    const bank = bankFor('r:a', 'p:1');
    const before = buildDrillSession(deck, bank, NOW);
    selectPracticeQueue({ deck, bank, packs: [{ id: 'pk', phraseKeys: ['p:1'] }], now: NOW });
    assert.deepEqual(buildDrillSession(deck, bank, NOW), before);
    assert.deepEqual(before.queue.map((e) => e.phraseKey), ['r:a'], 'a not-due card still does not play in ordinary review');
  });
});

describe('selectPackQueue: practise this conversation now', () => {
  test('plays a pack whose cards are not due, capped at six, in pack order', () => {
    const keys = ['p:1', 'p:2', 'p:3', 'p:4', 'p:5', 'p:6', 'p:7'];
    const deck = keys.map((k) => later(k));
    const sel = selectPackQueue({ id: 'pk', phraseKeys: keys }, deck, bankFor(...keys), NOW);

    assert.equal(sel.shape, 'pack-only');
    assert.equal(sel.packId, 'pk');
    assert.deepEqual(keysOf(sel.targets), keys.slice(0, PRACTICE_QUEUE_CAP));
    assert.ok(sel.targets.every((t) => t.scheduled === false));
    assert.ok(sel.targets.every((t) => t.source.kind === 'pack' && t.source.packId === 'pk'));
  });

  test('includes due pack phrases as scheduled, dedups repeated keys, skips unplayable', () => {
    const deck = [due('p:1', 1), later('p:2')];
    const sel = selectPackQueue({ id: 'pk', phraseKeys: ['p:1', 'p:none', 'p:1', 'p:2'] }, deck, bankFor('p:1', 'p:2'), NOW);
    assert.deepEqual(sel.targets.map((t) => [t.phraseKey, t.scheduled]), [
      ['p:1', true],
      ['p:2', false],
    ]);
  });

  test('a pack with no playable phrase is empty rather than an empty session', () => {
    const sel = selectPackQueue({ id: 'pk', phraseKeys: ['p:none'] }, [], [], NOW);
    assert.deepEqual(sel, { targets: [], shape: 'empty', packId: null });
  });

  test('the exercise follows the earned stage, not a new policy', () => {
    const bank = [optionsEx('o', 'p:1'), tapEx('t', 'p:1'), typedEx('y', 'p:1'), spokenEx('s', 'p:1')];
    const at = (reps: number) => selectPackQueue({ id: 'pk', phraseKeys: ['p:1'] }, [later('p:1', { reps })], bank, NOW).targets[0]!.exerciseId;
    assert.equal(at(0), 'o');
    assert.equal(at(1), 't');
    assert.equal(at(2), 'y');
    assert.equal(at(3), 's');
    // A phrase the deck has never met starts at the easiest rung.
    assert.equal(selectPackQueue({ id: 'pk', phraseKeys: ['p:1'] }, [], bank, NOW).targets[0]!.exerciseId, 'o');
  });
});

describe('buildPracticeSession: the selection made playable', () => {
  const target = (phraseKey: string, exerciseId: string, scheduled: boolean): PracticeTarget => ({
    phraseKey,
    exerciseId,
    scheduled,
    source: scheduled ? { kind: 'review' } : { kind: 'pack', packId: 'pk' },
  });

  test('plays exactly the selected exercises, in target order', () => {
    const bank = [optionsEx('a1', 'a'), typedEx('a2', 'a'), optionsEx('b1', 'b')];
    const built = buildPracticeSession([target('b', 'b1', false), target('a', 'a2', true)], bank, [], NOW);

    assert.deepEqual(built.state.queue.map((e) => e.id), ['b1', 'a2']);
    assert.deepEqual(built.missing, []);
    assert.equal(built.state.finished, false);
    assert.deepEqual(built.state.answered, []);
  });

  test('a vanished exercise is re-picked for its phrase through the existing stage rule', () => {
    const bank = [optionsEx('a-opt', 'a'), typedEx('a-typ', 'a')];
    const built = buildPracticeSession([target('a', 'gone', false)], bank, [later('a', { reps: 2 })], NOW);
    assert.deepEqual(built.state.queue.map((e) => e.id), ['a-typ']);
    assert.equal(built.targets[0]!.exerciseId, 'a-typ');
  });

  test('an exercise id now pointing at another phrase is not trusted', () => {
    const bank = [optionsEx('shared-id', 'other'), optionsEx('a-opt', 'a')];
    const built = buildPracticeSession([target('a', 'shared-id', false)], bank, [], NOW);
    assert.deepEqual(built.state.queue.map((e) => e.id), ['a-opt']);
  });

  test('a phrase with nothing left to play is reported missing, never answered', () => {
    const built = buildPracticeSession([target('a', 'a1', true), target('gone', 'gone1', true)], [optionsEx('a1', 'a')], [], NOW);
    assert.deepEqual(built.missing.map((t) => t.phraseKey), ['gone']);
    assert.deepEqual(built.state.queue.map((e) => e.phraseKey), ['a']);
    assert.ok(!built.state.answered.some((a) => a.phraseKey === 'gone'));
  });

  test('an entirely missing selection carries no completion evidence', () => {
    const built = buildPracticeSession([target('gone', 'gone1', true)], [], [], NOW);
    assert.deepEqual(built.state.queue, []);
    assert.deepEqual(built.state.answered, []);
    assert.equal(built.missing.length, 1);
    const summary = summarise(built.state);
    assert.equal(summary.resolved, 0);
    assert.deepEqual(practiceGrades(built.state, built.targets), []);
  });

  test('a phrase selected twice plays once', () => {
    const built = buildPracticeSession([target('a', 'a1', true), target('a', 'a1', false)], [optionsEx('a1', 'a')], [due('a', 1)], NOW);
    assert.equal(built.state.queue.length, 1);
    assert.equal(built.targets.length, 1);
    assert.equal(built.targets[0]!.scheduled, true);
  });

  test('a target chosen as due but graded since is early rehearsal now, never the reverse', () => {
    const bank = [optionsEx('a1', 'a'), optionsEx('b1', 'b')];
    const deck = [later('a'), due('b', 1)];
    const built = buildPracticeSession([target('a', 'a1', true), target('b', 'b1', false)], bank, deck, NOW);
    assert.deepEqual(built.targets.map((t) => [t.phraseKey, t.scheduled]), [
      ['a', false],
      ['b', false],
    ]);
  });
});

describe('practiceGrades: early rehearsal does not move the schedule', () => {
  /** Answer every exercise in the queue with the given answer until it settles. */
  function playAll(state: DrillSessionState, answerFor: (e: DrillExercise) => string | number): DrillSessionState {
    let s = state;
    for (let guard = 0; !s.finished && guard < 50; guard++) {
      s = answerCurrent(s, answerFor(s.queue[0]!)).state;
    }
    return s;
  }
  const right = () => 'bonjour';
  const wrong = () => 'zzzz';

  test('a successful early rehearsal produces no grade at all', () => {
    const deck = [later('p:1'), later('p:2')];
    const sel = selectPackQueue({ id: 'pk', phraseKeys: ['p:1', 'p:2'] }, deck, [typedEx('e1', 'p:1'), typedEx('e2', 'p:2')], NOW);
    const built = buildPracticeSession(sel.targets, [typedEx('e1', 'p:1'), typedEx('e2', 'p:2')], deck, NOW);
    const done = playAll(built.state, right);

    assert.equal(summarise(done).resolved, 2, 'the practice happened');
    assert.deepEqual(practiceGrades(done, built.targets), []);
    // And so the not-due cards are exactly as they were: no interval, rep or evidence change.
    const graded = new Map(practiceGrades(done, built.targets).map((g) => [g.phraseKey, g]));
    const after = deck.map((c) => (graded.has(c.id) ? applyGrade(c, graded.get(c.id)!.grade, NOW) : c));
    assert.deepEqual(after, deck);
  });

  test('an unresolved early rehearsal uses the existing again policy and claims no transfer', () => {
    const transferEx: FillBlankExercise = { ...typedEx('e1', 'p:1'), transfer: true };
    const deck = [later('p:1')];
    const targets: PracticeTarget[] = [{ phraseKey: 'p:1', exerciseId: 'e1', scheduled: false, source: { kind: 'pack', packId: 'pk' } }];
    const built = buildPracticeSession(targets, [transferEx], deck, NOW);
    const done = playAll(built.state, wrong);

    assert.deepEqual(practiceGrades(done, built.targets), [{ phraseKey: 'p:1', grade: 'again' }]);
  });

  test('an unscheduled phrase that won a transfer then lost keeps no transfer mark', () => {
    // Hand-built answered record: summarise can report transfer alongside
    // 'again'. For early rehearsal that mark must not survive.
    const state: DrillSessionState = {
      queue: [],
      missesById: {},
      answered: [
        { id: 'x1', phraseKey: 'p:1', outcome: 'good', attempts: 1, transfer: true },
        { id: 'x2', phraseKey: 'p:1', outcome: 'unresolved', attempts: 2 },
      ],
      startedAt: NOW,
      finished: true,
    };
    const unscheduled: PracticeTarget[] = [{ phraseKey: 'p:1', exerciseId: 'x1', scheduled: false, source: { kind: 'pack', packId: 'pk' } }];
    assert.deepEqual(practiceGrades(state, unscheduled), [{ phraseKey: 'p:1', grade: 'again' }]);
  });

  test('scheduled targets grade exactly as the ordinary drill summary does', () => {
    const transferEx: FillBlankExercise = { ...typedEx('e1', 'r:1'), transfer: true };
    const bank = [transferEx, typedEx('e2', 'r:2')];
    const deck = [due('r:1', 2, { reps: 2 }), due('r:2', 1, { reps: 2 })];
    const sel = selectPracticeQueue({ deck, bank, packs: [], now: NOW });
    const built = buildPracticeSession(sel.targets, bank, deck, NOW);
    let s = built.state;
    s = answerCurrent(s, 'bonjour').state; // r:1 good, transfer
    s = answerCurrent(s, 'zzzz').state; // r:2 miss, back of queue
    s = answerCurrent(s, 'zzzz').state; // r:2 unresolved

    assert.deepEqual(practiceGrades(s, built.targets), summarise(s).grades);
    assert.deepEqual(practiceGrades(s, built.targets), [
      { phraseKey: 'r:1', grade: 'good', transfer: true },
      { phraseKey: 'r:2', grade: 'again' },
    ]);
  });

  test('a mixed balanced sitting grades only its scheduled half on success', () => {
    const deck = [due('r:1', 2), later('p:1')];
    const bank = bankFor('r:1', 'p:1');
    const sel = selectPracticeQueue({ deck, bank, packs: [{ id: 'pk', phraseKeys: ['p:1'] }], now: NOW });
    const built = buildPracticeSession(sel.targets, bank, deck, NOW);
    const done = playAll(built.state, right);
    assert.deepEqual(practiceGrades(done, built.targets), [{ phraseKey: 'r:1', grade: 'good' }]);
  });

  test('an answered phrase with no target is not graded on a guess', () => {
    const state: DrillSessionState = {
      queue: [],
      missesById: {},
      answered: [{ id: 'x', phraseKey: 'stranger', outcome: 'good', attempts: 1 }],
      startedAt: NOW,
      finished: true,
    };
    assert.deepEqual(practiceGrades(state, []), []);
  });
});

describe('practiceOutcomeOf: what an answer honestly proves', () => {
  const answered = (e: DrillExercise, outcome: AnsweredExercise['outcome'], attempts = 1): AnsweredExercise => ({
    id: e.id,
    phraseKey: e.phraseKey,
    outcome,
    attempts,
  });

  test('English shown, French typed, right first time: recalled', () => {
    const e = translateEx('t', 'p', 'en-fr');
    assert.equal(practiceOutcomeOf(answered(e, 'good'), e), 'recalled');
  });

  test('every format with the French on screen, in the ear or in the choices is practised', () => {
    const shown: DrillExercise[] = [
      spokenEx('s', 'p'), // imitation of a displayed line
      listenEx('l', 'p'), // transcription of audio
      typedEx('y', 'p'), // the sentence and gloss frame the blank
      optionsEx('o', 'p'),
      tapEx('t', 'p'),
      translateEx('fe', 'p', 'fr-en'), // French is the prompt
      { kind: 'best-sentence', id: 'b', phraseKey: 'p', difficulty: 'recognition', prompt: 'Greet', candidates: [{ fr: 'Bonjour', en: 'Hello' }], correctIndex: 0 },
      { kind: 'appropriate-reply', id: 'r', phraseKey: 'p', difficulty: 'recognition', line: { speaker: 'A', fr: 'Salut', en: 'Hi' }, options: [{ fr: 'Bonjour', en: 'Hello' }], acceptableIndexes: [0] },
      ownWordsEx('w', 'p'), // own meaning, not recall of the saved phrase
    ];
    for (const e of shown) assert.equal(practiceOutcomeOf(answered(e, 'good'), e), 'practised', e.kind);
  });

  test('a retry, a spelling correction or a mismatched record is only practised', () => {
    const e = translateEx('t', 'p', 'en-fr');
    assert.equal(practiceOutcomeOf(answered(e, 'good', 2), e), 'practised');
    assert.equal(practiceOutcomeOf(answered(e, 'typo'), e), 'practised');
    assert.equal(practiceOutcomeOf({ ...answered(e, 'good'), id: 'other' }, e), 'practised');
    assert.equal(practiceOutcomeOf({ ...answered(e, 'good'), phraseKey: 'other' }, e), 'practised');
  });

  test('unresolved is unresolved whatever the format', () => {
    for (const e of [translateEx('t', 'p', 'en-fr'), spokenEx('s', 'p'), optionsEx('o', 'p')]) {
      assert.equal(practiceOutcomeOf(answered(e, 'unresolved', 2), e), 'unresolved', e.kind);
    }
  });
});
