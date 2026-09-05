/**
 * Daily momentum, and the four things it is not allowed to become — F396.
 *
 * The block sits exactly where a streak would go, so most of this file is
 * about absence: what the learner is NOT shown, and what the numbers can never
 * do. The zero case comes first because it is the one a first-run learner
 * meets, and the copy scan comes last because it is the one that catches a
 * "keep it going" line somebody adds in six months.
 *
 * `now` is a constant in every test. Nothing here reads a clock, so every day
 * boundary below is the learner's own local midnight and can be walked across
 * on purpose.
 */

import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

import { applyGrade, isSettled, newCard, type ReviewCard } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { createStoredProfile, withDailyGoal, type StoredProfile } from '../profile/store.ts';
import type { ActivityEntry, ActivityKind } from './activity.ts';
import {
  DAYS_LABEL,
  GOAL_MET,
  GOAL_TITLE,
  MOMENTUM_WEEK_DAYS,
  RETAINED_LABEL,
  hasMomentum,
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
 * A card past the settled line, optionally carrying the date it crossed it.
 *
 * `settledAt` absent is the shape of every card graded before the field
 * existed, which is most of a real deck, so it is a case rather than an edge.
 * `settled cards are real` below pins this factory to `isSettled` so it cannot
 * drift into describing a card core would not agree about.
 */
function settledCard(id: string, settledAt: number | undefined, now: number): ReviewCard {
  const base = newCard({ id, kind: 'turn', front: id, back: id, context: '', ipa: '' }, now - 40 * DAY_MS);
  const card: ReviewCard = { ...base, reps: 3, intervalDays: 10, due: now + 5 * DAY_MS };
  return settledAt === undefined ? card : { ...card, settledAt };
}

/** A card still climbing: reviewed, nowhere near settled. */
function climbingCard(id: string, now: number): ReviewCard {
  const base = newCard({ id, kind: 'turn', front: id, back: id, context: '', ipa: '' }, now - 3 * DAY_MS);
  return { ...base, reps: 1, intervalDays: 1, due: now + DAY_MS };
}

/** Every string anywhere in a momentum block, however deeply nested. */
function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(stringsIn);
  return [];
}

describe('the momentum block at zero — what a first run is shown', () => {
  test('a learner with no progress has no momentum block at all — F396', () => {
    const momentum = momentumFrom({ activity: [], deck: [], profile: noGoal(), now: NOW });

    assert.deepEqual(
      momentum,
      { days: null, retained: null, goal: null },
      'a learner with nothing behind them must meet nothing, not a rail of noughts telling them so',
    );
    assert.equal(hasMomentum(momentum), false, 'Home waits on this gate, and at zero it must draw nothing at all');

    // Choosing a daily goal is not progress. It is a promise about the future,
    // and measuring somebody against it before they have spent a minute would
    // open their first day at nought per cent.
    const promised = momentumFrom({ activity: [], deck: [], profile: tenMinuteGoal(), now: NOW });
    assert.equal(promised.goal, null, 'a goal with no minutes behind it is a card reading zero out of ten');
    assert.equal(hasMomentum(promised), false, 'picking a goal must not conjure a block out of an empty log');
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
    assert.ok(days, 'three days of practice is something to say');

    assert.equal(days.count, 3, 'three distinct local days carried an entry, and two sittings in one day are one day');

    // No chain. Days do not have to touch, and nothing here asks whether
    // yesterday had an entry.
    const inARow = [entry(at(2026, 9, 2, 9)), entry(at(2026, 9, 3, 9)), entry(at(2026, 9, 4, 9))];
    const consecutive = momentumFrom({ activity: inARow, deck: [], profile: noGoal(), now: NOW }).days;
    assert.equal(consecutive?.count, days.count, 'three days in a row must be worth exactly what three scattered days are');

    // No loss state. The count is a set size over an append-only log, so time
    // passing can only ever leave it alone.
    let floor = days.count;
    for (let ahead = 0; ahead <= 30; ahead += 1) {
      const later = momentumFrom({ activity, deck: [], profile: noGoal(), now: NOW + ahead * DAY_MS }).days;
      assert.ok(later, 'a month of silence must never delete days that were genuinely practised');
      assert.ok(later.count >= floor, `day ${ahead} of quiet lowered the count from ${floor} to ${later.count}`);
      floor = later.count;
    }
    assert.equal(floor, 3, 'thirty quiet days later it is still the same three days, neither more nor fewer');

    // And there is no field a loss could ever be written into. A "broken",
    // "atRisk" or "owed" key added here fails this line by name.
    assert.deepEqual(
      Object.keys(days).sort(),
      ['count', 'label', 'unit', 'week'],
      'the days tile grew a field, and the only fields it may have are a count, a picture of the week and two words',
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
      yesterdayOnly?.week,
      [false, false, false, false, false, true, false],
      'the row runs oldest to newest, so yesterday is the sixth mark and today, still quiet, is the seventh',
    );

    // Absent, not zero, exactly as progress/today.ts and progress/evidence.ts are.
    assert.equal(
      momentumFrom({ activity: [], deck: [], profile: noGoal(), now: NOW }).days,
      null,
      'an empty row of marks is a quota nobody has met, which is the streak wearing a different hat',
    );
  });
});

describe('retained phrases — what has stuck, and what we cannot date', () => {
  test('settled cards are real, and the weekly line is absent rather than nought — F396', () => {
    const graded = settledCard('vocab:un cafe', NOW - 2 * DAY_MS, NOW);
    assert.equal(isSettled(graded, NOW), true, 'the factory below must describe a card core itself calls settled');

    const deck = [
      settledCard('vocab:un cafe', NOW - 2 * DAY_MS, NOW),
      settledCard('vocab:l addition', NOW - 6 * DAY_MS, NOW),
      // Settled long before `settledAt` existed. Counted as retained, and
      // deliberately not counted as this week's.
      settledCard('vocab:bonjour', undefined, NOW),
      settledCard('vocab:merci', NOW - 40 * DAY_MS, NOW),
      climbingCard('vocab:je voudrais', NOW),
    ];

    const retained = momentumFrom({ activity: [], deck, profile: noGoal(), now: NOW }).retained;
    assert.ok(retained, 'four phrases have stuck, which is worth saying');
    assert.equal(retained.count, 4, 'a card still climbing is not retained, and the other four are');
    assert.equal(retained.thisWeek, 2, 'two of them settled inside the last seven local days');
    assert.equal(retained.weekLine, '+2 this week', 'the mockup puts the weekly gain beside the numeral, in green');

    // An established learner's deck: settled long ago, dated by nothing.
    const oldDeck = [settledCard('vocab:bonjour', undefined, NOW), settledCard('vocab:merci', undefined, NOW)];
    const old = momentumFrom({ activity: [], deck: oldDeck, profile: noGoal(), now: NOW }).retained;
    assert.equal(old?.count, 2, 'phrases that settled before we recorded when still count as retained');
    assert.equal(old?.thisWeek, null, 'we do not know when those landed, and "+0 this week" would be us claiming we do');
    assert.equal(old?.weekLine, null, 'nothing to say means no line, not an empty one');

    // The real pipeline, not just the factory: a card graded to settled today
    // carries the date and lands in this week's count.
    const fresh = newCard(
      { id: 'vocab:pain', kind: 'turn', front: 'pain', back: 'bread', context: '', ipa: '' },
      NOW - 10 * DAY_MS,
    );
    const once = applyGrade(fresh, 'good', NOW - 9 * DAY_MS);
    const twice = applyGrade(once, 'good', NOW - 8 * DAY_MS);
    const settled = applyGrade(twice, 'good', NOW - DAY_MS);
    assert.equal(isSettled(settled, NOW), true, 'three successes clear the settled line');
    const scheduled = momentumFrom({ activity: [], deck: [settled], profile: noGoal(), now: NOW }).retained;
    assert.equal(scheduled?.count, 1, 'a card the scheduler itself settled is a retained phrase');
    assert.equal(scheduled?.thisWeek, 1, 'it settled yesterday, so it belongs to this week');

    const climbingOnly = { activity: [], deck: [climbingCard('vocab:je voudrais', NOW)], profile: noGoal(), now: NOW };
    assert.equal(
      momentumFrom(climbingOnly).retained,
      null,
      'nothing settled yet is nothing to report, not a tile reading nought phrases',
    );
  });
});

describe("today's speaking goal — measured in speaking, or not measured", () => {
  test("today's speaking goal is absent without a goal or without minutes, and counts only spoken sittings — F396", () => {
    const spokeSix = [entry(at(2026, 9, 4, 9), 'convo', 6 * MINUTE_MS)];

    assert.equal(
      momentumFrom({ activity: spokeSix, deck: [], profile: noGoal(), now: NOW }).goal,
      null,
      'nobody has chosen a daily promise, so there is no promise to measure them against',
    );

    const goal = momentumFrom({ activity: spokeSix, deck: [], profile: tenMinuteGoal(), now: NOW }).goal;
    assert.ok(goal, 'six minutes against a ten minute goal is a real card');
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
      momentumFrom({ activity: mixed, deck: [], profile: tenMinuteGoal(), now: NOW }).goal?.minutes,
      6,
      'a lesson and a drill produce French out loud or on the keys, and both count towards a speaking goal',
    );

    // Review is recall, not speaking, and this card is named for speaking.
    const reviewOnly = [entry(at(2026, 9, 4, 9), 'review', 25 * MINUTE_MS)];
    assert.equal(
      momentumFrom({ activity: reviewOnly, deck: [], profile: tenMinuteGoal(), now: NOW }).goal,
      null,
      'twenty five minutes of card review must never fill a bar labelled speaking',
    );

    // Sittings recorded before `durationMs` existed measured nothing, and
    // nothing is not zero minutes of speaking.
    const unmeasured = [entry(at(2026, 9, 4, 9), 'convo'), entry(at(2026, 9, 4, 11), 'lesson')];
    assert.equal(
      momentumFrom({ activity: unmeasured, deck: [], profile: tenMinuteGoal(), now: NOW }).goal,
      null,
      'a sitting that took ten minutes and did not record it is not a ten minute claim of nothing',
    );

    // Yesterday's minutes are yesterday's.
    const yesterday = [entry(at(2026, 9, 3, 21), 'convo', 20 * MINUTE_MS)];
    assert.equal(
      momentumFrom({ activity: yesterday, deck: [], profile: tenMinuteGoal(), now: NOW }).goal,
      null,
      'a goal card that carried yesterday over would be a card nobody can ever finish',
    );

    // Under a minute is floored, because the direction to be wrong in is the
    // modest one.
    const seconds = [entry(at(2026, 9, 4, 9), 'convo', 59_000)];
    assert.equal(
      momentumFrom({ activity: seconds, deck: [], profile: tenMinuteGoal(), now: NOW }).goal,
      null,
      'under a whole minute is absent rather than shown as nought of ten',
    );

    // Past the goal, the bar cannot overflow and the footer turns warm.
    const over = [entry(at(2026, 9, 4, 9), 'convo', 22 * MINUTE_MS)];
    const met = momentumFrom({ activity: over, deck: [], profile: tenMinuteGoal(), now: NOW }).goal;
    assert.equal(met?.minutes, 22, 'the minutes are what happened, even past the promise');
    assert.equal(met?.remaining, 0, 'nothing is left to ask for');
    assert.equal(met?.percent, 100, 'the bar clamps rather than running off the card');
    assert.equal(met?.percentLabel, '100%', 'and so does the figure beside it');
    assert.equal(met?.note, GOAL_MET, 'a met goal is met, and the footer stops counting down');
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
    const lines: string[] = [DAYS_LABEL, RETAINED_LABEL, GOAL_TITLE, GOAL_MET];

    // Several counts, including the two that break naive copy: nothing at all,
    // and exactly one of everything.
    for (const count of [0, 1, 2, 3, 4, 7, 9, 10, 11, 22]) {
      const activity: ActivityEntry[] = [];
      for (let i = 0; i < count; i += 1) activity.push(entry(at(2026, 8, 24, 9) + i * DAY_MS, 'convo', MINUTE_MS));
      activity.push(...(count === 0 ? [] : [entry(at(2026, 9, 4, 9), 'convo', count * MINUTE_MS)]));

      const deck: ReviewCard[] = [];
      for (let i = 0; i < count; i += 1) deck.push(settledCard(`vocab:${i}`, NOW - (i % 5) * DAY_MS, NOW));

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
      deck: [settledCard('vocab:un cafe', NOW - DAY_MS, NOW)],
      profile,
      now: NOW,
    });
    assert.equal(oneOfEach.days?.count, 1, 'one day of practice');
    assert.equal(oneOfEach.days?.unit, 'day', 'one day, not one days');
    assert.equal(oneOfEach.retained?.count, 1, 'one phrase retained');
    assert.equal(oneOfEach.retained?.unit, 'phrase', 'one phrase, not one phrases');
    assert.equal(oneOfEach.retained?.weekLine, '+1 this week', 'and the weekly line counts the one that landed');
    assert.equal(
      oneOfEach.goal?.note,
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
    assert.equal(all.days!.count, 3, 'a gap of five weeks cost the learner a day they had');
    assert.equal(pruned.days!.count, 2, 'the count does not follow the entries it was handed');
  });
});
