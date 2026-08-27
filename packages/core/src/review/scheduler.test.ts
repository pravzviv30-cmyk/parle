import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { applyGrade, dueCards, mergeCards, newCard, AGAIN_RETRY_MS, DEFAULT_EASE, DUE_CAP, MIN_EASE, type ReviewCard } from './scheduler.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

/** A fresh vocab card, due immediately, with optional scheduling overrides. */
function card(overrides: Partial<ReviewCard> = {}): ReviewCard {
  return {
    ...newCard({ id: 'vocab:bonjour', kind: 'vocab', front: 'bonjour', back: 'Bonjour = Hello', context: 'Bonjour = Hello', ipa: 'bɔ̃.ʒuʁ' }, NOW),
    ...overrides,
  };
}

describe('a new card', () => {
  test('is due immediately — the best first meeting is right after the session that earned it', () => {
    const c = card();
    assert.equal(c.due, NOW);
    assert.equal(c.addedAt, NOW);
    assert.equal(c.intervalDays, 0);
    assert.equal(c.ease, DEFAULT_EASE);
    assert.equal(c.reps, 0);
    assert.equal(c.lapses, 0);
  });
});

describe('interval growth under repeated "good"', () => {
  test('walks the 1 day, 3 days, then multiply-by-ease staircase', () => {
    // The classical shape: quick early checks while the memory is fragile,
    // then exponentially rarer ones as it proves solid.
    let c = card();
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      c = applyGrade(c, 'good', NOW);
      intervals.push(c.intervalDays);
    }
    // 1, 3, round(3 x 2.5) = 8, round(8 x 2.5) = 20.
    assert.deepEqual(intervals, [1, 3, 8, 20]);
    assert.equal(c.reps, 4);
    assert.equal(c.due, NOW + 20 * DAY_MS);
  });

  test('"good" alone never touches ease — steady performance keeps a steady slope', () => {
    let c = card();
    for (let i = 0; i < 5; i++) c = applyGrade(c, 'good', NOW);
    assert.equal(c.ease, DEFAULT_EASE);
  });

  test('a relearned card graduates back to a full day, not to right now', () => {
    // After a lapse the interval is 0 but reps stay high, so the staircase is
    // exhausted. Without a floor, 0 x ease would schedule it immediately forever.
    const lapsed = card({ intervalDays: 0, reps: 4, lapses: 1 });
    const relearned = applyGrade(lapsed, 'good', NOW);
    assert.equal(relearned.intervalDays, 1);
    assert.equal(relearned.due, NOW + DAY_MS);
  });
});

describe('"again" — forgetting is rescheduling, not failing', () => {
  test('brings the card back within the sitting and restarts its climb', () => {
    const mature = card({ intervalDays: 8, reps: 3 });
    const missed = applyGrade(mature, 'again', NOW);
    assert.equal(missed.due, NOW + AGAIN_RETRY_MS, 'a missed card returns in minutes, while the correction is fresh');
    assert.equal(missed.intervalDays, 0);
    assert.equal(missed.lapses, 1);
    assert.equal(missed.reps, 3, 'past successes are history, not something a miss erases');
  });

  test('gently flattens the growth slope', () => {
    const missed = applyGrade(card(), 'again', NOW);
    assert.equal(missed.ease, 2.35);
  });

  test('ease is floored so a hard card cannot dig itself a hole', () => {
    // Below the floor, intervals stop growing and the card returns daily
    // forever — the learner experiences that as being nagged about their
    // weakest word, which is the opposite of what this deck is for.
    let c = card();
    for (let i = 0; i < 20; i++) c = applyGrade(c, 'again', NOW);
    assert.equal(c.ease, MIN_EASE);
    assert.equal(c.lapses, 20);
  });
});

describe('"easy" — confidence is rewarded with distance', () => {
  test('schedules further out than "good" would have', () => {
    const settled = card({ intervalDays: 3, reps: 2 });
    const good = applyGrade(settled, 'good', NOW);
    const easy = applyGrade(settled, 'easy', NOW);
    assert.ok(easy.intervalDays > good.intervalDays, `easy (${easy.intervalDays}d) should outpace good (${good.intervalDays}d)`);
    // round(3 x 2.5 x 1.3) = 10 days.
    assert.equal(easy.intervalDays, 10);
  });

  test('steepens the slope for next time', () => {
    const easy = applyGrade(card(), 'easy', NOW);
    assert.equal(easy.ease, 2.6);
    assert.equal(easy.reps, 1);
  });

  test('a brand-new card graded easy skips past tomorrow', () => {
    // "easy" strides the same staircase as "good", one step longer: good says
    // 1 day, so easy must say more than 1.
    const easy = applyGrade(card(), 'easy', NOW);
    assert.equal(easy.intervalDays, 2);
    assert.equal(easy.due, NOW + 2 * DAY_MS);
  });

  test('easy still outpaces good on a relearning card — the lapse inversion', () => {
    // A lapsed card (reps intact, interval reset to 0) once scheduled "easy"
    // SOONER than "good": easy multiplied the zeroed interval while good took
    // the graduation staircase. Confidence must never be punished.
    const lapsed = card({ reps: 1, intervalDays: 0 });
    const good = applyGrade(lapsed, 'good', NOW);
    const easy = applyGrade(lapsed, 'easy', NOW);
    assert.equal(good.intervalDays, 3);
    assert.ok(easy.intervalDays > good.intervalDays, `easy (${easy.intervalDays}d) must outpace good (${good.intervalDays}d)`);
  });
});

describe('what a grade was earned with', () => {
  /** Everything a grade schedules. The context may never move any of it. */
  function scheduleOf(c: ReviewCard) {
    return { due: c.due, intervalDays: c.intervalDays, ease: c.ease, reps: c.reps, lapses: c.lapses };
  }

  test('a graded retrieval attempt raises recall evidence on its card', () => {
    // The review screen asks for the French before it shows the French. A good
    // grade that followed that attempt is the one thing in the app that proves
    // the learner produced the phrase unaided, so it is the one thing that
    // raises recall evidence.
    const typed = applyGrade(card(), 'good', NOW, { attempt: 'typed' });
    assert.equal(typed.evidence?.retrievals, 1);
    const said = applyGrade(typed, 'easy', NOW, { attempt: 'said' });
    assert.equal(said.evidence?.retrievals, 2, 'counters climb; they are not a flag');

    // Scheduling is untouched by the context. Rescheduling is a guess about a
    // memory and evidence is a record of something the learner did; a change
    // that lets one move the other has merged them.
    assert.deepEqual(scheduleOf(typed), scheduleOf(applyGrade(card(), 'good', NOW)));
    assert.deepEqual(scheduleOf(said), scheduleOf(applyGrade(typed, 'easy', NOW)));

    // No attempt, no claim. A card self-graded with its own back showing has
    // shown nothing, and must not be counted as if it had.
    assert.equal(applyGrade(card(), 'good', NOW).evidence, undefined);
    assert.equal(applyGrade(card(), 'easy', NOW, {}).evidence, undefined);

    // A lapse claims nothing either, however the learner produced it.
    assert.equal(applyGrade(typed, 'again', NOW, { attempt: 'said' }).evidence?.retrievals, 1);
  });

  test('a transfer-marked answer raises transfer evidence, and only that', () => {
    const moved = applyGrade(card(), 'good', NOW, { transfer: true });
    assert.equal(moved.evidence?.transfers, 1);
    assert.equal(moved.evidence?.retrievals, 0, 'a changed situation is not by itself a hidden answer');
    assert.deepEqual(scheduleOf(moved), scheduleOf(applyGrade(card(), 'good', NOW)));

    // Both at once is one of each, never two of either.
    const both = applyGrade(card(), 'easy', NOW, { attempt: 'said', transfer: true });
    assert.deepEqual(both.evidence, { retrievals: 1, convoUses: 0, transfers: 1 });
  });
});

describe('purity', () => {
  test('grading returns a new card and leaves the original untouched', () => {
    const before = card();
    const snapshot = { ...before };
    applyGrade(before, 'again', NOW);
    applyGrade(before, 'good', NOW);
    applyGrade(before, 'easy', NOW);
    applyGrade(before, 'good', NOW, { attempt: 'typed', transfer: true });
    assert.deepEqual(before, snapshot);
  });
});

describe('dueCards — one calm sitting, never a backlog wall', () => {
  test('returns only cards that are actually due', () => {
    const due = card({ id: 'a', due: NOW - DAY_MS });
    const later = card({ id: 'b', due: NOW + DAY_MS });
    assert.deepEqual(
      dueCards([later, due], NOW).map((c) => c.id),
      ['a'],
    );
  });

  test('longest-overdue first — those are the memories closest to fading', () => {
    const cards = [
      card({ id: 'fresh', due: NOW }),
      card({ id: 'oldest', due: NOW - 3 * DAY_MS }),
      card({ id: 'old', due: NOW - DAY_MS }),
    ];
    assert.deepEqual(
      dueCards(cards, NOW).map((c) => c.id),
      ['oldest', 'old', 'fresh'],
    );
  });

  test('caps the sitting even when a neglected deck has far more waiting', () => {
    // A learner returning after two weeks away must be greeted with a sitting,
    // not a wall of debt. The overflow simply waits, uncounted and unannounced.
    const backlog = Array.from({ length: DUE_CAP + 15 }, (_, i) => card({ id: `card-${i}`, due: NOW - i }));
    assert.equal(dueCards(backlog, NOW).length, DUE_CAP);
  });

  test('an explicit cap wins over the default', () => {
    const cards = Array.from({ length: 10 }, (_, i) => card({ id: `card-${i}` }));
    assert.equal(dueCards(cards, NOW, 5).length, 5);
  });
});

describe('mergeCards — a re-encountered word never loses its history', () => {
  test('an incoming duplicate keeps the existing scheduling', () => {
    // Saying "bonjour" again in session five must not reset a card the learner
    // has been reviewing since session one — that would discard real memory
    // data and re-show them a card they already know.
    const veteran = card({ intervalDays: 8, reps: 3, ease: 2.6, due: NOW + 8 * DAY_MS });
    const freshDuplicate = card();
    const merged = mergeCards([veteran], [freshDuplicate]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.intervalDays, 8);
    assert.equal(merged[0]!.reps, 3);
  });

  test('genuinely new cards are appended', () => {
    const merged = mergeCards([card({ id: 'vocab:bonjour' })], [card({ id: 'vocab:merci' })]);
    assert.deepEqual(
      merged.map((c) => c.id),
      ['vocab:bonjour', 'vocab:merci'],
    );
  });

  test('duplicates within the incoming batch itself collapse to one', () => {
    const merged = mergeCards([], [card({ id: 'vocab:merci' }), card({ id: 'vocab:merci' })]);
    assert.equal(merged.length, 1);
  });
});
