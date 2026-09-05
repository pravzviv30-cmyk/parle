/**
 * Daily momentum, and the three things it is still not allowed to become — F432.
 *
 * ## What changed, and what did not
 *
 * F396 built this block on a rule: absent at zero. A rail of empty marks is a
 * quota, a quota nobody has met is guilt wearing a different hat, so the whole
 * block was withheld until one of its counts was real, and the first test in
 * this file proved it by asserting three nulls.
 *
 * On 2026-09-05 the founder overturned that openly. The block is present from
 * the first day and worded as a start: a learner should meet the four things
 * this app will ever claim about their French before it can claim any of them,
 * with an invitation in each card rather than a nought. So the zero test now
 * proves presence and the wording instead of absence.
 *
 * The streak refusal is untouched, and it is what the rest of this file is
 * still about. Days active only ever rises, there is no chain, and there is no
 * field a loss could be written into. Those three are what F396 was really
 * defending; "absent at zero" was the fourth leg and the only one that went.
 *
 * The copy scan comes last because it is the one that catches a "keep it going"
 * line somebody adds in six months, and it now walks the start lines and all
 * three mastery bands as well.
 *
 * `now` is a constant in every test. Nothing here reads a clock, so every day
 * boundary below is the learner's own local midnight and can be walked across
 * on purpose.
 */

import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

import {
  applyGrade,
  newCard,
  presentationOf,
  raiseEvidenceTo,
  type PhraseEvidence,
  type ReviewCard,
  type ReviewCardKind,
} from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { DAILY_GOAL_UNSET, goalLine } from '../profile/dailyGoal.ts';
import { createStoredProfile, withDailyGoal, type StoredProfile } from '../profile/store.ts';
import type { ActivityEntry, ActivityKind } from './activity.ts';
import * as momentumModule from './momentum.ts';
import {
  DAYS_LABEL,
  DAYS_START,
  GOAL_MET,
  GOAL_START,
  GOAL_TITLE,
  GOAL_UNTIMED,
  MASTERY_EARLY,
  MASTERY_LABEL,
  MASTERY_LINES,
  MIN_REVIEWS_FOR_RECALL,
  MOMENTUM_WEEK_DAYS,
  RECALL_SETTLING,
  RECALL_STEADY,
  RETAINED_CHIPS,
  RETAINED_FOOT,
  RETAINED_LABEL,
  RETAINED_LINK,
  RETAINED_START,
  RETAINED_SUB,
  momentumFrom,
  type Momentum,
} from './momentum.ts';

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** A local-time moment, so the day boundaries under test are the learner's. */
const at = (y: number, m: number, d: number, h: number, min = 0): number => new Date(y, m - 1, d, h, min).getTime();

const NOW = at(2026, 9, 4, 14);

const entry = (when: number, kind: ActivityKind = 'convo', durationMs?: number): ActivityEntry => ({
  at: when,
  kind,
  xp: 10,
  ...(durationMs === undefined ? {} : { durationMs }),
});

/** A learner who has answered onboarding and never been asked about minutes. */
const noGoal = (): StoredProfile => createStoredProfile({ name: 'Amel', motivation: null }, NOW - 90 * DAY_MS);

/** The same learner, having asked for ten minutes a day. */
const tenMinuteGoal = (): StoredProfile => withDailyGoal(noGoal(), 10);

/**
 * One card, described by the only four things this module reads off it.
 *
 * `uses` goes through `raiseEvidenceTo` rather than being written by hand, so
 * every card here carries the shape core itself writes. Leaving `uses` out
 * leaves the evidence block off the card entirely, which is the shape of every
 * deck written before the counters existed and is a case rather than an edge.
 */
function cardOf(fields: {
  id: string;
  front?: string;
  uses?: number;
  addedAt?: number;
  kind?: ReviewCardKind;
  reps?: number;
  lapses?: number;
}): ReviewCard {
  const addedAt = fields.addedAt ?? NOW - 30 * DAY_MS;
  const base = newCard(
    {
      id: fields.id,
      kind: fields.kind ?? 'turn',
      front: fields.front ?? fields.id,
      back: 'in English',
      context: '',
      ipa: '',
    },
    addedAt,
  );
  const graded: ReviewCard = { ...base, reps: fields.reps ?? 0, lapses: fields.lapses ?? 0 };
  return fields.uses ? raiseEvidenceTo(graded, { convoUses: fields.uses }) : graded;
}

/** A deck described only by its grades, for the recall fold. */
function gradedDeck(grades: readonly (readonly [reps: number, lapses: number])[], kind: ReviewCardKind = 'turn'): ReviewCard[] {
  return grades.map(([reps, lapses], i) => cardOf({ id: `${kind}:${i}`, kind, reps, lapses }));
}

/** Every string anywhere in a momentum block, however deeply nested. */
function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(stringsIn);
  return [];
}

describe('the momentum block at zero — what a first run is shown', () => {
  test('a learner with no progress meets all four cards, worded as a start — F432', () => {
    const momentum = momentumFrom({ activity: [], deck: [], profile: noGoal(), now: NOW });

    // The overturn itself. F396 asserted three nulls here; the founder's rule
    // on 2026-09-05 is that all four parts always arrive and the emptiness is
    // carried by the words inside them.
    assert.deepEqual(
      Object.keys(momentum).sort(),
      ['days', 'goal', 'mastery', 'retained'],
      'the block is four cards, and a learner on their first run meets all four of them',
    );
    for (const [name, part] of Object.entries(momentum)) {
      assert.notEqual(part, null, `${name} is missing on a first run, and the block is present from the first day`);
    }

    // And the gate that used to withhold it is gone rather than merely unused.
    assert.equal(
      'hasMomentum' in momentumModule,
      false,
      'hasMomentum still exists, so a screen can still hide the whole block behind it',
    );

    // Days: no numeral, no nought, and a row of empty marks that names no target.
    assert.equal(momentum.days.count, null, 'a first run has no days behind it, and null is how a numeral is withheld');
    assert.equal(momentum.days.words, DAYS_START, 'where the count would be nought, the words point forwards instead');
    assert.equal(momentum.days.label, DAYS_LABEL, 'the tile names itself, and the screen never spells the words');
    assert.deepEqual(
      momentum.days.week,
      [false, false, false, false, false, false, false],
      'seven marks, none of them filled, and nothing beside them calling that a target',
    );

    // Retained: the hero card, with the invitation where the phrases go.
    assert.equal(momentum.retained.count, null, 'nobody has spoken a phrase yet, so there is no count to draw');
    assert.equal(momentum.retained.words, RETAINED_START, 'the hero says where the first phrases will land');
    assert.equal(momentum.retained.label, RETAINED_LABEL, 'the card names itself');
    assert.equal(momentum.retained.sub, RETAINED_SUB, 'and it says what kind of thing it collects');
    assert.deepEqual(momentum.retained.chips, [], 'no phrases means no chips, not two empty ones');
    assert.equal(momentum.retained.thisWeek, null, 'nothing arrived this week because nothing has arrived at all');
    assert.equal(momentum.retained.weekLine, null, 'and "+0 this week" would be a claim about a week that had nothing in it');
    assert.equal(momentum.retained.moreLine, null, 'there is nothing more to see');
    assert.equal(momentum.retained.foot, null, 'nothing above the footer to explain yet');
    assert.equal(momentum.retained.link, null, 'and no bank to send them to');

    // Mastery: withheld, and honest about why.
    assert.equal(momentum.mastery.asked, 0, 'an empty deck has asked nothing');
    assert.equal(momentum.mastery.right, 0, 'and got nothing right, which is not the same as getting things wrong');
    assert.equal(momentum.mastery.percent, null, 'a percentage of nothing is not a percentage');
    assert.equal(momentum.mastery.percentLabel, null, 'so there is no numeral beside the badge');
    assert.equal(momentum.mastery.words, MASTERY_EARLY, 'the tile says the figure is coming rather than showing a nought');
    assert.equal(momentum.mastery.line, null, 'and it bands nothing, because there is nothing to band');
    assert.equal(momentum.mastery.label, MASTERY_LABEL, 'the tile names itself');

    // Goal: a card, an ask, and no measurement of a promise nobody made.
    assert.equal(momentum.goal.target, null, 'nobody has chosen a daily promise');
    assert.equal(momentum.goal.amount, null, 'so there is no fraction to write');
    assert.equal(momentum.goal.percentLabel, null, 'and no percentage of a number that does not exist');
    assert.equal(momentum.goal.remaining, null, 'nothing is remaining of nothing');
    assert.equal(momentum.goal.minutes, 0, 'no minutes were spoken today, and the card says so in words rather than in digits');
    assert.equal(momentum.goal.percent, 0, 'an empty bar, which is what an unstarted day looks like');
    assert.equal(momentum.goal.title, GOAL_TITLE, 'the card names itself');
    assert.equal(
      momentum.goal.note,
      DAILY_GOAL_UNSET,
      'the card asks for a promise in the words the profile row already uses, rather than a second way to ask',
    );

    // Choosing a daily goal is not progress: it is a promise about the future.
    // It used to remove the card entirely. Now it fills the promise in and
    // still refuses to write "0 / 10", because a nought out of ten on the first
    // morning is the scoreboard this block exists to not be.
    const promised = momentumFrom({ activity: [], deck: [], profile: tenMinuteGoal(), now: NOW });
    assert.equal(promised.goal.target, 10, 'the promise the learner made is the promise the card carries');
    assert.equal(promised.goal.amount, '10 min', 'the promise alone, because "0 / 10 min" reads as a failure at breakfast');
    assert.equal(promised.goal.note, GOAL_START, 'and the footer says where the first minutes of the day will land');
    assert.equal(promised.goal.percent, 0, 'the bar is empty, and nothing beside it calls that a shortfall');
    assert.equal(promised.goal.percentLabel, null, 'no percentage until there is a fraction to state');
    assert.equal(promised.goal.remaining, 10, 'the whole promise is still ahead of them, which is what a morning is');
  });
});

describe('days active — a count that cannot become a streak', () => {
  test('days active only ever rises and a quiet day costs nothing — F396', () => {
    // Four sittings, three distinct days, with a five-day silence in the
    // middle. If this were a chain, the silence would have cost something.
    const activity = [
      entry(at(2026, 8, 24, 9)),
      entry(at(2026, 8, 24, 20)),
      entry(at(2026, 8, 29, 18)),
      entry(at(2026, 9, 4, 8)),
    ];
    const days = momentumFrom({ activity, deck: [], profile: noGoal(), now: NOW }).days;

    assert.equal(days.count, 3, 'three distinct local days carried an entry, and two sittings in one day are one day');

    // No chain. Days do not have to touch, and nothing here asks whether
    // yesterday had an entry.
    const inARow = [entry(at(2026, 9, 2, 9)), entry(at(2026, 9, 3, 9)), entry(at(2026, 9, 4, 9))];
    const consecutive = momentumFrom({ activity: inARow, deck: [], profile: noGoal(), now: NOW }).days;
    assert.equal(consecutive.count, days.count, 'three days in a row must be worth exactly what three scattered days are');

    // No loss state. The count is a set size over an append-only log, so time
    // passing can only ever leave it alone.
    let floor = 3;
    for (let ahead = 0; ahead <= 30; ahead += 1) {
      const later = momentumFrom({ activity, deck: [], profile: noGoal(), now: NOW + ahead * DAY_MS }).days;
      assert.notEqual(later.count, null, 'a month of silence must never delete days that were genuinely practised');
      assert.ok(later.count! >= floor, `day ${ahead} of quiet lowered the count from ${floor} to ${later.count}`);
      floor = later.count!;
    }
    assert.equal(floor, 3, 'thirty quiet days later it is still the same three days, neither more nor fewer');

    // And there is no field a loss could ever be written into. A "broken",
    // "atRisk" or "owed" key added here fails this line by name.
    assert.deepEqual(
      Object.keys(days).sort(),
      ['count', 'label', 'week', 'words'],
      'the days tile grew a field, and the only fields it may have are a count, a picture of the week and its words',
    );

    // The seven marks are a picture of the last seven days, ending today, and
    // the count is wider than the picture: the twenty-fourth is off the left of
    // the row and still counted.
    assert.equal(days.week.length, MOMENTUM_WEEK_DAYS, 'the tile draws seven marks, so seven booleans arrive');
    assert.deepEqual(
      days.week,
      [true, false, false, false, false, false, true],
      'the row runs from the twenty-ninth to today, oldest first, and the five quiet days between them stay empty',
    );
    assert.equal(days.week[MOMENTUM_WEEK_DAYS - 1], true, 'the last mark is today, and today had a sitting');
    assert.equal(days.count, 3, 'a day that has fallen off the left of the row is still a day this learner practised');

    // Oldest first, which is the order the tile draws the marks in. An
    // asymmetric week, because a palindrome cannot tell the two orders apart.
    const quiet = { activity: [entry(at(2026, 9, 3, 9))], deck: [], profile: noGoal(), now: NOW };
    const yesterdayOnly = momentumFrom(quiet).days;
    assert.deepEqual(
      yesterdayOnly.week,
      [false, false, false, false, false, true, false],
      'the row runs oldest to newest, so yesterday is the sixth mark and today, still quiet, is the seventh',
    );

    // At zero: count null, the start line, seven false marks, and still no
    // field a loss could be written into. The tile is present from the first
    // day now, and it writes no nought to be present.
    const empty = momentumFrom({ activity: [], deck: [], profile: noGoal(), now: NOW }).days;
    assert.equal(empty.count, null, 'a numeral is only drawn where there is a number, and here there is not one');
    assert.equal(empty.words, DAYS_START, 'so the words point at the first day rather than at an empty quota');
    assert.deepEqual(empty.week, Array(MOMENTUM_WEEK_DAYS).fill(false), 'seven marks, none filled, none of them owed');
    assert.deepEqual(
      Object.keys(empty).sort(),
      ['count', 'label', 'week', 'words'],
      'and the empty tile has exactly the fields the full one does, so no loss state can hide in the zero case',
    );
  });
});

describe('retained phrases — the ones that came out in conversation', () => {
  test('retained phrases are the ones used in conversation, with two chips, a more line and a week pill dated by arrival — F433', () => {
    const deck: ReviewCard[] = [
      // Four used in conversation, two of them arrived this week.
      cardOf({ id: 'vocab:cafe', front: 'un cafe', uses: 5, addedAt: NOW - 2 * DAY_MS }),
      cardOf({ id: 'vocab:addition', front: "l'addition", uses: 2, addedAt: NOW - 6 * DAY_MS }),
      cardOf({ id: 'vocab:bonjour', front: 'bonjour', uses: 1, addedAt: NOW - 40 * DAY_MS }),
      cardOf({ id: 'vocab:merci', front: 'merci beaucoup', uses: 1, addedAt: NOW - 90 * DAY_MS }),
      // Reviewed to the hilt and never once said out loud in a conversation.
      // Under the old rule this was the count; under this one it is not.
      cardOf({ id: 'vocab:jamais', front: 'jamais', reps: 9, addedAt: NOW - 60 * DAY_MS }),
      // A sound is not a phrase, however often it turns up.
      cardOf({ id: 'phoneme:u', front: 'u', kind: 'phoneme', uses: 12, addedAt: NOW - DAY_MS }),
    ];

    const retained = momentumFrom({ activity: [], deck, profile: noGoal(), now: NOW }).retained;
    assert.equal(retained.count, 4, 'four phrases came out in a real conversation, and neither the drilled card nor the sound did');
    assert.equal(retained.words, 'phrases spoken naturally', 'the hero says what the number is a number of');
    assert.equal(retained.foot, RETAINED_FOOT, 'and the footer says what earned them their place');
    assert.equal(retained.link, RETAINED_LINK, 'with the door to the bank underneath it');

    // Two chips, most used first, and the rest counted rather than listed.
    assert.deepEqual(
      retained.chips,
      ['un cafe', "l'addition"],
      'the hero shows the learner their own French, most used first, exactly as they said it',
    );
    assert.equal(retained.chips.length, RETAINED_CHIPS, 'two chips, which is what the card has room for');
    assert.equal(retained.moreLine, '+2 more', 'the other two are counted rather than crammed in');

    // The week pill is dated by arrival, which is exact for a phrase banked out
    // of a conversation and deliberately modest for one added long ago.
    assert.equal(retained.thisWeek, 2, 'two of the four arrived inside the last seven local days');
    assert.equal(retained.weekLine, '+2 this week', 'the mockup puts the weekly gain beside the numeral, in green');

    // Ties resolve the same way on every render: uses, then newest, then id.
    const tied = [
      cardOf({ id: 'vocab:b', front: 'beta', uses: 3, addedAt: NOW - 5 * DAY_MS }),
      cardOf({ id: 'vocab:a', front: 'alpha', uses: 3, addedAt: NOW - 5 * DAY_MS }),
      cardOf({ id: 'vocab:c', front: 'gamma', uses: 3, addedAt: NOW - DAY_MS }),
    ];
    assert.deepEqual(
      momentumFrom({ activity: [], deck: tied, profile: noGoal(), now: NOW }).retained.chips,
      ['gamma', 'alpha'],
      'level on uses the newer card wins, and level on both the id decides, so the hero never reshuffles itself',
    );
    assert.deepEqual(
      momentumFrom({ activity: [], deck: [...tied].reverse(), profile: noGoal(), now: NOW }).retained.chips,
      ['gamma', 'alpha'],
      'and the deck arriving in a different order must not change which two the learner sees',
    );

    // A deck with no evidence block at all, and one whose block came back off
    // the wire as null. Both read as zero uses, and neither may throw.
    const older = [
      cardOf({ id: 'vocab:bonjour', front: 'bonjour', reps: 4 }),
      { ...cardOf({ id: 'vocab:pain', front: 'pain' }), evidence: null as unknown as PhraseEvidence },
    ];
    const stale = momentumFrom({ activity: [], deck: older, profile: noGoal(), now: NOW }).retained;
    assert.equal(stale.count, null, 'a deck written before the counters existed reads as no uses yet, not as a crash');
    assert.equal(stale.words, RETAINED_START, 'so an established learner meets the start line until their next conversation');

    // One phrase: one chip, no more line, and the singular.
    const single = momentumFrom({
      activity: [],
      deck: [cardOf({ id: 'vocab:cafe', front: 'un cafe', uses: 1, addedAt: NOW - DAY_MS })],
      profile: noGoal(),
      now: NOW,
    }).retained;
    assert.equal(single.count, 1, 'one phrase used in conversation is one phrase');
    assert.deepEqual(single.chips, ['un cafe'], 'and it is on the card, not summarised');
    assert.equal(single.moreLine, null, 'nothing is left over, so nothing says there is');
    assert.equal(single.words, 'phrase spoken naturally', 'one phrase, not one phrases');

    // Exactly two: both drawn, and still no more line.
    const two = momentumFrom({
      activity: [],
      deck: [
        cardOf({ id: 'vocab:cafe', front: 'un cafe', uses: 2, addedAt: NOW - DAY_MS }),
        cardOf({ id: 'vocab:merci', front: 'merci beaucoup', uses: 1, addedAt: NOW - DAY_MS }),
      ],
      profile: noGoal(),
      now: NOW,
    }).retained;
    assert.deepEqual(two.chips, ['un cafe', 'merci beaucoup'], 'both phrases fit');
    assert.equal(two.moreLine, null, 'and "+0 more" would be the card counting its own emptiness');

    // Used months ago, arrived months ago: counted, and not this week's.
    const oldOnly = momentumFrom({
      activity: [],
      deck: [cardOf({ id: 'vocab:merci', front: 'merci beaucoup', uses: 4, addedAt: NOW - 200 * DAY_MS })],
      profile: noGoal(),
      now: NOW,
    }).retained;
    assert.equal(oldOnly.count, 1, 'a phrase used long ago is still a phrase this learner has used');
    assert.equal(oldOnly.thisWeek, null, 'it did not arrive this week, and "+0 this week" would claim we checked and found none');
    assert.equal(oldOnly.weekLine, null, 'nothing to say means no line, not an empty one');

    // The real pipeline, not just the factory: the fold the brain writes
    // through is `raiseEvidenceTo`, and one use is enough.
    const banked = raiseEvidenceTo(
      newCard({ id: 'vocab:voudrais', kind: 'turn', front: 'je voudrais', back: 'I would like', context: '', ipa: '' }, NOW - DAY_MS),
      { convoUses: 1 },
    );
    const fresh = momentumFrom({ activity: [], deck: [banked], profile: noGoal(), now: NOW }).retained;
    assert.equal(fresh.count, 1, 'a card the brain itself raised is a retained phrase, with no review needed first');
    assert.deepEqual(fresh.chips, ['je voudrais'], 'and the chip is the French exactly as the learner said it');
  });
});

describe('recall — right over asked, once the introduction is taken out', () => {
  test('mastery is right over asked across the deck, withheld under ten reviews, and banded in three warm lines — F434', () => {
    // The case this whole figure exists to get right, so it comes first.
    //
    // Ten brand-new cards, every one graded good on the day it arrived. Core
    // itself calls each of those an introduction: the answer was on the screen
    // when the learner pressed good, so nothing was recalled. Counting reps
    // against reps-plus-lapses would read that as a hundred per cent recall for
    // somebody who has never once produced a phrase from memory.
    const fresh = Array.from({ length: 10 }, (_, i) => cardOf({ id: `vocab:new${i}` }));
    for (const card of fresh) {
      assert.equal(presentationOf(card, NOW), 'introduction', 'core calls a card with no successes an introduction, not a test');
    }
    const firstSitting = momentumFrom({
      activity: [],
      deck: fresh.map((card) => ({ ...card, reps: 1 })),
      profile: noGoal(),
      now: NOW,
    }).mastery;
    assert.equal(
      firstSitting.percent,
      null,
      'ten introductions graded good is a hundred per cent of nothing, and a first morning must not read as perfect recall',
    );
    assert.equal(firstSitting.right, 0, 'the one guaranteed win per card is the introduction, and it is not a recall');
    assert.equal(firstSitting.asked, 0, 'so nothing has been asked of this learner yet, in the sense this figure means');
    assert.equal(firstSitting.percentLabel, null, 'and there is no numeral to put beside the badge');
    assert.equal(firstSitting.words, MASTERY_EARLY, 'the tile says the figure is coming, which is exactly the truth');

    // Right over asked, summed across the deck, with each card's first success
    // dropped and a never-succeeded card left out of both sums.
    const deck = [
      ...gradedDeck([
        [9, 1],
        [7, 3],
        [5, 2],
      ]),
      // Four "again"s and not one success: still being introduced, so neither
      // its lapses nor its absent wins say anything about recall yet.
      cardOf({ id: 'vocab:difficile', reps: 0, lapses: 4 }),
      // A sound is not a phrase, so its grades are not part of a phrase figure.
      cardOf({ id: 'phoneme:r', kind: 'phoneme', reps: 41, lapses: 0 }),
    ];
    const mastery = momentumFrom({ activity: [], deck, profile: noGoal(), now: NOW }).mastery;
    assert.equal(mastery.right, 18, 'eight, six and four recalls, once each card gives back the success that introduced it');
    assert.equal(mastery.asked, 24, 'and the six lapses on those same three cards are the times it was asked and did not come');
    assert.equal(mastery.percent, 75, 'eighteen of twenty four is seventy five per cent');
    assert.equal(mastery.percentLabel, '75%', 'the tile draws the numeral from here, never from a calculation of its own');
    assert.equal(mastery.words, 'of reviews', 'and it says what the fraction is of, rather than repeating the label above it');

    // The tile is called Recall, and it must never be called Mastery: core's
    // `isMastered` already means three unprompted uses in conversation, and My
    // French says so on the same learner's phrases.
    assert.equal(mastery.label, MASTERY_LABEL, 'the tile names itself');
    assert.equal(MASTERY_LABEL, 'Recall', 'a share of review grades is recall, and that is the word for it');
    assert.notEqual(
      MASTERY_LABEL,
      'Mastery',
      'core already means three unprompted conversation uses by that word, and Home must not answer it differently',
    );

    // Lapses never leave this module as a number of their own, and never per
    // card. A `lapses` key added here is a learner reading their own misses.
    assert.deepEqual(
      Object.keys(mastery).sort(),
      ['asked', 'label', 'line', 'percent', 'percentLabel', 'right', 'words'],
      'mastery grew a field, and the only counts allowed out of here are what was asked and what came back right',
    );

    // A card nobody has ever got right cannot drag the figure down, because it
    // is not in the fold at all.
    const alone = momentumFrom({ activity: [], deck: gradedDeck([[11, 0]]), profile: noGoal(), now: NOW }).mastery;
    const beside = momentumFrom({
      activity: [],
      deck: [...gradedDeck([[11, 0]]), cardOf({ id: 'vocab:hard', reps: 0, lapses: 5 })],
      profile: noGoal(),
      now: NOW,
    }).mastery;
    assert.equal(alone.percent, 100, 'ten recalls after the introduction, and not one miss');
    assert.deepEqual(
      [beside.right, beside.asked, beside.percent],
      [alone.right, alone.asked, alone.percent],
      'a phrase still being introduced must not be counted as ten failures to recall it',
    );

    // What this is honest about rather than exact about: a lapse taken before a
    // card's first success is still in the denominator, because nothing on the
    // card records the order. It can only push the figure down.
    const withEarlyLapses = momentumFrom({ activity: [], deck: gradedDeck([[11, 3]]), profile: noGoal(), now: NOW }).mastery;
    assert.ok(
      withEarlyLapses.percent! <= alone.percent!,
      'lapses we cannot date must only ever lower the figure, because being wrong modestly is the direction to be wrong in',
    );
    assert.equal(withEarlyLapses.percent, 76, 'ten of thirteen, floored');

    // Withheld under ten real reviews, because one "again" would move the
    // figure by ten points or more and the number would describe an afternoon.
    const nine = momentumFrom({ activity: [], deck: gradedDeck([[9, 1]]), profile: noGoal(), now: NOW }).mastery;
    assert.equal(nine.asked, MIN_REVIEWS_FOR_RECALL - 1, 'eight recalls and one miss is nine, one short of the floor');
    assert.equal(nine.percent, null, 'so the figure is withheld rather than shown at eighty eight per cent');
    assert.equal(nine.percentLabel, null, 'and there is no numeral beside the badge');
    assert.equal(nine.line, null, 'nor a line describing a figure nobody can see');
    assert.equal(nine.words, MASTERY_EARLY, 'the tile says the figure is coming, which is true and is not a nought');
    assert.equal(nine.right, 8, 'the counts themselves are still honest, and still reported');

    const ten = momentumFrom({ activity: [], deck: gradedDeck([[10, 1]]), profile: noGoal(), now: NOW }).mastery;
    assert.equal(ten.asked, MIN_REVIEWS_FOR_RECALL, 'nine recalls and one miss is the floor');
    assert.equal(ten.percent, 90, 'and at the floor the figure appears');

    // Floored, not rounded: the modest direction is the one to be wrong in.
    const nearly = momentumFrom({ activity: [], deck: gradedDeck([[16, 1]]), profile: noGoal(), now: NOW }).mastery;
    assert.equal(nearly.percent, 93, 'fifteen of sixteen is 93.75, and rounding it to 94 would be us flattering them');

    // A hundred means there was no lapse, not that there were few.
    const clean = momentumFrom({ activity: [], deck: gradedDeck([[13, 0]]), profile: noGoal(), now: NOW }).mastery;
    assert.equal(clean.percent, 100, 'twelve recalled out of twelve asked is all of them');
    const nearlyClean = momentumFrom({ activity: [], deck: gradedDeck([[100, 1]]), profile: noGoal(), now: NOW }).mastery;
    assert.equal(nearlyClean.percent, 99, 'ninety nine of a hundred floors to ninety nine, so a hundred stays earned');

    // Three bands, at their exact edges. `right + 1` because the card owes the
    // fold the success that introduced it.
    const bandAt = (right: number, lapses: number): string | null =>
      momentumFrom({ activity: [], deck: gradedDeck([[right + 1, lapses]]), profile: noGoal(), now: NOW }).mastery.line;
    assert.equal(bandAt(RECALL_STEADY, 100 - RECALL_STEADY), MASTERY_LINES.steady, 'ninety per cent is coming back easily');
    assert.equal(bandAt(RECALL_STEADY - 1, 100 - RECALL_STEADY + 1), MASTERY_LINES.settling, 'one point under, and it is settling in');
    assert.equal(bandAt(RECALL_SETTLING, 100 - RECALL_SETTLING), MASTERY_LINES.settling, 'seventy five is the bottom of settling in');
    assert.equal(bandAt(RECALL_SETTLING - 1, 100 - RECALL_SETTLING + 1), MASTERY_LINES.fresh, 'and one point under that is still fresh');

    // The known quirk, written down so nobody reads it as a bug: a wide deck
    // seen exactly once each has asked nothing yet, however busy the learner
    // has been, and the divide must be guarded rather than producing a NaN.
    const wideAndShallow = momentumFrom({
      activity: [],
      deck: gradedDeck(Array.from({ length: 60 }, () => [1, 0] as const)),
      profile: noGoal(),
      now: NOW,
    }).mastery;
    assert.equal(wideAndShallow.asked, 0, 'sixty introductions is sixty phrases met and none of them recalled yet');
    assert.equal(wideAndShallow.percent, null, 'nought over nought is not a percentage, and must never reach the screen as one');
    assert.equal(wideAndShallow.percentLabel, null, 'so there is no numeral, and certainly no "NaN%"');

    // The real pipeline: `again` is a lapse and `good` is a rep, and the first
    // `good` is the introduction this figure does not count.
    const card = newCard({ id: 'vocab:pain', kind: 'turn', front: 'pain', back: 'bread', context: '', ipa: '' }, NOW - 20 * DAY_MS);
    assert.equal(presentationOf(card, NOW - 20 * DAY_MS), 'introduction', 'the first meeting is a meeting, not a test');
    let graded = card;
    for (let i = 0; i < 10; i += 1) graded = applyGrade(graded, 'good', NOW - (19 - i) * DAY_MS);
    graded = applyGrade(graded, 'again', NOW - 2 * DAY_MS);
    assert.equal(graded.reps, 10, 'ten good grades are ten reps, and "again" does not take them away');
    assert.equal(graded.lapses, 1, 'and the one "again" is the one lapse');
    const scheduled = momentumFrom({ activity: [], deck: [graded], profile: noGoal(), now: NOW }).mastery;
    assert.equal(scheduled.right, 9, 'nine of those good grades were recalls; the first was the introduction');
    assert.equal(scheduled.asked, 10, 'so the deck asked ten times for a phrase this learner had already produced');
    assert.equal(scheduled.percent, 90, 'which is ninety per cent of it coming back');
  });
});

describe("today's speaking goal — present from day one, measured in speaking", () => {
  test("today's speaking goal is present from day one, carries the profile's own unset line, and counts only timed spoken sittings — F435", () => {
    const spokeSix = [entry(at(2026, 9, 4, 9), 'convo', 6 * MINUTE_MS)];

    // No promise: the card is still there, and it asks for one in the exact
    // words the profile row asks in. One sentence, one owner.
    const unpromised = momentumFrom({ activity: spokeSix, deck: [], profile: noGoal(), now: NOW }).goal;
    assert.equal(unpromised.target, null, 'nobody has chosen a daily promise, so there is no promise to measure them against');
    assert.equal(unpromised.note, DAILY_GOAL_UNSET, 'and the card asks for one rather than inventing a number on their behalf');
    assert.equal(
      goalLine(noGoal()),
      DAILY_GOAL_UNSET,
      'the profile row and this card must ask in the same words, which is why the constant is imported and not rewritten',
    );
    assert.equal(unpromised.amount, null, 'no promise means no fraction');
    assert.equal(unpromised.remaining, null, 'and nothing remaining of nothing');
    assert.equal(unpromised.percentLabel, null, 'and no percentage of a target that does not exist');
    assert.equal(unpromised.percent, 0, 'the bar stays empty, and the words beside it name no target');
    assert.equal(unpromised.minutes, 6, 'the six minutes still happened, and the card still knows it');

    const goal = momentumFrom({ activity: spokeSix, deck: [], profile: tenMinuteGoal(), now: NOW }).goal;
    assert.equal(goal.minutes, 6, 'six minutes of conversation is six minutes');
    assert.equal(goal.target, 10, 'the target is what the learner asked for, never what we would prefer');
    assert.equal(goal.remaining, 4, 'four minutes are left of the ten');
    assert.equal(goal.percent, 60, 'the bar is six of ten');
    assert.equal(goal.title, GOAL_TITLE, 'the card names itself, and the screen never spells the words');
    assert.equal(goal.amount, '6 / 10 min', 'the mockup right-aligns the two numerals and the unit');
    assert.equal(goal.note, '4 more minutes to reach daily cadence', 'the footer says what is left, without asking for it');
    assert.equal(goal.percentLabel, '60%', 'and the right of the footer carries the same fraction as a percentage');

    // Every spoken path has a quiet twin, so a lesson and a drill are worth the
    // same minute a conversation is.
    const mixed = [
      entry(at(2026, 9, 4, 8), 'lesson', 3 * MINUTE_MS),
      entry(at(2026, 9, 4, 12), 'drill', 2 * MINUTE_MS),
      entry(at(2026, 9, 4, 13), 'convo', 1 * MINUTE_MS),
    ];
    assert.equal(
      momentumFrom({ activity: mixed, deck: [], profile: tenMinuteGoal(), now: NOW }).goal.minutes,
      6,
      'a lesson and a drill produce French out loud or on the keys, and both count towards a speaking goal',
    );

    // Review is recall, not speaking, and this card is named for speaking.
    const reviewOnly = [entry(at(2026, 9, 4, 9), 'review', 25 * MINUTE_MS)];
    const reviewed = momentumFrom({ activity: reviewOnly, deck: [], profile: tenMinuteGoal(), now: NOW }).goal;
    assert.equal(reviewed.minutes, 0, 'twenty five minutes of card review must never fill a bar labelled speaking');
    assert.equal(reviewed.note, GOAL_START, 'and the card says where the first spoken minutes will land');
    assert.equal(reviewed.amount, '10 min', 'the promise on its own, because "0 / 10 min" reads as a failure');
    assert.equal(reviewed.percentLabel, null, 'and no percentage until there is a fraction to state');

    // Sittings recorded before `durationMs` existed measured nothing, and
    // nothing is not zero minutes of speaking. The footer says so rather than
    // reading a real conversation back to the learner as a nought.
    const unmeasured = [entry(at(2026, 9, 4, 9), 'convo'), entry(at(2026, 9, 4, 11), 'lesson')];
    const untimed = momentumFrom({ activity: unmeasured, deck: [], profile: tenMinuteGoal(), now: NOW }).goal;
    assert.equal(untimed.minutes, 0, 'a sitting that took ten minutes and did not record it is not a ten minute claim');
    assert.equal(untimed.note, GOAL_UNTIMED, 'so the card explains the empty bar instead of letting it accuse them');
    assert.equal(untimed.percent, 0, 'and invents no minutes to fill it with');

    // Untimed only applies to speaking. An untimed review leaves the ordinary
    // invitation in place.
    const untimedReview = [entry(at(2026, 9, 4, 9), 'review')];
    assert.equal(
      momentumFrom({ activity: untimedReview, deck: [], profile: tenMinuteGoal(), now: NOW }).goal.note,
      GOAL_START,
      'a review is not a spoken sitting, so nothing about it explains an empty speaking bar',
    );

    // Yesterday's minutes are yesterday's.
    const yesterday = [entry(at(2026, 9, 3, 21), 'convo', 20 * MINUTE_MS)];
    const carried = momentumFrom({ activity: yesterday, deck: [], profile: tenMinuteGoal(), now: NOW }).goal;
    assert.equal(carried.minutes, 0, 'a goal card that carried yesterday over would be a card nobody can ever finish');
    assert.equal(carried.note, GOAL_START, 'today is its own day, and it starts as one');

    // Under a minute is floored, because the direction to be wrong in is the
    // modest one. It was timed, so it is a start rather than an untimed sitting.
    const seconds = [entry(at(2026, 9, 4, 9), 'convo', 59_000)];
    const partial = momentumFrom({ activity: seconds, deck: [], profile: tenMinuteGoal(), now: NOW }).goal;
    assert.equal(partial.minutes, 0, 'under a whole minute is not a whole minute');
    assert.equal(partial.note, GOAL_START, 'and it was timed, so the untimed line would be a lie about what happened');

    // One timed sitting beside an untimed one: the minutes we have are the
    // minutes shown, and the footer counts down rather than apologising.
    const both = [entry(at(2026, 9, 4, 9), 'convo'), entry(at(2026, 9, 4, 11), 'convo', 9 * MINUTE_MS)];
    const partly = momentumFrom({ activity: both, deck: [], profile: tenMinuteGoal(), now: NOW }).goal;
    assert.equal(partly.minutes, 9, 'the nine we measured are the nine we claim');
    assert.equal(partly.note, '1 more minute to reach daily cadence', 'one minute left is one minute, and a stray s reads as careless');

    // Past the goal, the bar cannot overflow and the footer turns warm.
    const over = [entry(at(2026, 9, 4, 9), 'convo', 22 * MINUTE_MS)];
    const met = momentumFrom({ activity: over, deck: [], profile: tenMinuteGoal(), now: NOW }).goal;
    assert.equal(met.minutes, 22, 'the minutes are what happened, even past the promise');
    assert.equal(met.remaining, 0, 'nothing is left to ask for');
    assert.equal(met.percent, 100, 'the bar clamps rather than running off the card');
    assert.equal(met.percentLabel, '100%', 'and so does the figure beside it');
    assert.equal(met.note, GOAL_MET, 'a met goal is met, and the footer stops counting down');
  });
});

describe('momentum copy — the words this block is not allowed to say', () => {
  test('momentum copy has no streak, no debt and no dash — F396', () => {
    // The banned list is substring matched, which is deliberate and is the
    // reason this test reads every string rather than the ones somebody
    // remembered to check. The cost is real: ordinary words trip it.
    assert.equal(guiltIn('breakfast at the cafe'), 'break', 'the matcher is substring, so "breakfast" is a banned word here');
    assert.equal(guiltIn('a lower percentage'), 'owe', '"lower" contains "owe", which is why this copy avoids it');
    assert.equal(guiltIn('closer to the goal'), 'lose', 'and "closer" contains "lose"');
    assert.equal(guiltIn('4 more minutes to reach daily cadence'), undefined, 'the line the block actually ships is clean');

    const profile = tenMinuteGoal();
    const lines: string[] = [
      DAYS_LABEL,
      DAYS_START,
      RETAINED_LABEL,
      RETAINED_SUB,
      RETAINED_START,
      RETAINED_FOOT,
      RETAINED_LINK,
      MASTERY_LABEL,
      MASTERY_EARLY,
      MASTERY_LINES.steady,
      MASTERY_LINES.settling,
      MASTERY_LINES.fresh,
      GOAL_TITLE,
      GOAL_MET,
      GOAL_START,
      GOAL_UNTIMED,
      DAILY_GOAL_UNSET,
    ];

    // The whole zero state, which is now shipped copy rather than an absence.
    lines.push(...stringsIn(momentumFrom({ activity: [], deck: [], profile: null, now: NOW })));
    lines.push(...stringsIn(momentumFrom({ activity: [], deck: [], profile, now: NOW })));
    // And the untimed footer, which only appears on a day with a spoken sitting
    // that measured nothing.
    lines.push(...stringsIn(momentumFrom({ activity: [entry(at(2026, 9, 4, 9), 'convo')], deck: [], profile, now: NOW })));

    // A deck sitting in each of the three mastery bands, so no band line can
    // ship unread by this scan.
    const banded: string[] = [];
    for (const [right, lapses] of [
      [95, 5],
      [80, 20],
      [50, 50],
    ] as const) {
      const at3 = momentumFrom({ activity: [], deck: gradedDeck([[right, lapses]]), profile, now: NOW });
      assert.notEqual(at3.mastery.line, null, `a deck at ${right} per cent must say something about itself`);
      banded.push(at3.mastery.line!);
      lines.push(...stringsIn(at3));
    }
    assert.deepEqual(
      banded,
      [MASTERY_LINES.steady, MASTERY_LINES.settling, MASTERY_LINES.fresh],
      'the three bands must actually be reachable, or this scan is walking one line three times',
    );

    // Several counts, including the two that break naive copy: nothing at all,
    // and exactly one of everything. The chips carry the learner's own French,
    // so these fronts are deliberately plain: a failure here must mean our copy
    // went wrong, not that a French word happens to contain "lose".
    const french = [
      'un cafe',
      "l'addition",
      'je voudrais',
      'bonjour',
      'merci beaucoup',
      'pain',
      "s'il vous plait",
      'je ne sais pas',
      "d'accord",
      'a bientot',
    ];
    for (const count of [0, 1, 2, 3, 4, 7, 9, 10, 11, 22]) {
      const activity: ActivityEntry[] = [];
      for (let i = 0; i < count; i += 1) activity.push(entry(at(2026, 8, 24, 9) + i * DAY_MS, 'convo', MINUTE_MS));
      activity.push(...(count === 0 ? [] : [entry(at(2026, 9, 4, 9), 'convo', count * MINUTE_MS)]));

      const deck: ReviewCard[] = [];
      for (let i = 0; i < count; i += 1) {
        deck.push(
          cardOf({
            id: `vocab:${i}`,
            front: french[i % french.length],
            uses: i + 1,
            addedAt: NOW - (i % 5) * DAY_MS,
            reps: i,
            lapses: i % 3,
          }),
        );
      }

      const momentum: Momentum = momentumFrom({ activity, deck, profile, now: NOW });
      lines.push(...stringsIn(momentum));
    }

    for (const line of lines) {
      assert.equal(guiltIn(line), undefined, `momentum said "${line}", which carries a banned word`);
      assert.equal(line.includes('—'), false, `momentum said "${line}", and an em dash is not plain human writing`);
    }

    // Singulars, at the one count where a lazy plural is visible.
    const oneOfEach = momentumFrom({
      activity: [entry(at(2026, 9, 4, 9), 'convo', 9 * MINUTE_MS)],
      deck: [cardOf({ id: 'vocab:cafe', front: 'un cafe', uses: 1, addedAt: NOW - DAY_MS })],
      profile,
      now: NOW,
    });
    assert.equal(oneOfEach.days.count, 1, 'one day of practice');
    assert.equal(oneOfEach.days.words, 'day', 'one day, not one days');
    assert.equal(oneOfEach.retained.count, 1, 'one phrase used in conversation');
    assert.equal(oneOfEach.retained.words, 'phrase spoken naturally', 'one phrase, not one phrases');
    assert.equal(oneOfEach.retained.weekLine, '+1 this week', 'and the weekly line counts the one that arrived');
    assert.equal(
      oneOfEach.goal.note,
      '1 more minute to reach daily cadence',
      'one minute left is one minute, and a stray s here is the whole block looking careless',
    );
  });
});

/**
 * The window the day count is actually over.
 *
 * `momentumFrom` folds whatever `loadActivity` hands it, and that is not the
 * whole history: `progress/activity.ts` prunes on every write. The module used
 * to say "all time", which is very nearly true and would have become a small
 * lie for anybody who kept going long enough. This holds the words to the
 * behaviour rather than the other way round.
 */
describe('the day count says which days it counted — F412', () => {
  test('days active counts the days the log still holds, and its copy claims nothing older — F412', () => {
    const source = readFileSync(fileURLToPath(new URL('./momentum.ts', import.meta.url)), 'utf8');
    assert.doesNotMatch(
      source,
      /all[ -]time/i,
      'momentum.ts claims an all-time day count, and the activity log is pruned on every write',
    );
    assert.match(
      source,
      /KEEP_DAYS/,
      'momentum.ts never names the window its count is really over, so a reader would assume there is none',
    );

    // The property that actually matters is unchanged: within whatever it is
    // given, nothing subtracts and a gap costs nothing.
    const DAY = 24 * 60 * 60 * 1000;
    const now = Date.UTC(2026, 8, 5, 12);
    const sparse = [
      { at: now - 40 * DAY, kind: 'convo' as const, xp: 10 },
      { at: now - 3 * DAY, kind: 'convo' as const, xp: 10 },
      { at: now, kind: 'convo' as const, xp: 10 },
    ];
    const all = momentumFrom({ activity: sparse, deck: [], profile: null, now });
    const pruned = momentumFrom({ activity: sparse.slice(1), deck: [], profile: null, now });
    assert.equal(all.days.count, 3, 'a gap of five weeks cost the learner a day they had');
    assert.equal(pruned.days.count, 2, 'the count does not follow the entries it was handed');
  });
});

/**
 * Core documents where `lapses` is allowed to surface, and that permission is
 * written next to the field rather than here. The risk is not that the sentence
 * goes missing; it is that it keeps describing the formula it was written for.
 * It was written for `reps + lapses`, which decision 7 replaced on 2026-09-05
 * because it read a hundred per cent on a learner's first morning. A comment in
 * `packages/core` that still teaches the discarded arithmetic is worse than no
 * comment, because the next reader trusts it over the fold.
 */
describe('core and momentum agree about what lapses are shown as — F441', () => {
  test("the scheduler's lapses comment states the recall formula momentum actually uses — F441", () => {
    const scheduler = readFileSync(
      fileURLToPath(new URL('../../../../packages/core/src/review/scheduler.ts', import.meta.url)),
      'utf8',
    );
    const lapses = scheduler.slice(scheduler.indexOf('Times the learner pressed'), scheduler.indexOf('lapses: number;'));
    assert.notEqual(lapses.length, 0, 'the comment beside `lapses` is gone, so nothing states the permission at all');

    // The shipped fold, named in the words the module uses for it.
    assert.match(lapses, /reps - 1/, 'core does not say the first success is dropped, which is the whole of decision 7');
    assert.match(
      lapses,
      /NOT the sum of\s+\*\s+`reps \+ lapses`/,
      'core does not warn off the formula it used to describe, so a reader could reinstate it believing core agreed',
    );
    assert.match(lapses, /introduction/, 'core does not say why the first success is dropped');

    // The permission itself, which decision 7 did not touch and must survive.
    assert.match(lapses, /[Nn]ever per card/, 'the aggregate-only permission left the comment');

    // And the fold really is what the comment now claims.
    const source = readFileSync(fileURLToPath(new URL('./momentum.ts', import.meta.url)), 'utf8');
    assert.match(source, /right \+= card\.reps - 1;/, 'momentum stopped dropping the introduction, so core now overstates it');
    assert.match(source, /lapses \+= card\.lapses;/, 'momentum stopped pooling lapses into the denominator core describes');
  });
});
