import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { addDays, type DayKey } from './dayKey.ts';
import { monthFrom, streakFrom, type StreakCover } from './streak.ts';
import { FREE_FREEZE_CAP, FREEZE_CAP, FREEZE_RETURN_DAYS, doublePracticeDays, freezeBanked, freezeCoverDays, freezesHeld, freezesToApply, nextFreezeReturn } from './freeze.ts';
import { localDayKey } from '../levels/levels.ts';
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
  const run = Array.from({ length: 13 }, (_, i) => addDays('2026-09-20', i));
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
    const many = Array.from({ length: 7 }, (_, i) => addDays('2026-09-28', i)).map((d) => freeze(d));
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
  const run = Array.from({ length: 13 }, (_, i) => addDays('2026-09-20', i));
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

describe('freezeCoverDays: the one freeze rule settle and the reminder share (T1.2)', () => {
  // settle.ts's branch before the move, kept here so the two can never drift.
  const oldBranch = (cap: number, paidSince: DayKey | null, protectedSince: DayKey | null, input: { practiceDays: DayKey[]; covers: StreakCover[]; today: DayKey }) => {
    const paid = cap >= FREEZE_CAP;
    const both = paid ? freezesToApply(cap, { ...input, protectedSince: paidSince }) : [];
    return both.length > 0 ? both : freezesToApply(Math.min(cap, FREE_FREEZE_CAP), { ...input, protectedSince });
  };

  test('gives the same days as settle gave, across caps, start days and gaps', () => {
    const run = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
    const starts: (DayKey | null)[] = [null, '2026-09-01', '2026-10-05', '2026-10-06'];
    let checked = 0;
    for (const cap of [0, FREE_FREEZE_CAP, FREEZE_CAP]) {
      for (const paidSince of starts) {
        for (const protectedSince of starts) {
          for (const gapDays of [0, 1, 2, 3]) {
            const today = addDays('2026-10-04', gapDays + 1);
            const input = { practiceDays: run, covers: [] as StreakCover[], today };
            assert.deepEqual(freezeCoverDays({ cap, paidSince, protectedSince }, input), oldBranch(cap, paidSince, protectedSince, input));
            checked += 1;
          }
        }
      }
    }
    assert.equal(checked, 192);
  });

  test('a paid plan covers two days; a free learner covers one; nothing covers before its start', () => {
    const input = { practiceDays: ['2026-10-01', '2026-10-02', '2026-10-03'], covers: [] as StreakCover[] };
    assert.deepEqual(freezeCoverDays({ cap: FREEZE_CAP, paidSince: '2026-09-01', protectedSince: '2026-09-01' }, { ...input, today: '2026-10-06' }), ['2026-10-04', '2026-10-05']);
    assert.deepEqual(freezeCoverDays({ cap: FREE_FREEZE_CAP, paidSince: null, protectedSince: '2026-09-01' }, { ...input, today: '2026-10-05' }), ['2026-10-04']);
    assert.deepEqual(freezeCoverDays({ cap: FREE_FREEZE_CAP, paidSince: null, protectedSince: '2026-09-01' }, { ...input, today: '2026-10-06' }), []);
    assert.deepEqual(freezeCoverDays({ cap: FREE_FREEZE_CAP, paidSince: null, protectedSince: '2026-10-05' }, { ...input, today: '2026-10-05' }), []);
  });
});

describe('a banked freeze: two practices in one day earn one above the cap (F5)', () => {
  // Practised 20 September to 2 October.
  const run = Array.from({ length: 13 }, (_, i) => addDays('2026-09-20', i));
  const since = '2026-09-01';

  test('two finished practices in a day bank one freeze above the cap, and never a second', () => {
    const sittings = [{ at: noon('2026-10-01') }, { at: noon('2026-10-01') + 600_000 }, { at: noon('2026-10-02') }, { at: noon('2026-09-25') }, { at: noon('2026-09-25') + 1 }, { at: noon('2026-09-25') + 2 }];
    assert.deepEqual(doublePracticeDays(sittings, localDayKey), ['2026-09-25', '2026-10-01']);
    assert.deepEqual(doublePracticeDays([{ at: noon('2026-10-02') }], localDayKey), []);

    const input = { practiceDays: run, covers: [] as StreakCover[], today: '2026-10-03', bankDays: ['2026-10-01'] };
    assert.equal(freezeBanked(input), true);
    assert.equal(freezesHeld(FREEZE_CAP, input), FREEZE_CAP + 1);
    assert.equal(freezesHeld(FREE_FREEZE_CAP, input), FREE_FREEZE_CAP + 1);
    // A second two-practice day still banks only the one.
    const twice = { ...input, bankDays: ['2026-09-25', '2026-10-01'] };
    assert.equal(freezesHeld(FREEZE_CAP, twice), FREEZE_CAP + 1);
    // No bank days, or none given, holds exactly what it held before.
    assert.equal(freezeBanked({ ...input, bankDays: [] }), false);
    assert.equal(freezesHeld(FREEZE_CAP, { practiceDays: run, covers: [], today: '2026-10-03' }), FREEZE_CAP);
    // A day after today is not lived yet, and banks nothing.
    assert.equal(freezeBanked({ ...input, bankDays: ['2026-10-04'] }), false);
  });

  test("a banked freeze is spent before the plan's own and is earned again only a week after the day it covered", () => {
    // Banked on the 1st; the 3rd got away and a freeze covered it.
    const covered = { practiceDays: run, covers: [freeze('2026-10-03')], bankDays: ['2026-10-01'] };
    const now = { ...covered, today: '2026-10-04' };
    assert.equal(freezeBanked(now), false, 'the bank paid for the 3rd');
    assert.equal(freezesHeld(FREEZE_CAP, now), FREEZE_CAP, "the plan's own two are untouched");
    assert.equal(freezesHeld(FREE_FREEZE_CAP, now), FREE_FREEZE_CAP);
    assert.equal(nextFreezeReturn(FREEZE_CAP, now), null, 'a spent bank does not come back on a timer');

    // Two practices on the 9th, six days after the day it covered, bank nothing.
    const later = [...run, ...Array.from({ length: 8 }, (_, i) => addDays('2026-10-04', i))];
    const sixDays = { ...covered, practiceDays: later, bankDays: ['2026-10-01', '2026-10-09'], today: '2026-10-11' };
    assert.equal(freezeBanked(sixDays), false);
    assert.equal(freezesHeld(FREEZE_CAP, sixDays), FREEZE_CAP);
    // Two practices on the 10th, a week after, bank one again.
    const aWeek = { ...sixDays, bankDays: ['2026-10-01', '2026-10-09', '2026-10-10'] };
    assert.equal(freezeBanked(aWeek), true);
    assert.equal(freezesHeld(FREEZE_CAP, aWeek), FREEZE_CAP + 1);

    // A free learner with a bank covers a two-day gap: the bank pays the first day, the plan's own the second.
    const gap = { practiceDays: run, covers: [] as StreakCover[], today: '2026-10-05', bankDays: ['2026-10-01'] };
    const days = freezesToApply(FREE_FREEZE_CAP, { ...gap, protectedSince: since });
    assert.deepEqual(days, ['2026-10-03', '2026-10-04']);
    assert.deepEqual(freezeCoverDays({ cap: FREE_FREEZE_CAP, paidSince: null, protectedSince: since }, gap), days);
    const spent = { ...gap, covers: days.map((d) => freeze(d)) };
    assert.equal(freezesHeld(FREE_FREEZE_CAP, spent), 0);
    assert.equal(freezeBanked(spent), false);
    assert.equal(nextFreezeReturn(FREE_FREEZE_CAP, spent), '2026-10-11', "only the plan's own freeze comes back");
    // Without the bank the same gap is more than one freeze can save.
    assert.deepEqual(freezesToApply(FREE_FREEZE_CAP, { ...gap, bankDays: [], protectedSince: since }), []);
  });

  test('a second practice today never banks a freeze for a day already gone', () => {
    // The 3rd and 4th got away; today, the 5th, two practices finished.
    const today = { practiceDays: [...run, '2026-10-05'], covers: [] as StreakCover[], today: '2026-10-05', bankDays: ['2026-10-05'] };
    assert.equal(freezesHeld(FREE_FREEZE_CAP, today), FREE_FREEZE_CAP + 1, 'it is banked for the days ahead');
    assert.deepEqual(freezesToApply(FREE_FREEZE_CAP, { ...today, protectedSince: since }), []);
    assert.deepEqual(freezeCoverDays({ cap: FREE_FREEZE_CAP, paidSince: null, protectedSince: since }, today), []);

    // With the plan's own freeze in use, yesterday stays uncovered after two practices today.
    const inUse = {
      practiceDays: [...run.filter((d) => d !== '2026-09-30'), '2026-10-04'],
      covers: [freeze('2026-09-30')],
      today: '2026-10-04',
      bankDays: ['2026-10-04'],
    };
    assert.equal(freezesHeld(FREE_FREEZE_CAP, inUse), 1);
    assert.deepEqual(freezesToApply(FREE_FREEZE_CAP, { ...inUse, protectedSince: since }), []);
    assert.deepEqual(freezeCoverDays({ cap: FREEZE_CAP, paidSince: null, protectedSince: since }, inUse), []);
  });

  test('a banked freeze never covers a day before protection began, and an unknown plan holds none', () => {
    // Banked on the 1st, the 3rd got away; protection began today, the 4th.
    const input = { practiceDays: run, covers: [] as StreakCover[], today: '2026-10-04', bankDays: ['2026-10-01'] };
    assert.deepEqual(freezesToApply(FREE_FREEZE_CAP, { ...input, protectedSince: '2026-10-04' }), []);
    assert.deepEqual(freezesToApply(FREE_FREEZE_CAP, { ...input, protectedSince: null }), []);
    assert.deepEqual(freezeCoverDays({ cap: FREE_FREEZE_CAP, paidSince: null, protectedSince: '2026-10-04' }, input), []);
    assert.deepEqual(freezeCoverDays({ cap: FREEZE_CAP, paidSince: '2026-10-04', protectedSince: '2026-10-04' }, input), []);
    // An unknown plan (cap 0) holds none, applies none, and has nothing coming back.
    assert.equal(freezesHeld(0, input), 0);
    assert.deepEqual(freezesToApply(0, { ...input, protectedSince: since }), []);
    assert.deepEqual(freezeCoverDays({ cap: 0, paidSince: since, protectedSince: since }, input), []);
    assert.equal(nextFreezeReturn(0, { ...input, covers: [freeze('2026-10-03')] }), null);
  });
});
