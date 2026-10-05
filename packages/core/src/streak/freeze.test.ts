import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { addDays, dayRange, type DayKey } from './dayKey.ts';
import { monthFrom, streakFrom, type StreakCover } from './streak.ts';
import { FREEZE_CAP, FREEZE_RETURN_DAYS, freezesHeld, freezesToApply, nextFreezeReturn } from './freeze.ts';
import { recentBreak, repairOffer } from './repair.ts';
import { travelCover } from './travel.ts';

process.env.TZ = 'Europe/Paris';

const freeze = (day: DayKey, at = 0): StreakCover => ({ day, kind: 'freeze', at });
/** Noon in Paris on a day, so a sitting's day key is never near a boundary. */
const noon = (day: DayKey) => Date.parse(`${day}T10:00:00Z`);

describe('streak protection is a paid-plan perk', () => {
  test('freezes and repair apply only to an entitled learner', () => {
    // Three days practised, the 4th got away, today (the 5th) two practices finished.
    const base = {
      practiceDays: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05'],
      covers: [] as StreakCover[],
      today: '2026-10-05',
    };
    const sittings = [{ at: noon('2026-10-05') }, { at: noon('2026-10-05') + 600_000 }];
    const travel = { offsetBefore: 60, offsetNow: -600 };

    const paid = { ...base, entitled: true };
    assert.equal(freezesHeld(paid), FREEZE_CAP);
    assert.deepEqual(freezesToApply({ ...paid, paidSince: '2026-09-01' }), ['2026-10-04']);
    const repair = repairOffer({ ...paid, sittings });
    assert.ok(repair !== null && repair.ready, 'a subscriber can repair the gap');
    assert.equal(travelCover({ ...paid, ...travel }), '2026-10-04');

    const free = { ...base, entitled: false };
    assert.equal(freezesHeld(free), 0);
    assert.equal(nextFreezeReturn({ ...free, covers: [freeze('2026-10-04')] }), null);
    assert.deepEqual(freezesToApply({ ...free, paidSince: '2026-09-01' }), []);
    assert.equal(repairOffer({ ...free, sittings }), null);
    assert.equal(travelCover({ ...free, ...travel }), null);

    // A free learner's streak simply restarts; the lifetime count keeps every day.
    const after = streakFrom(free);
    assert.equal(after.current, 1);
    assert.equal(after.lifetimeDays, 4);

    // The break itself is still a fact, so the free learner's one calm line is honest.
    assert.deepEqual(recentBreak(free)?.days, ['2026-10-04']);
  });
});

describe('freezes', () => {
  const run = dayRange('2026-09-20', '2026-10-02');
  const paid = { entitled: true, paidSince: '2026-09-01' };

  test('a freeze covers a gap automatically only when it saves the whole run', () => {
    // One day away, two held: covered.
    assert.deepEqual(freezesToApply({ ...paid, practiceDays: run, covers: [], today: '2026-10-04' }), ['2026-10-03']);
    // Two days away, two held: both covered, and the run is whole again.
    const two = freezesToApply({ ...paid, practiceDays: run, covers: [], today: '2026-10-05' });
    assert.deepEqual(two, ['2026-10-03', '2026-10-04']);
    const covered = streakFrom({ practiceDays: run, covers: two.map((d) => freeze(d)), today: '2026-10-05' });
    assert.equal(covered.current, run.length, 'the covered days keep the run and add nothing');
    // Three days away is more than two freezes can save, so none is spent.
    assert.deepEqual(freezesToApply({ ...paid, practiceDays: run, covers: [], today: '2026-10-06' }), []);
    // Two days away with one freeze already in use (it covered the 30th): none is spent either.
    const withUsed = { practiceDays: run.filter((d) => d !== '2026-09-30'), covers: [freeze('2026-09-30')], today: '2026-10-05' };
    assert.equal(freezesHeld({ ...withUsed, entitled: true }), 1);
    assert.deepEqual(freezesToApply({ ...paid, ...withUsed }), []);
    // With the same single freeze, a one-day gap is still covered.
    assert.deepEqual(freezesToApply({ ...paid, ...withUsed, today: '2026-10-04' }), ['2026-10-03']);
    // Nothing to cover, nothing spent.
    assert.deepEqual(freezesToApply({ ...paid, practiceDays: run, covers: [], today: '2026-10-03' }), []);
  });

  test('a used freeze comes back seven days after the day it covered', () => {
    const covers = [freeze('2026-10-03')];
    const practiceDays = run;
    for (let d = 1; d < FREEZE_RETURN_DAYS; d += 1) {
      const today = addDays('2026-10-03', d);
      assert.equal(freezesHeld({ practiceDays, covers, today, entitled: true }), 1, `still in use ${d} days later`);
      assert.equal(nextFreezeReturn({ practiceDays, covers, today, entitled: true }), '2026-10-10');
    }
    const back = '2026-10-10';
    assert.equal(freezesHeld({ practiceDays, covers, today: back, entitled: true }), 2);
    assert.equal(nextFreezeReturn({ practiceDays, covers, today: back, entitled: true }), null);
  });

  test('a freeze on a day that turns out to be practised is refunded', () => {
    // Another device's practice on the 3rd arrived by sync after the freeze was written.
    const covers = [freeze('2026-10-03')];
    assert.equal(freezesHeld({ practiceDays: run, covers, today: '2026-10-05', entitled: true }), 1);
    assert.equal(freezesHeld({ practiceDays: [...run, '2026-10-03'], covers, today: '2026-10-05', entitled: true }), 2);
  });

  test('no freeze covers a day before the plan began, or a gap with no run before it', () => {
    // The plan began today: yesterday passed uncovered before it, and buying a plan does not cover it.
    assert.deepEqual(freezesToApply({ entitled: true, paidSince: '2026-10-04', practiceDays: run, covers: [], today: '2026-10-04' }), []);
    assert.deepEqual(freezesToApply({ entitled: true, paidSince: '2026-10-03', practiceDays: run, covers: [], today: '2026-10-04' }), ['2026-10-03']);
    // An unknown start (null) applies nothing; the gap waits for a real billing answer.
    assert.deepEqual(freezesToApply({ entitled: true, paidSince: null, practiceDays: run, covers: [], today: '2026-10-04' }), []);
    // A learner with nothing before the gap has no run to keep.
    assert.deepEqual(freezesToApply({ ...paid, practiceDays: [], covers: [freeze('2026-10-01')], today: '2026-10-03' }), []);
  });

  test('a freeze is spent only on a day the streak used it for', () => {
    // Two devices each saw the 3rd get away: one wrote a repair, the other a freeze.
    const practiceDays = [...run, '2026-10-04'];
    const today = '2026-10-05';
    const repair = (at: number): StreakCover => ({ day: '2026-10-03', kind: 'repair', at });
    const travel = (at: number): StreakCover => ({ day: '2026-10-03', kind: 'travel', at });
    const coverOn3rd = (covers: StreakCover[]) =>
      streakFrom({ practiceDays, covers, today }).coveredInRun.find((c) => c.day === '2026-10-03')?.kind;

    // Written at the same moment: the streak keeps the repair, so the freeze was never used.
    const tie = [freeze('2026-10-03', 5), repair(5)];
    assert.equal(coverOn3rd(tie), 'repair');
    assert.equal(freezesHeld({ practiceDays, covers: tie, today, entitled: true }), 2);
    assert.equal(nextFreezeReturn({ practiceDays, covers: tie, today, entitled: true }), null);
    // The repair written first wins whatever order the list arrives in.
    const repairFirst = [freeze('2026-10-03', 9), repair(4)];
    assert.equal(coverOn3rd(repairFirst), 'repair');
    assert.equal(freezesHeld({ practiceDays, covers: repairFirst, today, entitled: true }), 2);
    // A travel cover the streak kept leaves the freeze unspent too.
    const trip = [travel(5), freeze('2026-10-03', 5)];
    assert.equal(coverOn3rd(trip), 'travel');
    assert.equal(freezesHeld({ practiceDays, covers: trip, today, entitled: true }), 2);

    // The freeze written first is the cover the streak shows, so that one is spent.
    const freezeFirst = [repair(9), freeze('2026-10-03', 4)];
    assert.equal(coverOn3rd(freezeFirst), 'freeze');
    assert.equal(freezesHeld({ practiceDays, covers: freezeFirst, today, entitled: true }), 1);
    assert.equal(nextFreezeReturn({ practiceDays, covers: freezeFirst, today, entitled: true }), '2026-10-10');

    // Whatever arrives, the freezes held are the cap less the days the streak shows a freeze on.
    for (const covers of [tie, repairFirst, trip, freezeFirst]) {
      const shown = monthFrom({ practiceDays, covers, today, year: 2026, month: 10 }).filter((cell) => cell.cover === 'freeze').length;
      assert.equal(freezesHeld({ practiceDays, covers, today, entitled: true }), FREEZE_CAP - shown);
    }
  });

  test('freezes held stay between none and two, however many covers there are', () => {
    const many = dayRange('2026-09-28', '2026-10-04').map((d) => freeze(d));
    assert.equal(freezesHeld({ practiceDays: [], covers: [...many, ...many], today: '2026-10-05', entitled: true }), 0);
    assert.equal(freezesHeld({ practiceDays: [], covers: [freeze('2026-10-04'), freeze('2026-10-04', 9)], today: '2026-10-05', entitled: true }), 1);
    // Repair and travel covers are not freezes and never use one up.
    const others: StreakCover[] = [
      { day: '2026-10-03', kind: 'repair', at: 0 },
      { day: '2026-10-04', kind: 'travel', at: 0 },
    ];
    assert.equal(freezesHeld({ practiceDays: [], covers: others, today: '2026-10-05', entitled: true }), 2);
  });
});
