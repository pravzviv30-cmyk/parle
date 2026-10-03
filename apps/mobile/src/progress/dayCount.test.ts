import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lifetimeDayLine, weeklyDayLine } from './dayCount.ts';
import { mergeActiveDays } from './activeDays.ts';

test('a lifetime total has no zero, target, reset or penalty for a quiet week', () => {
 assert.equal(lifetimeDayLine([]), 'Your first day of French starts with practice.');
 assert.equal(lifetimeDayLine(['2026-01-01']), '1 day you have practised');
 assert.equal(lifetimeDayLine(['2026-01-01','2026-01-01','2026-02-02']), '2 days you have practised');
 assert.equal(weeklyDayLine(['2026-01-01'], new Date(2026,9,2,12).getTime()), null);
 assert.equal(lifetimeDayLine(['2026-01-01']), '1 day you have practised');
});
test('the weekly sentence uses local Monday boundaries and never counts a future date', () => {
 const days=['2026-09-27','2026-09-28','2026-10-02','2026-10-04','2026-10-05'];
 assert.equal(weeklyDayLine(days,new Date(2026,9,2,12).getTime()),'Practised on 2 days this week');
 assert.equal(weeklyDayLine(days,new Date(2026,9,5,12).getTime()),'Practised on 1 day this week');
 assert.deepEqual(mergeActiveDays([], ['2026-02-31','2026-09-31','2026-02-28','bad']),['2026-02-28']);
});
