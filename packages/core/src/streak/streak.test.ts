import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { addDays, dayKeyOf, dayRange, type DayKey } from './dayKey.ts';
import {
  STREAK_MILESTONES,
  isStreakMilestone,
  milestoneCrossed,
  monthFrom,
  nextStreakMilestone,
  streakFrom,
  weekStripFrom,
  type CoverKind,
  type StreakCover,
} from './streak.ts';

// Each test file runs in its own process; Paris is where the clock changes below happen.
process.env.TZ = 'Europe/Paris';

const cover = (day: DayKey, kind: CoverKind = 'freeze', at = 0): StreakCover => ({ day, kind, at });

describe('the streak', () => {
  test('a covered day bridges the run but adds nothing to the count', () => {
    // Monday to Wednesday practised, Thursday covered, Friday practised; Saturday is today, still open.
    const practiceDays = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-09'];
    const today = '2026-10-10';

    for (const kind of ['freeze', 'repair', 'travel'] as const) {
      const s = streakFrom({ practiceDays, covers: [cover('2026-10-08', kind)], today });
      assert.equal(s.current, 4, `a ${kind} keeps the run and the count is the four days practised, not five`);
      assert.equal(s.runStart, '2026-10-05');
      assert.deepEqual(s.coveredInRun, [{ day: '2026-10-08', kind }]);
      assert.equal(s.lifetimeDays, 4, `a ${kind} never adds a practice day`);
      assert.equal(s.longest, 4);
      assert.deepEqual(s.gap, []);
    }

    // Without the cover, Thursday ends the run and only Friday counts.
    const bare = streakFrom({ practiceDays, covers: [], today });
    assert.equal(bare.current, 1);
    assert.equal(bare.runStart, '2026-10-09');
    assert.equal(bare.longest, 3);

    // Covers on their own are not a run: nothing was practised in them.
    const coversOnly = streakFrom({
      practiceDays: [],
      covers: [cover('2026-10-08'), cover('2026-10-09')],
      today,
    });
    assert.equal(coversOnly.current, 0);
    assert.equal(coversOnly.runStart, null);
    assert.deepEqual(coversOnly.coveredInRun, []);

    // A cover on a day that was practised changes nothing, and one on today or later is ignored.
    const moot = streakFrom({
      practiceDays,
      covers: [cover('2026-10-09'), cover('2026-10-10'), cover('2026-10-11')],
      today,
    });
    assert.equal(moot.current, 1);
    assert.deepEqual(moot.coveredInRun, []);
  });

  test('today stays open until it is over, so the run ends at yesterday', () => {
    const practiceDays = ['2026-10-03', '2026-10-04'];
    const open = streakFrom({ practiceDays, covers: [], today: '2026-10-05' });
    assert.equal(open.today, 'open');
    assert.equal(open.current, 2, 'an unpractised today is not yet a gap');
    assert.deepEqual(open.gap, []);

    const done = streakFrom({ practiceDays: [...practiceDays, '2026-10-05'], covers: [], today: '2026-10-05' });
    assert.equal(done.today, 'practised');
    assert.equal(done.current, 3);
    assert.equal(done.lastPracticeDay, '2026-10-05');
  });

  test('an uncovered day ends the run, and the gap names the days between', () => {
    const s = streakFrom({ practiceDays: ['2026-10-01', '2026-10-02'], covers: [], today: '2026-10-05' });
    assert.equal(s.current, 0);
    assert.equal(s.runStart, null);
    assert.deepEqual(s.gap, ['2026-10-03', '2026-10-04']);
    assert.equal(s.lifetimeDays, 2, 'the lifetime count keeps every day practised');
    assert.equal(s.longest, 2);

    // Practising today after the gap starts a new run; the gap behind it is still named.
    const back = streakFrom({ practiceDays: ['2026-10-01', '2026-10-02', '2026-10-05'], covers: [], today: '2026-10-05' });
    assert.equal(back.current, 1);
    assert.deepEqual(back.gap, ['2026-10-03', '2026-10-04']);

    // A learner who has never practised has no gap and no run.
    const never = streakFrom({ practiceDays: [], covers: [], today: '2026-10-05' });
    assert.deepEqual(
      { current: never.current, lifetimeDays: never.lifetimeDays, gap: never.gap, lastPracticeDay: never.lastPracticeDay },
      { current: 0, lifetimeDays: 0, gap: [], lastPracticeDay: null },
    );
  });

  test('days after today are ignored', () => {
    // A clock that ran fast on another device wrote tomorrow and the day after.
    const s = streakFrom({ practiceDays: ['2026-10-04', '2026-10-06', '2026-10-07'], covers: [], today: '2026-10-05' });
    assert.equal(s.today, 'open');
    assert.equal(s.current, 1);
    assert.equal(s.lifetimeDays, 1, 'a day not yet lived is not a practice day');
    assert.equal(s.lastPracticeDay, '2026-10-04');
    assert.equal(s.longest, 1);
  });

  test('a run across the spring clock change counts every day once', () => {
    // Half past midnight every night from the 27th to the 31st of March 2026,
    // across the 23-hour 29th. The day keys come from real timestamps.
    const nights = [26, 27, 28, 29, 30].map((d) => Date.UTC(2026, 2, d, 23, 30) - (d >= 29 ? 3_600_000 : 0));
    const practiceDays = nights.map(dayKeyOf);
    assert.deepEqual(practiceDays, ['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31']);
    const s = streakFrom({ practiceDays, covers: [], today: '2026-03-31' });
    assert.equal(s.current, 5);
    assert.equal(s.runStart, '2026-03-27');
  });

  test('a run across the autumn clock change counts every day once', () => {
    // Late every evening from the 23rd to the 27th of October 2026, across the
    // 25-hour 25th. Two sittings on the 25th itself, an hour either side of the change.
    const evenings = [
      Date.UTC(2026, 9, 23, 20, 0),
      Date.UTC(2026, 9, 24, 20, 0),
      Date.UTC(2026, 9, 25, 0, 30), // 02:30 summer time, before the change
      Date.UTC(2026, 9, 25, 1, 30), // 02:30 winter time, after it
      Date.UTC(2026, 9, 26, 21, 0),
      Date.UTC(2026, 9, 27, 21, 0),
    ];
    const practiceDays = evenings.map(dayKeyOf);
    assert.deepEqual([...new Set(practiceDays)], ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
    const s = streakFrom({ practiceDays, covers: [], today: '2026-10-27' });
    assert.equal(s.current, 5, 'the repeated hour is one day, counted once');
    assert.equal(s.lifetimeDays, 5);
  });

  test('a leap day and a new year are days like any other', () => {
    const leap = streakFrom({ practiceDays: ['2028-02-28', '2028-02-29', '2028-03-01'], covers: [], today: '2028-03-01' });
    assert.equal(leap.current, 3);
    const notLeap = streakFrom({ practiceDays: ['2027-02-27', '2027-02-28', '2027-03-01'], covers: [], today: '2027-03-01' });
    assert.equal(notLeap.current, 3, '2027 has no 29th of February to fall into');
    const newYear = streakFrom({ practiceDays: dayRange('2026-12-29', '2027-01-02'), covers: [], today: '2027-01-02' });
    assert.equal(newYear.current, 5);
    assert.equal(newYear.runStart, '2026-12-29');
  });

  test('the lifetime count is never below the streak, and the longest never below either run', () => {
    // A generated history with a fixed seed, so a failure always replays the same way.
    let state = 7;
    const random = () => {
      state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
      return state / 2_147_483_648;
    };
    for (let trial = 0; trial < 200; trial += 1) {
      const today = addDays('2026-10-05', Math.floor(random() * 400));
      const practiceDays: DayKey[] = [];
      const covers: StreakCover[] = [];
      for (let back = -3; back < 120; back += 1) {
        const day = addDays(today, -back);
        const roll = random();
        if (roll < 0.7) practiceDays.push(day);
        else if (roll < 0.8) covers.push(cover(day, (['freeze', 'repair', 'travel'] as const)[trial % 3]));
      }
      const s = streakFrom({ practiceDays, covers, today });
      assert.ok(s.lifetimeDays >= s.current, `trial ${trial}: lifetime ${s.lifetimeDays} below streak ${s.current}`);
      assert.ok(s.longest >= s.current, `trial ${trial}: longest ${s.longest} below streak ${s.current}`);
      assert.equal(s.lifetimeDays, new Set(practiceDays.filter((d) => d <= today)).size);
      assert.equal(s.current > 0, s.runStart !== null);
    }
  });

  test('unreadable days are dropped, never guessed', () => {
    const s = streakFrom({
      practiceDays: ['2026-10-04', 'yesterday', '2026-02-30', '2026-10-04'],
      covers: [cover('not-a-day'), { day: '2026-10-03', kind: 'gift' as CoverKind, at: 0 }],
      today: '2026-10-05',
    });
    assert.equal(s.lifetimeDays, 1);
    assert.equal(s.current, 1);
    assert.throws(() => streakFrom({ practiceDays: [], covers: [], today: 'today' }), RangeError);
  });

  test('two covers on one day: the earliest written names it', () => {
    const s = streakFrom({
      practiceDays: ['2026-10-03', '2026-10-05'],
      covers: [cover('2026-10-04', 'freeze', 20), cover('2026-10-04', 'repair', 10)],
      today: '2026-10-05',
    });
    assert.equal(s.current, 2);
    assert.deepEqual(s.coveredInRun, [{ day: '2026-10-04', kind: 'repair' }]);
  });
});

describe('streak milestones', () => {
  test('milestones are 7, 30, 100 and 365, then every 365 days', () => {
    assert.deepEqual([...STREAK_MILESTONES], [7, 30, 100, 365]);
    assert.equal(milestoneCrossed(6, 7), 7);
    assert.equal(milestoneCrossed(7, 8), null);
    assert.equal(milestoneCrossed(29, 30), 30);
    assert.equal(milestoneCrossed(99, 100), 100);
    assert.equal(milestoneCrossed(364, 365), 365);
    assert.equal(milestoneCrossed(729, 730), 730);
    assert.equal(milestoneCrossed(730, 731), null);
    assert.equal(milestoneCrossed(1094, 1095), 1095);
    // One change past several names only the largest, so nothing plays in a burst.
    assert.equal(milestoneCrossed(0, 400), 365);
    assert.equal(milestoneCrossed(5, 31), 30);
    // Standing still or going down crosses nothing.
    assert.equal(milestoneCrossed(7, 7), null);
    assert.equal(milestoneCrossed(8, 1), null);
    assert.equal(milestoneCrossed(0, 6), null);

    assert.equal(nextStreakMilestone(0), 7);
    assert.equal(nextStreakMilestone(7), 30);
    assert.equal(nextStreakMilestone(364), 365);
    assert.equal(nextStreakMilestone(365), 730);
    assert.ok(isStreakMilestone(30) && isStreakMilestone(1460));
    assert.ok(!isStreakMilestone(0) && !isStreakMilestone(31) && !isStreakMilestone(500));
  });
});

describe('the week strip and the month', () => {
  test('the week strip runs Monday to Sunday with today in it', () => {
    // Today is Wednesday 7 October 2026. Monday practised, Tuesday covered,
    // and a stray future practice on Friday.
    const week = weekStripFrom({
      practiceDays: ['2026-10-05', '2026-10-09'],
      covers: [cover('2026-10-06')],
      today: '2026-10-07',
    });
    assert.deepEqual(
      week.map((c) => [c.day, c.label, c.state]),
      [
        ['2026-10-05', 'M', 'practised'],
        ['2026-10-06', 'T', 'covered'],
        ['2026-10-07', 'W', 'today-open'],
        ['2026-10-08', 'T', 'ahead'],
        ['2026-10-09', 'F', 'ahead'],
        ['2026-10-10', 'S', 'ahead'],
        ['2026-10-11', 'S', 'ahead'],
      ],
    );
    assert.equal(week[1]!.cover, 'freeze');
    assert.equal(week[0]!.name, 'Monday');
    assert.equal(week[6]!.name, 'Sunday');

    // On a Sunday the strip is the week just ending, and today practised is practised.
    const sunday = weekStripFrom({ practiceDays: ['2026-10-11'], covers: [], today: '2026-10-11' });
    assert.equal(sunday[0]!.day, '2026-10-05');
    assert.equal(sunday[6]!.state, 'practised');
    assert.equal(sunday[2]!.state, 'open');
  });

  test('the month calendar names every day and never a missed one', () => {
    const feb = monthFrom({ practiceDays: ['2028-02-01', '2028-02-29'], covers: [], today: '2028-02-20', year: 2028, month: 2 });
    assert.equal(feb.length, 29);
    assert.equal(feb[0]!.weekday, 1, '1 February 2028 is a Tuesday');
    assert.equal(feb[0]!.state, 'practised');
    assert.equal(feb[1]!.state, 'open');
    assert.equal(feb[19]!.state, 'today-open');
    assert.equal(feb[28]!.state, 'ahead', 'a future practice is drawn as still to come');
    const states = new Set(feb.map((c) => c.state));
    for (const state of states) assert.ok(['practised', 'covered', 'today-open', 'open', 'ahead'].includes(state));

    assert.equal(monthFrom({ practiceDays: [], covers: [], today: '2026-10-05', year: 2026, month: 13 }).length, 0);
    assert.equal(monthFrom({ practiceDays: [], covers: [], today: '2026-10-05', year: 2026, month: 12 }).at(-1)!.day, '2026-12-31');
  });
});
