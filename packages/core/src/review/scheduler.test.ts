import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { applyGrade, dueCards, firstReturn, mergeCards, newCard, AGAIN_RETRY_MS, DEFAULT_EASE, DUE_CAP, MIN_EASE, type ReviewCard } from './scheduler.ts';
import { isSettled, presentationOf } from './evidence.ts';
import { mergeDecks } from './merge.ts';

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

describe('firstReturn — the delayed test, named', () => {
  test('a card back from its first one-day interval is a first return and nothing else is', () => {
    // The substrate was always there: the graduation staircase sends a first
    // success out exactly one day. What was missing was a name for the card
    // that comes back, so a screen can say what it is without re-deriving it
    // from two fields and getting a different answer than the next screen.
    const firstSuccess = applyGrade(card(), 'good', NOW);
    assert.equal(firstSuccess.intervalDays, 1, 'the substrate this reads: a first success is already scheduled for tomorrow');
    assert.equal(firstReturn(firstSuccess, NOW + DAY_MS), true, 'a day later that card is the first thing in the deck that survived a night');

    // Not yet due is not a return. Looking at the deck tonight is a look.
    assert.equal(firstReturn(firstSuccess, NOW + DAY_MS - 1), false, 'a card seen before its due date has not come back yet, so nothing was tested');

    // "Easy" strides two days, so it is never this card. Claiming a one-day
    // memory of a two-day gap would be a false claim about the same evidence.
    const easyFirst = applyGrade(card(), 'easy', NOW);
    assert.equal(easyFirst.intervalDays, 2, 'easy takes a longer stride even on the graduation step');
    assert.equal(firstReturn(easyFirst, NOW + 2 * DAY_MS), false, 'a two-day gap is a different test, and this predicate names only the one-day one');

    // A second success strides three days, and is a second return regardless.
    const secondSuccess = applyGrade(firstSuccess, 'good', NOW + DAY_MS);
    assert.equal(secondSuccess.reps, 2);
    assert.equal(firstReturn(secondSuccess, NOW + 4 * DAY_MS), false, 'the weekend test is not the first one');

    // A relearned lapse lands back on a one-day interval, but its reps say it
    // has been right before: its own first return happened weeks ago.
    const relearned = applyGrade(card({ reps: 4, intervalDays: 0, lapses: 1 }), 'good', NOW);
    assert.equal(relearned.intervalDays, 1, 'relearning graduates back to tomorrow, which is why reps and not the interval does the excluding');
    assert.equal(relearned.reps, 5);
    assert.equal(firstReturn(relearned, NOW + DAY_MS), false, 'a fifth success rescheduled to tomorrow is not a first anything');

    // A sound is copied, never produced from a prompt, so it is never a test.
    const sound = applyGrade(card({ kind: 'phoneme' }), 'good', NOW);
    assert.equal(sound.intervalDays, 1);
    assert.equal(sound.reps, 1);
    assert.equal(firstReturn(sound, NOW + DAY_MS), false, 'a phoneme card is a listening exercise on any day, and listening again proves no recall');
  });

  test('a card missed before it was ever right still has a first return', () => {
    // "Again" leaves reps at zero, so the "good" that follows is genuinely this
    // card's first success and lands on the same one-day interval as any other.
    // Lapses are deliberately not part of the predicate: the claim is that a
    // memory is a day old, not that the learner's record of it is clean.
    const missedThenLearned = applyGrade(applyGrade(card(), 'again', NOW), 'good', NOW);
    assert.equal(missedThenLearned.reps, 1);
    assert.equal(missedThenLearned.intervalDays, 1);
    assert.equal(missedThenLearned.lapses, 1, 'the miss is still on the record, and still not what this predicate reads');
    assert.equal(firstReturn(missedThenLearned, NOW + DAY_MS), true, 'a first success is a first success whether or not it was missed first');
  });

  test('everything it names is a card presentationOf would ask for', () => {
    // The sound rule is inherited from `presentationOf`, never copied. Two
    // copies is how a deck starts demanding a phoneme on one screen while
    // treating it as listening on another, and both screens sound certain.
    const clock = NOW + DAY_MS;
    const deck = [
      applyGrade(card({ id: 'vocab' }), 'good', NOW),
      applyGrade(card({ id: 'sound', kind: 'phoneme' }), 'good', NOW),
      applyGrade(card({ id: 'turn', kind: 'turn' }), 'good', NOW),
      applyGrade(card({ id: 'easy' }), 'easy', NOW),
      applyGrade(card({ id: 'relearned', reps: 4, intervalDays: 0, lapses: 1 }), 'good', NOW),
      card({ id: 'new' }),
    ];
    for (const c of deck) {
      if (!firstReturn(c, clock)) continue;
      assert.equal(presentationOf(c, clock), 'retrieval', `${c.id} was named a first return, so the deck must ask for it before revealing it`);
    }
    assert.deepEqual(
      deck.filter((c) => firstReturn(c, clock)).map((c) => c.id),
      ['vocab', 'turn'],
      'spoken and written cards return the same way; a sound never does',
    );
  });
});

describe('settledAt — the one transition the counters cannot recover', () => {
  test('a card records the grade that settled it, once, and forgets it on a lapse — F397', () => {
    // `isSettled` reads due, reps and intervalDays, so it can always say
    // whether a card is settled right now. What it can never say is when that
    // became true, because none of those three fields remembers a moment. A
    // count of "phrases retained this week" needs the moment, so the moment is
    // recorded at the grade that produced it and nowhere else.
    const fresh = card();
    assert.equal(fresh.settledAt, undefined, 'a card nobody has reviewed has settled nothing, so there is no date to hold');

    const first = applyGrade(fresh, 'good', NOW);
    assert.equal(isSettled(first, NOW), false, 'one success on a one-day interval is not a settled memory');
    assert.equal(first.settledAt, undefined, 'nothing settled, so nothing was dated');

    const second = applyGrade(first, 'good', NOW + DAY_MS);
    assert.equal(second.intervalDays, 3, 'the second success walks to three days, which is still short of settled');
    assert.equal(second.settledAt, undefined, 'the second success is still not the transition');

    // The third success multiplies by ease and clears the settled threshold.
    const settledNow = NOW + 4 * DAY_MS;
    const third = applyGrade(second, 'good', settledNow);
    assert.equal(isSettled(third, settledNow), true, 'the substrate this reads: reps and interval have both crossed the settled line');
    assert.equal(third.settledAt, settledNow, 'the grade that settled the card is the moment recorded, not the moment anyone later asked');

    // Once set it is left alone. The claim is when this memory first held, and
    // a later confirmation is not a new first.
    const fourth = applyGrade(third, 'good', settledNow + 8 * DAY_MS);
    assert.equal(isSettled(fourth, settledNow + 8 * DAY_MS), true, 'still settled, and still the same memory');
    assert.equal(fourth.settledAt, settledNow, 'a settled card was re-dated by a later review, so any weekly count would count it twice');

    const early = applyGrade(fourth, 'easy', settledNow + 9 * DAY_MS);
    assert.equal(early.settledAt, settledNow, 'an easy grade on an already settled card is not a new transition either');

    // A lapse un-settles the card, and the date goes with it. The key is
    // dropped rather than blanked, because `mergeDecks` renders a card's keys
    // to break its last tie and two spellings of absent must not differ.
    const lapsed = applyGrade(early, 'again', settledNow + 20 * DAY_MS);
    assert.equal(isSettled(lapsed, settledNow + 20 * DAY_MS), false, 'a forgotten phrase is not a settled one');
    assert.equal(lapsed.settledAt, undefined, 'a lapsed card kept the date it settled on, and would still be counted as retained');
    assert.equal('settledAt' in lapsed, false, 'absent must be spelled one way, or two devices holding the same card compare as different cards');

    // And it can settle again, on the later date, because the second time is a
    // real second transition rather than a repeat of the first.
    const relearnFrom = settledNow + 21 * DAY_MS;
    let climbing = lapsed;
    for (const step of [1, 2, 3]) {
      climbing = applyGrade(climbing, 'good', relearnFrom + step * DAY_MS);
      assert.equal(climbing.settledAt, undefined, `success ${step} of the climb back is still short of the settled line, so there is nothing to date yet`);
    }
    const resettledAt = relearnFrom + 4 * DAY_MS;
    const resettled = applyGrade(climbing, 'good', resettledAt);
    assert.equal(isSettled(resettled, resettledAt), true, 'the relearned card has crossed the line again');
    assert.equal(resettled.settledAt, resettledAt, 'a phrase that was lost and learned again settled on the second date, and may be counted then');

    // A deck written before this field exists reads back exactly as it was.
    // The card below is already settled and has no date, which is the honest
    // state for "settled at a moment nobody recorded": stamping it with today
    // would report a year-old memory as this week's retention.
    const old: ReviewCard = {
      id: 'vocab:merci',
      kind: 'vocab',
      front: 'merci',
      back: 'Merci = Thank you',
      context: 'Merci = Thank you',
      ipa: 'mɛʁ.si',
      addedAt: NOW - 400 * DAY_MS,
      due: NOW + 30 * DAY_MS,
      intervalDays: 40,
      ease: 2.5,
      reps: 6,
      lapses: 1,
    };
    assert.equal(isSettled(old, NOW), true, 'the card this is about: settled long before the field existed');
    assert.equal('settledAt' in old, false, 'the shape a deck on disk actually has');
    const graded = applyGrade(old, 'good', NOW);
    assert.equal('settledAt' in graded, false, 'an old settled card was stamped with today, which would date a year-old memory to this week');
    assert.deepEqual(
      mergeDecks([old], []),
      [old],
      'a deck written before this field must survive a sync fold byte for byte',
    );

    // The merge carries the date with the card it belongs to. It never blends:
    // a settled date belongs to one device's scheduling history, and the copy
    // with more grades behind it is the copy that keeps its whole card.
    const other: ReviewCard = { ...third, id: 'vocab:bonjour' };
    const behindOnGrades: ReviewCard = { ...second, id: 'vocab:bonjour' };
    const [merged] = mergeDecks([behindOnGrades], [other]);
    assert.equal(merged?.settledAt, settledNow, 'the winning copy lost the date that came with it');
    const [alone] = mergeDecks([], [other]);
    assert.equal(alone?.settledAt, settledNow, 'a card only one device has seen must keep its date across the fold');
    assert.deepEqual(mergeDecks([other], [other]), [other], 'merging a settled card with itself must not move its date');
  });
});

describe('an assisted good — right only after a miss', () => {
  const grown = card({ reps: 3, intervalDays: 8 });

  test('an assisted good comes back the next day with ease unchanged', () => {
    const next = applyGrade(grown, 'good', NOW, { assisted: true });
    assert.equal(next.due, NOW + DAY_MS);
    assert.equal(next.intervalDays, 1);
    assert.equal(next.ease, grown.ease);
    assert.equal(next.reps, 3, 'the next sitting asks at the same stage');
  });

  test('an assisted good earns no evidence, even when marked transfer', () => {
    const next = applyGrade(grown, 'good', NOW, { assisted: true, transfer: true });
    assert.equal(next.evidence, undefined);
  });

  test('a first-try good keeps today\'s interval', () => {
    const next = applyGrade(grown, 'good', NOW);
    assert.equal(next.intervalDays, 20);
    assert.equal(next.reps, 4);
  });
});
