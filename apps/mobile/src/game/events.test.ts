/**
 * From a settled sitting to the moments it may celebrate (F744), and what the
 * quiet catch-up does with moments already true (F745).
 *
 * Pure: a GameDelta in, CelebrationEvents out. The rule under test is the
 * founder's KEEP rule, that every celebration is tied to a persisted event: a
 * takeover may only ever name a fact the delta carries, and the delta is read
 * back from disk.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, mulberry32, streakFrom, type StreakState } from '@luvani/core';

import { celebrationKey, isTakeover } from '../celebrate/events.ts';
import type { GameDelta } from './delta.ts';
import { catchUpPlan } from './catchUp.ts';
import { eventsFromDelta } from './events.ts';

const DAY = '2026-10-05';
const AT = new Date(2026, 9, 5, 12).getTime();

function streakOf(days: number, practisedToday: boolean): StreakState {
  const end = practisedToday ? DAY : addDays(DAY, -1);
  const practiceDays = Array.from({ length: days }, (_, i) => addDays(end, -i));
  return streakFrom({ practiceDays, covers: [], today: DAY });
}

function deltaFrom(random: () => number): GameDelta {
  const pick = <T,>(options: readonly T[]): T => options[Math.floor(random() * options.length)]!;
  const beforeDays = pick([0, 1, 5, 6, 29, 99]);
  const practisedBefore = random() < 0.5;
  const practisedAfter = practisedBefore || random() < 0.7;
  const afterDays = practisedAfter && !practisedBefore ? beforeDays + 1 : beforeDays;
  const before = streakOf(beforeDays, practisedBefore);
  const after = streakOf(afterDays, practisedAfter);
  const milestone = random() < 0.3 ? pick([7, 30, 100, 365]) : null;
  const levelBefore = pick([1, 2, 9]);
  const completedNow = random() < 0.5 ? (['finish-practice', 'minutes'] as const).slice(0, pick([1, 2])) : [];
  // Sometimes this sitting finished the day's third quest (D22: a quiet line on the end card, never a takeover).
  const done = completedNow.length > 0 && random() < 0.3 ? 3 : completedNow.length;
  return {
    key: `sitting:convo:${AT}`,
    source: pick(['convo', 'lesson', 'drill', 'review', 'phrase', 'guest'] as const),
    at: AT,
    activeMs: null,
    xp: {
      earned: 40,
      counted: 40,
      capped: false,
      bonus: 0,
      questXp: completedNow.length * 10,
      totalBefore: 0,
      totalAfter: 0,
    },
    goal: { target: 10, minutesBefore: 0, minutesAfter: 0, metNow: random() < 0.5 },
    streak: { before, after, extendedNow: practisedAfter && !practisedBefore, milestone, restoredBy: null },
    quests: { completedNow: [...completedNow], done, doneBefore: done - completedNow.length },
    level: { before: levelBefore, after: levelBefore + pick([0, 0, 1, 2]) },
    badges: random() < 0.4 ? pick([['streak-7'], ['first-conversation', 'level-10'], []]) : [],
  };
}

describe('the moments a settled sitting may celebrate — F744', () => {
  test('eventsFromDelta never emits a takeover for a fact not in the delta', () => {
    const random = mulberry32(744);
    for (let i = 0; i < 500; i += 1) {
      const delta = deltaFrom(random);
      const events = eventsFromDelta(delta, 'account', DAY);
      for (const event of events) {
        assert.ok(isTakeover(event.type), `${event.type} is not a takeover`);
        assert.equal(event.origin, 'account');
        switch (event.type) {
          case 'streak-extended':
            assert.ok(delta.streak.extendedNow && delta.streak.milestone === null, 'a streak moment for a day that did not extend it');
            assert.equal(event.key, celebrationKey.streak(DAY));
            assert.equal(event.data.current, delta.streak.after.current);
            break;
          case 'streak-milestone':
            assert.equal(event.data.milestone, delta.streak.milestone, 'a milestone the delta never crossed');
            assert.equal(event.key, celebrationKey.milestone(delta.streak.milestone!, delta.streak.after.runStart!));
            break;
          case 'level-up':
            assert.ok(delta.level.after > delta.level.before, 'a level-up that did not happen');
            assert.equal(event.key, celebrationKey.level(delta.level.after));
            break;
          case 'badge-earned':
            assert.ok(delta.badges.includes(event.data.id), `a badge the sitting never earned: ${event.data.id}`);
            break;
          default:
            assert.fail(`an event type the pipeline never emits: ${event.type}`);
        }
      }
      // Each fact once, and only facts.
      assert.ok(events.filter((e) => e.type === 'streak-extended' || e.type === 'streak-milestone').length <= 1);
      assert.equal(events.filter((e) => e.type === 'badge-earned').length, delta.badges.length);
      assert.equal(new Set(events.map((e) => e.key)).size, events.length, 'one fact named twice');
    }

    // A sitting that changed nothing celebrates nothing.
    const quiet = deltaFrom(mulberry32(1));
    const nothing: GameDelta = {
      ...quiet,
      streak: { ...quiet.streak, extendedNow: false, milestone: null },
      quests: { completedNow: [], done: 0, doneBefore: 0 },
      level: { before: 3, after: 3 },
      badges: [],
    };
    assert.deepEqual(eventsFromDelta(nothing, 'account', DAY), []);
    // Finishing all three quests is not a takeover either: the end card says it in one quiet line (D22).
    assert.deepEqual(eventsFromDelta({ ...nothing, quests: { completedNow: ['finish-practice'], done: 3, doneBefore: 2 } }, 'account', DAY), []);
  });
});

describe('the quiet catch-up — F745', () => {
  test('the quiet catch-up marks what is already true as seen and replays only a durable moment a crash cut short', () => {
    const current = [`streak:${DAY}`, 'level:4', 'badge:streak-7', 'badge:first-conversation', `milestone:7:${addDays(DAY, -7)}`];
    const plan = catchUpPlan({
      current,
      seen: new Set(['badge:first-conversation']),
      // A crash cut short a level-up and a streak moment a settle had queued in an earlier launch,
      // and left yesterday's streak moment behind.
      pending: ['level:4', `streak:${DAY}`, `streak:${addDays(DAY, -1)}`],
      published: (key) => key === 'badge:streak-7',
      replayed: new Set(),
    });
    assert.deepEqual(plan.replay, ['level:4'], 'only a durable moment a crash cut short plays again');
    assert.deepEqual(
      plan.quiet.sort(),
      [`milestone:7:${addDays(DAY, -7)}`, `streak:${addDays(DAY, -1)}`, `streak:${DAY}`].sort(),
      'what is already true, or no longer current, is marked seen without a takeover',
    );
    assert.ok(!plan.quiet.includes('badge:streak-7'), 'a moment this launch handed the host was marked seen before it played');
    assert.ok(!plan.quiet.includes('badge:first-conversation'));
    assert.deepEqual(plan.drop.sort(), [`streak:${addDays(DAY, -1)}`, `streak:${DAY}`].sort());

    // Once per launch: a moment replayed already is not replayed again.
    const again = catchUpPlan({ current, seen: new Set(), pending: ['level:4'], published: () => false, replayed: new Set(['level:4']) });
    assert.deepEqual(again.replay, []);
    assert.ok(!again.quiet.includes('level:4'), 'a replayed moment waiting for the host was marked seen under it');
  });
});
