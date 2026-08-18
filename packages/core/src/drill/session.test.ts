import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  answerCurrent,
  applyDrillResults,
  buildDrillSession,
  missFeedback,
  stageForReps,
  stageOf,
  suppressMic,
  summarise,
  typoFeedback,
  GOOD_FEEDBACK,
  DRILL_STAGES,
  MAX_MISSES,
  NEW_PHRASES_PER_SESSION,
  type DrillSessionState,
} from './session.ts';
import { DRILL_FIXTURES } from './fixtures.ts';
import { newCard, AGAIN_RETRY_MS, DUE_CAP, type ReviewCard } from '../review/scheduler.ts';
import type { DrillExercise, FillBlankExercise, ListenTypeExercise, RepeatThisExercise, TapTranslateExercise } from './types.ts';

const NOW = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A due review card for one drillable phrase, with scheduling overrides. */
function card(id: string, overrides: Partial<ReviewCard> = {}): ReviewCard {
  return { ...newCard({ id, kind: 'vocab', front: id, back: id, context: '', ipa: '' }, NOW), ...overrides };
}

// One tiny exercise per ramp stage, all drilling "bonjour" so any of them can
// be answered correctly with the same string in a test script.

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
  return {
    kind: 'repeat-this',
    id,
    phraseKey,
    difficulty: 'production',
    reference: 'Bonjour',
    referenceEn: 'Hello',
    ipa: null,
    noMicTwin: listenEx(`${id}-silent`, phraseKey),
  };
}

/** A session over exactly the given exercises, bypassing deck selection. */
function sessionOf(...queue: DrillExercise[]): DrillSessionState {
  return { queue, missesById: {}, answered: [], startedAt: NOW, finished: false };
}

describe('the ramp — reps to stage', () => {
  test('one rung per successful sitting: options, tokens, typed, spoken', () => {
    assert.equal(stageForReps(0), 'options');
    assert.equal(stageForReps(1), 'tap-tokens');
    assert.equal(stageForReps(2), 'typed');
    assert.equal(stageForReps(3), 'spoken');
  });

  test('the top rung holds however far reps climb', () => {
    assert.equal(stageForReps(9), 'spoken');
  });

  test('exercise formats sit on the expected rungs', () => {
    assert.equal(stageOf(optionsEx('x', 'phrase:a')), 'options');
    assert.equal(stageOf(tapEx('x', 'phrase:a')), 'tap-tokens');
    assert.equal(stageOf(typedEx('x', 'phrase:a')), 'typed');
    assert.equal(stageOf(listenEx('x', 'phrase:a')), 'typed');
    assert.equal(stageOf(spokenEx('x', 'phrase:a')), 'spoken');
  });
});

describe('buildDrillSession — the ramp against a scripted deck', () => {
  const bank = [optionsEx('a-opt', 'phrase:a'), tapEx('a-tap', 'phrase:a'), typedEx('a-typ', 'phrase:a'), spokenEx('a-spk', 'phrase:a')];

  test('each successful review earns exactly one less piece of scaffolding', () => {
    const expectations: [number, string][] = [
      [0, 'a-opt'],
      [1, 'a-tap'],
      [2, 'a-typ'],
      [3, 'a-spk'],
      [7, 'a-spk'],
    ];
    for (const [reps, expected] of expectations) {
      const s = buildDrillSession([card('phrase:a', { reps })], bank, NOW);
      assert.deepEqual(
        s.queue.map((e) => e.id),
        [expected],
        `reps ${reps}`,
      );
    }
  });

  test('a missing stage falls back to the nearest easier exercise', () => {
    const gappy = [optionsEx('a-opt', 'phrase:a'), tapEx('a-tap', 'phrase:a'), spokenEx('a-spk', 'phrase:a')];
    const s = buildDrillSession([card('phrase:a', { reps: 2 })], gappy, NOW);
    assert.deepEqual(s.queue.map((e) => e.id), ['a-tap'], 'extra scaffolding beats demanding unearned production');
  });

  test('only when nothing easier exists does the session reach upward', () => {
    const s = buildDrillSession([card('phrase:a', { reps: 0 })], [spokenEx('a-spk', 'phrase:a')], NOW);
    assert.deepEqual(s.queue.map((e) => e.id), ['a-spk']);
  });

  test('the earned stage wins over bank ordering', () => {
    const s = buildDrillSession([card('phrase:a', { reps: 0 })], [typedEx('a-typ', 'phrase:a'), optionsEx('a-opt', 'phrase:a')], NOW);
    assert.deepEqual(s.queue.map((e) => e.id), ['a-opt']);
  });
});

describe('buildDrillSession — who plays', () => {
  test('a card that is not yet due sits this one out', () => {
    const s = buildDrillSession([card('phrase:a', { due: NOW + DAY_MS })], [optionsEx('a-opt', 'phrase:a')], NOW);
    assert.deepEqual(s.queue, []);
    assert.equal(s.finished, true, 'an empty sitting is already over');
  });

  test('longest-overdue phrases come first, same as the flashcard deck', () => {
    const deck = [
      card('phrase:fresh', { due: NOW }),
      card('phrase:oldest', { due: NOW - 3 * DAY_MS }),
      card('phrase:old', { due: NOW - DAY_MS }),
    ];
    const bank = deck.map((c) => optionsEx(`${c.id}-opt`, c.id));
    const s = buildDrillSession(deck, bank, NOW);
    assert.deepEqual(
      s.queue.map((e) => e.phraseKey),
      ['phrase:oldest', 'phrase:old', 'phrase:fresh'],
    );
  });

  test('a phrase the bank cannot drill is skipped without comment', () => {
    const s = buildDrillSession([card('phrase:a'), card('phrase:b')], [optionsEx('b-opt', 'phrase:b')], NOW);
    assert.deepEqual(s.queue.map((e) => e.id), ['b-opt']);
  });

  test('the sitting cap holds — a neglected deck is not a wall of drills either', () => {
    const deck = Array.from({ length: DUE_CAP + 5 }, (_, i) => card(`phrase:p${i}`, { due: NOW - i }));
    const bank = deck.map((c) => optionsEx(`${c.id}-opt`, c.id));
    assert.equal(buildDrillSession(deck, bank, NOW).queue.length, DUE_CAP);
  });
});

describe('the queue — a miss waits at the back, it does not disappear', () => {
  const a = optionsEx('a-opt', 'phrase:a');
  const b = optionsEx('b-opt', 'phrase:b');

  test('a missed exercise re-queues to the end and the session stays open', () => {
    const { state, feedback } = answerCurrent(sessionOf(a, b), 'nope');
    assert.deepEqual(state.queue.map((e) => e.id), ['b-opt', 'a-opt']);
    assert.equal(state.finished, false);
    assert.equal(feedback?.verdict, 'miss');
    assert.equal(feedback?.advanced, false, 'the exercise will come back');
    assert.equal(feedback?.message, missFeedback('bonjour'));
  });

  test('the session completes only when every exercise has been answered correctly', () => {
    let s = sessionOf(a, b);
    s = answerCurrent(s, 'nope').state; // miss a → [b, a]
    s = answerCurrent(s, 'bonjour').state; // b done → [a]
    assert.equal(s.finished, false, 'a is still owed');
    s = answerCurrent(s, 'bonjour').state; // a done on the retry
    assert.equal(s.finished, true);

    const summary = summarise(s);
    assert.equal(summary.total, 2);
    assert.equal(summary.resolved, 2);
    assert.equal(summary.unresolved, 0);
    assert.equal(summary.retries, 1, 'the one re-ask is counted');
    assert.deepEqual(summary.grades, [
      { phraseKey: 'phrase:b', grade: 'good' },
      { phraseKey: 'phrase:a', grade: 'good' },
    ]);
  });
});

describe('two misses and the learner proceeds anyway', () => {
  test('the second miss resolves nothing but releases the exercise', () => {
    const first = answerCurrent(sessionOf(optionsEx('a-opt', 'phrase:a')), 'nope');
    assert.deepEqual(first.state.queue.map((e) => e.id), ['a-opt'], 'still owed after one miss');

    const second = answerCurrent(first.state, 'nope');
    assert.equal(second.state.finished, true, 'nobody drills one phrase into the ground');
    assert.equal(second.feedback?.advanced, true);
    assert.deepEqual(second.state.answered, [{ id: 'a-opt', phraseKey: 'phrase:a', outcome: 'unresolved', attempts: MAX_MISSES }]);

    const summary = summarise(second.state);
    assert.equal(summary.unresolved, 1);
    assert.deepEqual(summary.grades, [{ phraseKey: 'phrase:a', grade: 'again' }]);
  });
});

describe('a typo completes an exercise — a slipped finger is not a missing memory', () => {
  test('one edit resolves, is tracked apart, and still grades the card good', () => {
    const { state, feedback } = answerCurrent(sessionOf(typedEx('a-typ', 'phrase:a')), 'bonjout');
    assert.equal(feedback?.verdict, 'typo');
    assert.equal(feedback?.message, typoFeedback('bonjour'), 'the real spelling is kept in view');
    assert.equal(state.finished, true);

    const summary = summarise(state);
    assert.equal(summary.resolved, 1);
    assert.equal(summary.typos, 1);
    assert.deepEqual(summary.grades, [{ phraseKey: 'phrase:a', grade: 'good' }]);
  });
});

describe('suppressMic — going quiet costs nothing', () => {
  const s1 = spokenEx('s1', 'phrase:a');
  const t1 = typedEx('t1', 'phrase:b');
  const s2 = spokenEx('s2', 'phrase:c');

  test('every remaining repeat-this becomes its twin, in place', () => {
    const swapped = suppressMic(sessionOf(s1, t1, s2));
    assert.deepEqual(
      swapped.queue.map((e) => e.id),
      ['s1-silent', 't1', 's2-silent'],
      'same positions, same session length',
    );
    assert.ok(swapped.queue.every((e) => e.kind !== 'repeat-this'));
  });

  test('idempotent — a second call finds nothing to swap', () => {
    const once = suppressMic(sessionOf(s1, t1, s2));
    assert.equal(suppressMic(once), once);
  });

  test('an exercise already answered aloud keeps its spoken identity', () => {
    const spoke = answerCurrent(sessionOf(s1, s2), 'bonjour').state;
    const swapped = suppressMic(spoke);
    assert.equal(swapped.answered[0]?.id, 's1', 'history is not rewritten');
    assert.deepEqual(swapped.queue.map((e) => e.id), ['s2-silent']);
  });

  test('misses already spent carry over to the twin — no free attempts for going quiet', () => {
    let s = sessionOf(s1, t1);
    s = answerCurrent(s, 'nope').state; // miss the spoken exercise once → [t1, s1]
    s = suppressMic(s); // → [t1, s1-silent], with the miss carried
    s = answerCurrent(s, 'bonjour').state; // t1 done
    const final = answerCurrent(s, 'nope'); // second miss, now on the twin
    assert.equal(final.state.finished, true);
    assert.deepEqual(final.state.answered.at(-1), { id: 's1-silent', phraseKey: 'phrase:a', outcome: 'unresolved', attempts: 2 });
  });
});

describe('one memory system — outcomes feed the existing scheduler', () => {
  test('resolved reschedules good, unresolved reschedules again, bystanders pass through', () => {
    const deck = [card('phrase:a'), card('phrase:b'), card('phrase:c')];
    let s = sessionOf(optionsEx('a-opt', 'phrase:a'), optionsEx('b-opt', 'phrase:b'));
    s = answerCurrent(s, 'bonjour').state; // a resolved
    s = answerCurrent(s, 'nope').state; // b missed once
    s = answerCurrent(s, 'nope').state; // b unresolved

    const next = applyDrillResults(deck, s, NOW);
    assert.equal(next[0]!.due, NOW + DAY_MS, 'good walks the normal staircase: tomorrow');
    assert.equal(next[0]!.reps, 1);
    assert.equal(next[1]!.due, NOW + AGAIN_RETRY_MS, 'again returns within the sitting');
    assert.equal(next[1]!.lapses, 1);
    assert.equal(next[2], deck[2], 'a card the session never touched is untouched');
  });

  test('a typo grades the card good — the phrase was known', () => {
    const deck = [card('phrase:a')];
    const s = answerCurrent(sessionOf(typedEx('a-typ', 'phrase:a')), 'bonjout').state;
    assert.equal(applyDrillResults(deck, s, NOW)[0]!.reps, 1);
  });

  test('when one phrase is drilled twice, the worse outcome speaks for it', () => {
    const winThenLose: DrillSessionState = {
      ...sessionOf(),
      finished: true,
      answered: [
        { id: 'e1', phraseKey: 'phrase:a', outcome: 'good', attempts: 1 },
        { id: 'e2', phraseKey: 'phrase:a', outcome: 'unresolved', attempts: 2 },
      ],
    };
    assert.deepEqual(summarise(winThenLose).grades, [{ phraseKey: 'phrase:a', grade: 'again' }]);

    const loseThenWin: DrillSessionState = {
      ...winThenLose,
      answered: [...winThenLose.answered].reverse(),
    };
    assert.deepEqual(summarise(loseThenWin).grades, [{ phraseKey: 'phrase:a', grade: 'again' }]);
  });
});

describe('summarise mid-session', () => {
  test('the total never wobbles as exercises re-queue', () => {
    let s = sessionOf(optionsEx('a-opt', 'phrase:a'), optionsEx('b-opt', 'phrase:b'));
    assert.equal(summarise(s).total, 2);
    s = answerCurrent(s, 'nope').state;
    assert.equal(summarise(s).total, 2, 'a re-queued exercise is pending, not extra');
  });
});

describe('a finished session absorbs stray answers', () => {
  test('answering after the end changes nothing and says nothing', () => {
    const done = answerCurrent(sessionOf(optionsEx('a-opt', 'phrase:a')), 'bonjour').state;
    const { state, feedback } = answerCurrent(done, 'bonjour');
    assert.equal(state, done);
    assert.equal(feedback, null);
  });
});

describe('the three feedback lines', () => {
  test('correct, slip, and miss each get their pinned line', () => {
    const ex = typedEx('a-typ', 'phrase:a');
    assert.equal(answerCurrent(sessionOf(ex), 'bonjour').feedback?.message, GOOD_FEEDBACK);
    assert.equal(answerCurrent(sessionOf(ex), 'bonjout').feedback?.message, typoFeedback('bonjour'));
    assert.equal(answerCurrent(sessionOf(ex), 'nope').feedback?.message, missFeedback('bonjour'));
  });
});

describe('new material — the first-open problem', () => {
  test('an empty deck still yields a session: fixtures introduce themselves at the easiest stage', () => {
    const state = buildDrillSession([], DRILL_FIXTURES, NOW);
    assert.equal(state.finished, false);
    assert.ok(state.queue.length > 0 && state.queue.length <= NEW_PHRASES_PER_SESSION);
    for (const exercise of state.queue) {
      // The easiest form the bank HAS for that phrase: a never-met phrase gets
      // all the scaffolding that exists for it, and never a harder form.
      const stages = DRILL_FIXTURES.filter((e) => e.phraseKey === exercise.phraseKey).map((e) => stageOf(e));
      const easiest = [...stages].sort((a, b) => DRILL_STAGES.indexOf(a) - DRILL_STAGES.indexOf(b))[0]!;
      assert.equal(stageOf(exercise), easiest, `a new phrase starts at the easiest available stage (${exercise.phraseKey})`);
    }
    const keys = state.queue.map((e) => e.phraseKey);
    assert.equal(new Set(keys).size, keys.length, 'one introduction per phrase, never two formats at once');
  });

  test('a real review load leaves no room for introductions', () => {
    const deck = DRILL_FIXTURES.slice(0, NEW_PHRASES_PER_SESSION + 2).map((e, i) =>
      newCard({ id: e.phraseKey, kind: 'vocab', front: `p${i}`, back: 'x', context: '', ipa: '' }, NOW - 1),
    );
    const state = buildDrillSession(deck, DRILL_FIXTURES, NOW);
    const known = new Set(deck.map((c) => c.id));
    assert.ok(state.queue.length > 0);
    for (const exercise of state.queue) {
      assert.ok(known.has(exercise.phraseKey), 'maintenance owns the session once the deck is real');
    }
  });
});

describe('a sitting scoped to one path node', () => {
  const NOW = new Date(2026, 0, 15, 12).getTime();
  const DAY = 86_400_000;
  const mk = (id: string, due: number): ReviewCard => ({
    id, kind: 'turn', front: id, back: id, context: '', ipa: '',
    addedAt: NOW - 30 * DAY, due, reps: 2, ease: 2.5, intervalDays: 3, lapses: 0,
  });

  test('only the node’s own phrases play', () => {
    const only = ['phrase:merci beaucoup'];
    const deck = [mk('phrase:merci beaucoup', NOW - DAY), mk('phrase:santé !', NOW - DAY)];
    const session = buildDrillSession(deck, DRILL_FIXTURES, NOW, { only });
    assert.ok(session.queue.length > 0);
    assert.ok(session.queue.every((e) => only.includes(e.phraseKey)));
  });

  test('a node’s due phrase survives a deck full of unrelated overdue cards', () => {
    // The bug the deck-before-dueCards ordering prevents: DUE_CAP is applied
    // overdue-first across the whole deck, so filtering afterwards would let
    // twenty strangers crowd out the one phrase the learner tapped.
    const flood = Array.from({ length: 40 }, (_, i) => mk(`phrase:other-${i}`, NOW - (100 + i) * DAY));
    const deck = [...flood, mk('phrase:merci beaucoup', NOW - DAY)];
    const session = buildDrillSession(deck, DRILL_FIXTURES, NOW, { only: ['phrase:merci beaucoup'] });
    assert.ok(session.queue.some((e) => e.phraseKey === 'phrase:merci beaucoup'));
  });

  test('omitting the option leaves every existing call unchanged', () => {
    const deck = [mk('phrase:merci beaucoup', NOW - DAY), mk('phrase:santé !', NOW - DAY)];
    const before = buildDrillSession(deck, DRILL_FIXTURES, NOW);
    const after = buildDrillSession(deck, DRILL_FIXTURES, NOW, {});
    assert.deepEqual(after.queue.map((e) => e.id), before.queue.map((e) => e.id));
  });
});
