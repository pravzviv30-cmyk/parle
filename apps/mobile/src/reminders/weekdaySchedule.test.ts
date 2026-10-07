/**
 * The native scheduler, run against a stand-in OS.
 *
 * `schedule.native.ts` cannot be imported here (it loads a native module), so
 * its two functions that talk to the OS are cut out of the source and run with
 * a fake `Notifications`. The weekday filter now lives in the plan (`plan.ts`):
 * what reaches the OS is one dated slot on each chosen day, and a re-plan
 * cancels only this app's own slots, by name.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

import { emptyLog, planReminders, type Calendar, type ReminderSlot } from './plan.ts';

const source = readFileSync(new URL('./schedule.native.ts', import.meta.url), 'utf8');

/** One function's source, from its declaration to the next top-level declaration. */
function cut(start: string, end: string): string {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `${start} is not in the native module`);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `${end} does not follow ${start}`);
  return source.slice(from, to).replace(/^export /, '');
}

const body = [
  cut('async function cancelOwn(', '/**'),
  cut('export async function schedulePlan(', '/** Take every pending reminder'),
].join('\n');

interface Request {
  identifier: string;
  content?: Record<string, unknown>;
  trigger?: Record<string, unknown>;
}

function scheduler(opts: { failAt?: number; held?: string[] } = {}) {
  const pending: Request[] = (opts.held ?? []).map((identifier) => ({ identifier }));
  const cancelled: string[] = [];
  let calls = 0;
  const notifications = {
    SchedulableTriggerInputTypes: { DATE: 'date' },
    getAllScheduledNotificationsAsync: async () => [...pending],
    cancelScheduledNotificationAsync: async (identifier: string) => {
      cancelled.push(identifier);
      const at = pending.findIndex((request) => request.identifier === identifier);
      if (at >= 0) pending.splice(at, 1);
    },
    cancelAllScheduledNotificationsAsync: async () => {
      throw new Error('cancel-all is never called');
    },
    scheduleNotificationAsync: async (request: Request) => {
      calls += 1;
      if (calls === opts.failAt) throw new Error('OS refused');
      pending.push(request);
    },
  };
  const run = new Function(
    'Notifications',
    'ensureReminderChannel',
    'REMINDER_CHANNEL_ID',
    'SLOT_PREFIX',
    `${stripTypeScriptTypes(body)}\nreturn schedulePlan;`,
  )(notifications, async () => {}, 'daily-reminder', 'practice:') as (slots: readonly ReminderSlot[]) => Promise<string>;
  return { run, pending, cancelled };
}

const UTC: Calendar = {
  dayOf: (at) => new Date(at).toISOString().slice(0, 10),
  minuteOf: (at) => new Date(at).getUTCHours() * 60 + new Date(at).getUTCMinutes(),
  at: (day, hour, minute) => Date.parse(`${day}T00:00:00Z`) + (hour * 60 + minute) * 60_000,
};

/** A plan for Wednesday 7 October 2026 at 9:00, evening reminders, on the chosen weekdays. */
function plan(days?: number[]): ReminderSlot[] {
  return planReminders({
    now: Date.UTC(2026, 9, 7, 9),
    calendar: UTC,
    choice: { enabled: true, time: 'evening', ...(days ? { days } : {}) },
    finishes: [],
    practiceDays: [],
    covers: [],
    tutor: 'Marie',
    log: emptyLog(),
  });
}

test('the chosen weekdays reach the OS as one dated slot each, and a re-plan replaces only its own', async () => {
  // Monday and Wednesday (Expo's 2 and 4): this Wednesday and next Monday, once each.
  const slots = plan([2, 4, 2, 0, 8]);
  assert.deepEqual(slots.map((slot) => slot.day), ['2026-10-07', '2026-10-12']);
  const s = scheduler({ held: ['practice:2026-10-01', 'billing:trial-ends'] });
  assert.equal(await s.run(slots), 'done');
  assert.deepEqual(s.cancelled, ['practice:2026-10-01'], 'a re-plan cancelled something that was not its own');
  assert.deepEqual(
    s.pending.map((request) => request.identifier),
    ['billing:trial-ends', 'practice:2026-10-07', 'practice:2026-10-12'],
  );
  for (const [index, slot] of slots.entries()) {
    const request = s.pending[index + 1]!;
    assert.deepEqual(request.trigger, { type: 'date', date: slot.at, channelId: 'daily-reminder' });
    assert.deepEqual(request.content, { title: slot.title, body: slot.body, data: { open: slot.open } });
  }
  // Every day, the default: one slot a day, never two.
  const daily = plan();
  const again = scheduler({ held: slots.map((slot) => slot.id) });
  assert.equal(await again.run(daily), 'done');
  const ids = again.pending.map((request) => request.identifier);
  assert.equal(new Set(ids).size, ids.length, 'one day holds two reminders');
  assert.deepEqual(ids, daily.map((slot) => slot.id));
  // An empty plan (off, or paused) leaves nothing of ours behind.
  const off = scheduler({ held: ids });
  assert.equal(await off.run([]), 'done');
  assert.deepEqual(off.pending, []);
});

test('a partial OS failure cancels every partial schedule and reports failure', async () => {
  const s = scheduler({ failAt: 2, held: ['billing:trial-ends'] });
  assert.equal(await s.run(plan()), 'failed');
  assert.deepEqual(
    s.pending.map((request) => request.identifier),
    ['billing:trial-ends'],
    'a refusal part way left half a plan the app does not know about',
  );
});
