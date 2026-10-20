import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { addDays, dayRange, type DayKey } from './dayKey.ts';
import { monthFrom, streakFrom, type StreakCover } from './streak.ts';
import { FREE_FREEZE_CAP, FREEZE_CAP, FREEZE_RETURN_DAYS, freezesHeld, freezesToApply, nextFreezeReturn } from './freeze.ts';
import { recentBreak, repairOffer } from './repair.ts';
import { travelCover } from './travel.ts';

process.env.TZ = 'Europe/Paris';

const freeze = (day: DayKey, at = 0): StreakCover => ({ day, kind: 'freeze', at });
/** Noon in Paris on a day, so a sitting's day key is never near a boundary. */
const noon = (day: DayKey) => Date.parse(`${day}T10:00:00Z`);

describe('repair and travel are a paid-plan perk; with no cap nothing freezes', () => {
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
    assert.equal(freezesHeld(FREEZE_CAP, paid), FREEZE_CAP);
    assert.deepEqual(freezesToApply(FREEZE_CAP, { ...paid, protectedSince: '2026-09-01' }), ['2026-10-04']);
    const repair = repairOffer({ ...paid, sittings });
    assert.ok(repair !== null && repair.ready, 'a subscriber can repair the gap');
    assert.equal(travelCover({ ...paid, ...travel }), '2026-10-04');

    const free = { ...base, entitled: false };
    // With no protection (cap 0, an unknown billing answer) no freeze is held or applied.
    assert.equal(freezesHeld(0, free), 0);
    assert.equal(nextFreezeReturn(0, { ...free, covers: [freeze('2026-10-04')] }), null);
    assert.deepEqual(freezesToApply(0, { ...free, protectedSince: '2026-09-01' }), []);
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
  const paid = { protectedSince: '2026-09-01' };

  test('a freeze covers a gap automatically only when it saves the whole run', () => {
    // One day away, two held: covered.
    assert.deepEqual(freezesToApply(FREEZE_CAP, { ...paid, practiceDays: run, covers: [], today: '2026-10-04' }), ['2026-10-03']);
    // Two days away, two held: both covered, and the run is whole again.
    const two = freezesToApply(FREEZE_CAP, { ...paid, practiceDays: run, covers: [], today: '2026-10-05' });
    assert.deepEqual(two, ['2026-10-03', '2026-10-04']);
    const covered = streakFrom({ practiceDays: run, covers: two.map((d) => freeze(d)), today: '2026-10-05' });
    assert.equal(covered.current, run.length, 'the covered days keep the run and add nothing');
    // Three days away is more than two freezes can save, so none is spent.
    assert.deepEqual(freezesToApply(FREEZE_CAP, { ...paid, practiceDays: run, covers: [], today: '2026-10-06' }), []);
    // Two days away with one freeze already in use (it covered the 30th): none is spent either.
    const withUsed = { practiceDays: run.filter((d) => d !== '2026-09-30'), covers: [freeze('2026-09-30')], today: '2026-10-05' };
    assert.equal(freezesHeld(FREEZE_CAP, withUsed), 1);
    assert.deepEqual(freezesToApply(FREEZE_CAP, { ...paid, ...withUsed }), []);
    // With the same single freeze, a one-day gap is still covered.
    assert.deepEqual(freezesToApply(FREEZE_CAP, { ...paid, ...withUsed, today: '2026-10-04' }), ['2026-10-03']);
    // Nothing to cover, nothing spent.
    assert.deepEqual(freezesToApply(FREEZE_CAP, { ...paid, practiceDays: run, covers: [], today: '2026-10-03' }), []);
  });

  test('a used freeze comes back seven days after the day it covered', () => {
    const covers = [freeze('2026-10-03')];
    const practiceDays = run;
    for (let d = 1; d < FREEZE_RETURN_DAYS; d += 1) {
      const today = addDays('2026-10-03', d);
      assert.equal(freezesHeld(FREEZE_CAP, { practiceDays, covers, today }), 1, `still in use ${d} days later`);
      assert.equal(nextFreezeReturn(FREEZE_CAP, { practiceDays, covers, today }), '2026-10-10');
    }
    const back = '2026-10-10';
    assert.equal(freezesHeld(FREEZE_CAP, { practiceDays, covers, today: back }), 2);
    assert.equal(nextFreezeReturn(FREEZE_CAP, { practiceDays, covers, today: back }), null);
  });

  test('a freeze on a day that turns out to be practised is refunded', () => {
    // Another device's practice on the 3rd arrived by sync after the freeze was written.
    const covers = [freeze('2026-10-03')];
    assert.equal(freezesHeld(FREEZE_CAP, { practiceDays: run, covers, today: '2026-10-05' }), 1);
    assert.equal(freezesHeld(FREEZE_CAP, { practiceDays: [...run, '2026-10-03'], covers, today: '2026-10-05' }), 2);
  });

  test('no freeze covers a day before the plan began, or a gap with no run before it', () => {
    // The plan began today: yesterday passed uncovered before it, and buying a plan does not cover it.
    assert.deepEqual(freezesToApply(FREEZE_CAP, { protectedSince: '2026-10-04', practiceDays: run, covers: [], today: '2026-10-04' }), []);
    assert.deepEqual(freezesToApply(FREEZE_CAP, { protectedSince: '2026-10-03', practiceDays: run, covers: [], today: '2026-10-04' }), ['2026-10-03']);
    // An unknown start (null) applies nothing; the gap waits for a real billing answer.
    assert.deepEqual(freezesToApply(FREEZE_CAP, { protectedSince: null, practiceDays: run, covers: [], today: '2026-10-04' }), []);
    // A learner with nothing before the gap has no run to keep.
    assert.deepEqual(freezesToApply(FREEZE_CAP, { ...paid, practiceDays: [], covers: [freeze('2026-10-01')], today: '2026-10-03' }), []);
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
    assert.equal(freezesHeld(FREEZE_CAP, { practiceDays, covers: tie, today }), 2);
    assert.equal(nextFreezeReturn(FREEZE_CAP, { practiceDays, covers: tie, today }), null);
    // The repair written first wins whatever order the list arrives in.
    const repairFirst = [freeze('2026-10-03', 9), repair(4)];
    assert.equal(coverOn3rd(repairFirst), 'repair');
    assert.equal(freezesHeld(FREEZE_CAP, { practiceDays, covers: repairFirst, today }), 2);
    // A travel cover the streak kept leaves the freeze unspent too.
    const trip = [travel(5), freeze('2026-10-03', 5)];
    assert.equal(coverOn3rd(trip), 'travel');
    assert.equal(freezesHeld(FREEZE_CAP, { practiceDays, covers: trip, today }), 2);

    // The freeze written first is the cover the streak shows, so that one is spent.
    const freezeFirst = [repair(9), freeze('2026-10-03', 4)];
    assert.equal(coverOn3rd(freezeFirst), 'freeze');
    assert.equal(freezesHeld(FREEZE_CAP, { practiceDays, covers: freezeFirst, today }), 1);
    assert.equal(nextFreezeReturn(FREEZE_CAP, { practiceDays, covers: freezeFirst, today }), '2026-10-10');

    // Whatever arrives, the freezes held are the cap less the days the streak shows a freeze on.
    for (const covers of [tie, repairFirst, trip, freezeFirst]) {
      const shown = monthFrom({ practiceDays, covers, today, year: 2026, month: 10 }).filter((cell) => cell.cover === 'freeze').length;
      assert.equal(freezesHeld(FREEZE_CAP, { practiceDays, covers, today }), FREEZE_CAP - shown);
    }
  });

  test('freezes held stay between none and two, however many covers there are', () => {
    const many = dayRange('2026-09-28', '2026-10-04').map((d) => freeze(d));
    assert.equal(freezesHeld(FREEZE_CAP, { practiceDays: [], covers: [...many, ...many], today: '2026-10-05' }), 0);
    assert.equal(freezesHeld(FREEZE_CAP, { practiceDays: [], covers: [freeze('2026-10-04'), freeze('2026-10-04', 9)], today: '2026-10-05' }), 1);
    // Repair and travel covers are not freezes and never use one up.
    const others: StreakCover[] = [
      { day: '2026-10-03', kind: 'repair', at: 0 },
      { day: '2026-10-04', kind: 'travel', at: 0 },
    ];
    assert.equal(freezesHeld(FREEZE_CAP, { practiceDays: [], covers: others, today: '2026-10-05' }), 2);
  });
});

describe('a free learner holds one freeze (D23)', () => {
  const run = dayRange('2026-09-20', '2026-10-02');
  const free = { protectedSince: '2026-09-01' };

  test('a free learner holds one, and it covers a single missed day', () => {
    assert.equal(FREE_FREEZE_CAP, 1);
    assert.equal(freezesHeld(FREE_FREEZE_CAP, { practiceDays: run, covers: [], today: '2026-10-04' }), 1);
    assert.deepEqual(freezesToApply(FREE_FREEZE_CAP, { ...free, practiceDays: run, covers: [], today: '2026-10-04' }), ['2026-10-03']);
    // Two days away is more than one freeze can save, so it is not spent.
    assert.deepEqual(freezesToApply(FREE_FREEZE_CAP, { ...free, practiceDays: run, covers: [], today: '2026-10-05' }), []);
  });

  test('a second missed day in the same week is not covered', () => {
    // The 3rd was frozen, the 4th to 6th practised, the 7th got away.
    const practiceDays = [...run, '2026-10-04', '2026-10-05', '2026-10-06'];
    const covers = [freeze('2026-10-03')];
    const input = { ...free, practiceDays, covers, today: '2026-10-08' };
    assert.equal(freezesHeld(FREE_FREEZE_CAP, input), 0);
    assert.deepEqual(freezesToApply(FREE_FREEZE_CAP, input), []);
    // A paid learner's second freeze would have covered it.
    assert.deepEqual(freezesToApply(FREEZE_CAP, input), ['2026-10-07']);
  });

  test('the used freeze returns seven days after the day it covered', () => {
    const covers = [freeze('2026-10-03')];
    for (let d = 1; d < FREEZE_RETURN_DAYS; d += 1) {
      const today = addDays('2026-10-03', d);
      assert.equal(freezesHeld(FREE_FREEZE_CAP, { practiceDays: run, covers, today }), 0, `still in use ${d} days later`);
      assert.equal(nextFreezeReturn(FREE_FREEZE_CAP, { practiceDays: run, covers, today }), '2026-10-10');
    }
    assert.equal(freezesHeld(FREE_FREEZE_CAP, { practiceDays: run, covers, today: '2026-10-10' }), 1);
    assert.equal(nextFreezeReturn(FREE_FREEZE_CAP, { practiceDays: run, covers, today: '2026-10-10' }), null);
  });

  test('never applied to a day before protection began', () => {
    const at = { practiceDays: run, covers: [], today: '2026-10-04' };
    assert.deepEqual(freezesToApply(FREE_FREEZE_CAP, { ...at, protectedSince: '2026-10-04' }), []);
    assert.deepEqual(freezesToApply(FREE_FREEZE_CAP, { ...at, protectedSince: null }), []);
    assert.deepEqual(freezesToApply(FREE_FREEZE_CAP, { ...at, protectedSince: '2026-10-03' }), ['2026-10-03']);
  });
});
