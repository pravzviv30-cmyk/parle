import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { addDays, checkStarter, starterTasks, type DayKey } from '@luvani/core';
import { finishGuestPractice, guestPracticeDays, type GuestPractice } from '../guestModel.ts';
import { guestStreak } from '../guestProgress.ts';
import { freshPreAccountDraft } from '../preAccountDraft.ts';
import { streakCelebrationView } from './streakCelebrationView.ts';

const view = (days: readonly DayKey[], today: DayKey, locale = 'en-GB') => streakCelebrationView(guestStreak(days, today), today, locale);

describe('the finished-practice streak celebration', () => {
  test('no finish, a lapsed run and future-only records never claim that a streak started', () => {
    for (const days of [[], ['2026-10-08'], ['2026-10-11']]) assert.equal(view(days, '2026-10-10'), null);
  });

  test('the first day has one counted day, its real Saturday achievement, and six neutral upcoming days', () => {
    const result = view(['2026-10-10'], '2026-10-10')!;
    assert.equal(result.headline, 'Your streak has started.');
    assert.equal(result.summary, 'Your streak has started today');
    assert.equal(result.countLabel, '1-day streak');
    assert.equal(result.eventKey, 'streak:2026-10-10');
    assert.equal(result.variant, 'first');
    assert.deepEqual(result.week.map(cell => cell.label), ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    assert.deepEqual(result.week.filter(cell => cell.completed).map(cell => cell.day), ['2026-10-10']);
    assert.deepEqual(result.week.slice(1).map(cell => cell.state), Array(6).fill('ahead'));
    assert.equal(result.week[0]!.accessibilityLabel, 'Saturday, 10 October 2026, today. Practice completed.');
    assert.equal(result.week[1]!.accessibilityLabel, 'Sunday, 11 October 2026. Upcoming, not completed.');
    assert.deepEqual(result.nextMilestone, { days: 3, remaining: 2, title: 'Next milestone: 3 days', line: '2 more days to go' });
  });

  test('reopening the next day preserves the achievement and labels the open today without claiming completion', () => {
    const result = view(['2026-10-10'], '2026-10-11')!;
    assert.equal(result.achievementDay, '2026-10-10');
    assert.equal(result.summary, 'Your streak started yesterday');
    assert.equal(result.week[0]!.completed, true);
    assert.equal(result.week[0]!.isToday, false);
    assert.equal(result.week[1]!.day, '2026-10-11');
    assert.equal(result.week[1]!.state, 'today-open');
    assert.equal(result.week[1]!.accessibilityLabel, 'Sunday, 11 October 2026, today. Ready to practise.');
    assert.equal(result.eventKey, view(['2026-10-10'], '2026-10-10')!.eventKey);
  });

  test('longer runs use their real count, existing milestone targets and a reusable celebration variant', () => {
    for (const current of [2, 3, 7, 30, 100, 365, 730]) {
      const today = '2026-10-10';
      const days = Array.from({ length: current }, (_, index) => addDays(today, -index));
      const result = view([...days, today, 'not-a-day', '2099-01-01'], today)!;
      assert.equal(result.current, current);
      assert.equal(result.countLabel, `${current}-day streak`);
      assert.equal(result.headline, 'Your streak continues.');
      assert.equal(result.summary, 'Your streak continued today');
      assert.equal(result.nextMilestone.remaining, result.nextMilestone.days - current);
      assert.ok(result.nextMilestone.remaining > 0);
      assert.equal(result.variant, [7, 30, 100, 365, 730].includes(current) ? 'milestone' : 'daily');
    }
    assert.equal(view(['2026-10-09', '2026-10-10'], '2026-10-10')!.nextMilestone.line, '1 more day to go');
    assert.equal(view(['2026-10-08', '2026-10-09', '2026-10-10'], '2026-10-10')!.nextMilestone.days, 7);
  });

  test('calendar arithmetic crosses a year, leap day and daylight saving without duplicate or skipped dates', () => {
    for (const achievement of ['2026-12-31', '2028-02-28', '2026-03-28', '2026-10-24']) {
      const result = view([achievement], achievement)!;
      assert.deepEqual(result.week.map(cell => cell.day), Array.from({ length: 7 }, (_, index) => addDays(achievement, index)));
      assert.equal(new Set(result.week.map(cell => cell.day)).size, 7);
      assert.equal(result.week.filter(cell => cell.isToday).length, 1);
    }
    assert.equal(view(['2026-12-31'], '2026-12-31')!.week[1]!.day, '2027-01-01');
    assert.equal(view(['2028-02-28'], '2028-02-28')!.week[1]!.day, '2028-02-29');
    assert.equal(view(['2028-02-28'], '2028-02-28')!.week[2]!.day, '2028-03-01');
  });

  test('weekday abbreviations and full accessible dates follow the selected locale without changing the local achievement date', () => {
    const result = view(['2026-10-10'], '2026-10-10', 'de-DE')!;
    assert.equal(result.week[0]!.label, new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'UTC' }).format(new Date('2026-10-10T12:00:00Z')));
    assert.match(result.week[0]!.accessibilityLabel, /Samstag, 10\. Oktober 2026/);
    assert.equal(result.week[0]!.day, '2026-10-10');
    assert.match(result.week[0]!.accessibilityLabel, /Practice completed/);
  });

  test('formatting and retrying the same qualifying event do not change its day, count or animation key', () => {
    const at = Date.UTC(2026, 9, 10, 23, 30);
    // The app supplies its established day rule. This local calendar is already
    // Sunday, even though the persisted instant is still Saturday in UTC.
    const dayOf = (_instant: number): DayKey => '2026-10-11';
    const plan = { ...freshPreAccountDraft(), eligibilityConfirmed: true, reason: 'food' as const, drink: 'coffee' as const, minutes: 5 as const };
    const task = starterTasks(plan.reason, plan.drink, plan.minutes)[0]!;
    const guest: GuestPractice = {
      version: 2, token: null, id: null, expiresAt: at + 1000, secondsUsed: 5, speechAvailable: false, kept: false, completed: false, plan,
      attempts: [{ taskId: task.id, reply: task.model, feedback: checkStarter(task, task.model, 'typed'), at, offline: true }],
    };
    assert.equal(guestStreak(guestPracticeDays(guest, dayOf), dayOf(at)), null);
    const finished = finishGuestPractice(guest, at, dayOf);
    const snapshot = JSON.stringify(finished);
    const first = view(guestPracticeDays(finished, dayOf), dayOf(at))!;
    for (let render = 0; render < 5; render += 1) {
      assert.deepEqual(view(guestPracticeDays(finished, dayOf), dayOf(at)), first);
      assert.equal(JSON.stringify(finished), snapshot);
    }
    const retried = finishGuestPractice(finished, at + 1000, dayOf);
    assert.deepEqual(view(guestPracticeDays(retried, dayOf), dayOf(at)), first);
    assert.equal(first.achievementDay, '2026-10-11');
    assert.equal(first.week[0]!.label, 'Sun');
    assert.equal(first.eventKey, 'streak:2026-10-11');
    assert.equal(first.current, 1);
  });
});
