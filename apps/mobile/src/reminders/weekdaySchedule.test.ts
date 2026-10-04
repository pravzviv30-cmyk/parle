import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { reminderTime } from './reminder.ts';
const source = readFileSync(new URL('./schedule.native.ts', import.meta.url), 'utf8');
const start = source.indexOf('export async function scheduleReminder(');
const body = source.slice(start, source.indexOf('/** Take the reminder', start)).replace('export ', '');
function scheduler(failAt = 0) {
  const scheduled: Record<string, unknown>[] = []; let cancellations = 0;
  const notifications = { SchedulableTriggerInputTypes: { WEEKLY: 'weekly', DAILY: 'daily' }, cancelAllScheduledNotificationsAsync: async () => { cancellations++; }, scheduleNotificationAsync: async (value: Record<string, unknown>) => { scheduled.push(value); if (scheduled.length === failAt) throw Error('OS refused'); } };
  const run = new Function('Notifications', 'reminderTime', 'ensureReminderChannel', 'reminderContent', 'REMINDER_CHANNEL_ID', stripTypeScriptTypes(body) + '\nreturn scheduleReminder;')(notifications, reminderTime, async () => {}, () => ({title:'Luvani'}), 'reminder') as (time: string, days?: number[]) => Promise<string>;
  return { run, scheduled, cancellations: () => cancellations };
}
test('selected weekdays repeat once each at the selected time, preserving legacy daily behavior', async () => {
  const s = scheduler(); assert.equal(await s.run('evening', [2,4,6,2,0,8]), 'done');
  assert.deepEqual(s.scheduled.map(v => v.trigger), [2,4,6].map(weekday => ({ type:'weekly', weekday, channelId:'reminder', hour:reminderTime('evening').hour, minute:reminderTime('evening').minute })));
  const legacy = scheduler(); assert.equal(await legacy.run('evening'), 'done'); assert.equal((legacy.scheduled[0]?.trigger as {type:string}).type, 'daily');
});
test('a partial OS failure cancels every partial schedule and reports failure', async () => {
  const s = scheduler(2); assert.equal(await s.run('evening', [2,4,6]), 'failed'); assert.equal(s.cancellations(), 2); assert.equal(s.scheduled.length, 2);
});
