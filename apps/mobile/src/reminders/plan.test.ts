/**
 * The one reminder planner, run across days (Come alive, README Part 5.F;
 * F771, which supersedes F226, F227 and F230 by founder decision D2).
 *
 * The planner is pure, so it is run rather than read: a fixed UTC calendar, a
 * morning, an evening, a week of days with and without practice. Where a rule
 * lives in the native module (one dated slot per day, nothing that repeats,
 * per-id cancels), that file is read, because node cannot load it.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TUTOR_VOICES, addDays } from '@luvani/core';

import { guiltIn, streakGuiltIn } from '../copy/guilt.ts';
import { reminderOpenOf, routeForReminder } from './openTarget.ts';
import {
  PLAN_DAYS,
  UNANSWERED_LIMIT,
  closeLog,
  emptyLog,
  heldLog,
  noteAnswered,
  noteOpened,
  planReminders,
  plannedLog,
  plannedSlots,
  replanStep,
  settleLog,
  slotDay,
  smartTime,
  unansweredRun,
  type Calendar,
  type PlanInput,
  type ReminderLog,
  type ReminderSlot,
} from './plan.ts';
import { MILESTONE_EVE_LINE, PAUSE_LINE, REMINDER_COPY, REMINDER_LINES, ROUTINE_LINES, STREAK_LINES } from './reminder.ts';

/** A calendar with no time zone, so every day is 24 hours and the test reads the same anywhere. */
const UTC: Calendar = {
  dayOf: (at) => new Date(at).toISOString().slice(0, 10),
  minuteOf: (at) => {
    const d = new Date(at);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  },
  at: (day, hour, minute) => {
    const [y, m, d] = day.split('-').map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d, hour, minute);
  },
};

const TODAY = '2026-10-07';
const at = (day: string, hour: number, minute = 0): number => UTC.at(day, hour, minute);
const day = (offset: number): string => addDays(TODAY, offset);

function input(over: Partial<PlanInput> = {}): PlanInput {
  return {
    now: at(TODAY, 9),
    calendar: UTC,
    choice: { enabled: true, time: 'evening' },
    finishes: [],
    practiceDays: [],
    covers: [],
    tutor: 'Céline',
    log: emptyLog(),
    ...over,
  };
}

/** The log as the planner leaves it once the OS took `slots`. */
function logged(log: ReminderLog, slots: readonly ReminderSlot[]): ReminderLog {
  return { ...log, slots: plannedSlots(slots) };
}

/** Read without comments, so prose can name what code may not call. */
function code(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('the reminder planner — F771', () => {
  test('a reminder is skipped on a day already practised, at most one a day, and pauses after four unanswered', () => {
    // Not practised yet today, at 9:00, an evening reminder: today first.
    const fresh = planReminders(input());
    assert.equal(fresh[0]?.day, TODAY, 'an unpractised today has no reminder');
    assert.equal(fresh[0]?.at, at(TODAY, 18));

    // At most one a day: one slot per day, each named for its day, so a second
    // plan for that day replaces the first rather than joining it.
    const days = fresh.map((slot) => slot.day);
    assert.equal(new Set(days).size, days.length, 'two reminders on one day');
    assert.deepEqual(days, [...days].sort(), 'the slots are not in day order');
    for (const slot of fresh) {
      assert.equal(slot.id, `practice:${slot.day}`);
      assert.equal(slotDay(slot.id), slot.day);
    }
    assert.ok(fresh.every((slot) => slot.day <= day(PLAN_DAYS - 1)), 'a slot beyond the seven-day window');

    // Practised today: no reminder today, whatever the hour; the next is tomorrow.
    const practised = planReminders(input({ practiceDays: [TODAY], finishes: [at(TODAY, 8)] }));
    assert.ok(!practised.some((slot) => slot.day === TODAY), 'a reminder on a day already practised');
    assert.equal(practised[0]?.day, day(1));
    // A finish later the same day re-plans and takes today's away.
    const later = planReminders(input({ now: at(TODAY, 17), practiceDays: [TODAY] }));
    assert.ok(!later.some((slot) => slot.day === TODAY));
    // Today's time already gone, or today's practice unreadable: nothing today.
    assert.ok(!planReminders(input({ now: at(TODAY, 19) })).some((slot) => slot.day === TODAY));
    assert.ok(!planReminders(input({ todayUnknown: true })).some((slot) => slot.day === TODAY), 'an unreadable practice record risked a reminder on a practised day');
    // Off, or paused: nothing at all.
    assert.deepEqual(planReminders(input({ choice: { enabled: false, time: 'evening' } })), []);
    assert.deepEqual(planReminders(input({ choice: { enabled: true, time: 'evening', paused: true } })), []);

    // Four unanswered, then the note, then silence. A learner who never comes
    // back gets exactly four reminders and the kind note in the fifth slot.
    assert.equal(fresh.length, UNANSWERED_LIMIT + 1);
    assert.deepEqual(fresh.map((slot) => slot.pause), [false, false, false, false, true]);
    const note = fresh[UNANSWERED_LIMIT]!;
    assert.equal(note.title, PAUSE_LINE.title({ n: 0, lifetime: 0, tutor: 'Céline' }));
    assert.equal(note.open, 'settings', 'the pause note does not open where it can be turned back on');

    // The four arrive and nobody answers. A re-plan that is not a visit (the
    // app leaving the screen) leaves exactly one slot: the note, and nothing after.
    let log = logged(emptyLog(), fresh);
    const afterFour = settleLog(log, at(day(3), 19));
    assert.equal(afterFour.pauseSent, false);
    assert.deepEqual(afterFour.log.sent, [TODAY, day(1), day(2), day(3)]);
    assert.equal(unansweredRun(afterFour.log, [], day(3)), UNANSWERED_LIMIT);
    const last = planReminders(input({ now: at(day(3), 19), log: afterFour.log }));
    assert.equal(last.length, 1, 'more than the pause note was planned after four unanswered');
    assert.equal(last[0]?.pause, true);
    assert.equal(last[0]?.day, day(4));
    // Once the note has gone out, the reminder pauses: nothing until it is turned on again.
    log = logged(afterFour.log, last);
    const paused = settleLog(log, at(day(4), 19));
    assert.equal(paused.pauseSent, true, 'the note went out and nothing paused');
    assert.deepEqual(planReminders(input({ now: at(day(4), 19), log: paused.log, choice: { enabled: true, time: 'evening', paused: true } })), []);

    // Anything answers: a practice, a tap, or a visit after the reminder came.
    // Each starts the count again, and the full window comes back.
    for (const answered of [
      { practiceDays: [day(3)] },
      { log: noteAnswered(afterFour.log, day(3)) },
      { log: noteOpened(afterFour.log, at(day(3), 19), UTC) },
    ]) {
      const next = { now: at(day(3), 19), log: afterFour.log, ...answered };
      const again = planReminders(input(next));
      assert.equal(again.length, UNANSWERED_LIMIT + 1, 'an answered reminder still counted towards the pause');
      assert.equal(again.filter((slot) => slot.pause).length, 1);
    }
    // Only the reminders since the last answer count: a tap two days ago leaves one unanswered.
    assert.equal(unansweredRun(noteAnswered(afterFour.log, day(2)), [], day(3)), 1);
    assert.equal(planReminders(input({ now: at(day(3), 19), log: noteAnswered(afterFour.log, day(2)) })).length, UNANSWERED_LIMIT);
    // A visit before today's reminder arrives says nothing about it.
    const before = noteOpened(logged(emptyLog(), fresh), at(TODAY, 12), UTC);
    assert.deepEqual(before.opened, [], 'a morning visit answered the evening reminder');
    assert.deepEqual(noteOpened(settleLog(logged(emptyLog(), fresh), at(TODAY, 19)).log, at(TODAY, 19), UTC).opened, [TODAY]);
    // But it does answer every reminder that has already arrived: two ignored
    // evenings and a lunchtime visit on the third day leave nothing unanswered.
    const twoIgnored = settleLog(logged(emptyLog(), fresh), at(day(2), 12)).log;
    assert.equal(unansweredRun(twoIgnored, [], day(2)), 2);
    const visited = noteOpened(twoIgnored, at(day(2), 12), UTC);
    assert.equal(unansweredRun(visited, [], day(2)), 0, 'a visit after two reminders left them unanswered');
    assert.ok(!visited.opened.includes(day(2)), "a visit before today's reminder answered it");

    // The chosen weekdays (1 Sunday to 7 Saturday): one dated slot on each, none between.
    const weekdays = planReminders(input({ choice: { enabled: true, time: 'evening', days: [2, 4] } }));
    for (const slot of weekdays) assert.ok([2, 4].includes(((new Date(`${slot.day}T00:00:00Z`).getUTCDay() + 7) % 7) + 1), `a reminder on ${slot.day}, which was not chosen`);
    assert.equal(weekdays.length, 2, 'the chosen weekdays in a week were not each reminded once');

    // The OS holds exactly what the plan says: one scheduling call, a dated
    // one-off per slot, named for its day; nothing that repeats; and only this
    // app's own slots are ever cancelled, one at a time.
    const native = code('./schedule.native.ts');
    assert.equal((native.match(/scheduleNotificationAsync\(/g) ?? []).length, 1, 'more than one way to schedule a reminder');
    assert.match(native, /identifier: slot\.id/, 'a slot is scheduled without its day in its name, so a second plan adds rather than replaces');
    assert.match(native, /type: Notifications\.SchedulableTriggerInputTypes\.DATE, date: slot\.at/, 'the slot is not a dated one-off at the time the plan chose');
    assert.doesNotMatch(native, /SchedulableTriggerInputTypes\.(?:DAILY|WEEKLY|CALENDAR|MONTHLY|YEARLY|TIME_INTERVAL)|\brepeats\b/, 'a repeating trigger cannot skip a practised day');
    assert.doesNotMatch(native, /cancelAllScheduledNotificationsAsync/, 'a re-plan sweeps away notifications that are not its own');
    assert.match(native, /request\.identifier\.startsWith\(SLOT_PREFIX\)\) await Notifications\.cancelScheduledNotificationAsync\(request\.identifier\)/);
    assert.match(native, /const SLOT_PREFIX = 'practice:';/);
    // No clock in the planner or the native module: every instant is handed in.
    for (const source of [code('./plan.ts'), native]) {
      assert.doesNotMatch(source, /Date\.now|performance\.now|new Date\(\)|setTimeout|setInterval/, 'the plan reads a clock of its own');
    }
  });

  test('a reminder names the chosen tutor and opens the place it promises', () => {
    // Every voice, every kind of day: the tutor the learner chose is named.
    const histories: Partial<PlanInput>[] = [
      {},
      { practiceDays: [day(-1)] },
      { practiceDays: [day(-2), day(-1), TODAY] },
      { practiceDays: [day(-5), day(-4), day(-3), day(-2), day(-1), TODAY] },
      { practiceDays: [day(-9)] },
      { practiceDays: [day(-1)], choice: { enabled: true, time: 'evening', mentionStreak: false } },
    ];
    for (const voice of Object.values(TUTOR_VOICES)) {
      const tutor = voice.persona.name;
      for (const history of histories) {
        for (const guest of [false, true]) {
          for (const slot of planReminders(input({ ...history, tutor, guest }))) {
            assert.ok(`${slot.title} ${slot.body}`.includes(tutor), `"${slot.title} / ${slot.body}" does not name ${tutor}`);
          }
        }
      }
    }

    // Every line is warm, plain and clean, and states only the learner's own counts.
    assert.ok(REMINDER_COPY.length > 40, 'the copy list is too short to be every line');
    for (const line of REMINDER_COPY) {
      assert.equal(guiltIn(line), undefined, `guilt in reminder copy: ${line}`);
      assert.equal(streakGuiltIn(line), undefined, `a streak nag in reminder copy: ${line}`);
      assert.doesNotMatch(line, /[—–·!]/, `a dash, a middot or a shout in reminder copy: ${line}`);
      assert.doesNotMatch(line, /in a row|yesterday/i, `a run read as unbroken days, or a day gone by: ${line}`);
    }

    // Each line opens what it promises: a line about today's phrase opens
    // today's phrase, the pause note opens Settings, and the rest open Home.
    for (const line of REMINDER_LINES) {
      const words = `${line.title({ n: 3, lifetime: 3, tutor: 'Marie' })} ${line.body({ n: 3, lifetime: 3, tutor: 'Marie' })}`;
      const expected = /phrase/i.test(words) ? 'daily-phrase' : line.id === 'pause' ? 'settings' : 'home';
      assert.equal(line.open, expected, `"${words}" opens ${line.open}`);
    }
    assert.deepEqual(routeForReminder('daily-phrase', 'phrase-123'), { name: 'DailyPractice', params: { id: 'phrase-123' } });
    assert.deepEqual(routeForReminder('daily-phrase', null), { name: 'Tabs', params: { screen: 'Home' } }, 'a phrase line opened a phrase that is not today\'s');
    assert.deepEqual(routeForReminder('settings', 'phrase-123'), { name: 'Settings' });
    assert.deepEqual(routeForReminder('home', 'phrase-123'), { name: 'Tabs', params: { screen: 'Home' } });
    assert.equal(reminderOpenOf('somewhere'), 'home');
    assert.equal(reminderOpenOf(undefined), 'home');
    for (const slot of planReminders(input({ practiceDays: [day(-2), day(-1)] }))) {
      assert.ok(['home', 'daily-phrase', 'settings'].includes(slot.open));
    }

    // The slot carries where it opens; a tap hands that on with the slot's
    // name, the launch tap included; the app follows it once the navigator is
    // ready, to the phrase Home shows today.
    const native = code('./schedule.native.ts');
    assert.match(native, /content: \{ title: slot\.title, body: slot\.body, data: \{ open: slot\.open \} \}/);
    assert.match(native, /Notifications\.addNotificationResponseReceivedListener\(take\)/);
    assert.match(native, /const launch = Notifications\.getLastNotificationResponse\(\);/, 'a tap that launched the app from cold goes nowhere');
    assert.match(native, /handler\(typeof open === 'string' \? open : 'home', request\.identifier\)/);
    const app = code('../../App.tsx');
    assert.match(app, /useReminderTaps\(navigationRef\);/);
    // The phrase is the one Home shows: the same pool, at the same standing, for today.
    assert.match(code('./todayPhrase.ts'), /return todayItems\(levelFor\(totalXp\(facts\.activity\)\)\.index, now\)\.phrase\.id;/, 'the phrase a reminder opens is not picked the way Home picks it');
    const planner = code('./ReminderPlanner.tsx');
    assert.match(planner, /todayPhraseId\(Date\.now\(\)\)/, 'the phrase is worked out before the tap rather than at it');
    assert.match(planner, /pending\.current = routeForReminder\(target, phraseId\);/);
    assert.match(planner, /useEffect\(\(\) => navigation\.addListener\('ready', follow\), \[navigation, follow\]\);/, 'a launch tap is never followed once the navigator is ready');
    assert.match(planner, /if \(route === null \|\| !navigation\.isReady\(\)\) return;/);
    assert.match(planner, /void noteReminderTap\(id\);/, 'a tap does not count as an answer');
  });

  test("the smart time follows the learner's first finish of the day, half an hour early, on the quarter hour", () => {
    const now = at(TODAY, 9);
    // Fewer than three days: nothing to read, so the evening stands in.
    assert.equal(smartTime([at(day(-1), 19, 10), at(day(-2), 19, 40)], now, UTC), null);
    // The first finish of each day, never a later one: firsts 19:10, 18:50,
    // 19:40, median 19:10, half an hour early 18:40, on the quarter hour 18:30.
    assert.deepEqual(smartTime([at(day(-1), 19, 10), at(day(-1), 22, 0), at(day(-2), 18, 50), at(day(-3), 19, 40)], now, UTC), { hour: 18, minute: 30 });
    // An even count takes the middle of the middle two: 12:00 and 14:00 -> 13:00 -> 12:30.
    assert.deepEqual(smartTime([at(day(-1), 11), at(day(-2), 12), at(day(-3), 14), at(day(-4), 15)], now, UTC), { hour: 12, minute: 30 });
    // Kept between 08:00 and 21:30.
    assert.deepEqual(smartTime([at(day(-1), 6, 0), at(day(-2), 6, 10), at(day(-3), 5, 50)], now, UTC), { hour: 8, minute: 0 });
    assert.deepEqual(smartTime([at(day(-1), 23, 50), at(day(-2), 23, 40), at(day(-3), 23, 59)], now, UTC), { hour: 21, minute: 30 });
    // Only the last fourteen days count, and nothing from the future.
    assert.equal(smartTime([at(day(-20), 12), at(day(-21), 12), at(day(-22), 12)], now, UTC), null);
    assert.equal(smartTime([at(day(1), 12), at(day(2), 12), at(day(3), 12)], now, UTC), null);
    // The plan uses it.
    const smart = planReminders(input({ choice: { enabled: true, time: 'smart' }, finishes: [at(day(-1), 13, 5), at(day(-2), 13, 20), at(day(-3), 12, 55)] }));
    assert.equal(smart[0]?.at, at(TODAY, 12, 30));
    // Until the rhythm shows: 18:00.
    assert.equal(planReminders(input({ choice: { enabled: true, time: 'smart' } }))[0]?.at, at(TODAY, 18));
  });

  test('no line repeats on two days in a row, and the run in the words is the run as it will stand that day', () => {
    // A three-day run, practised today: tomorrow's reminder counts three, and
    // the day after, with tomorrow unpractised, claims no run at all.
    const run = planReminders(input({ practiceDays: [day(-2), day(-1), TODAY] }));
    assert.equal(run[0]?.day, day(1));
    const streakIds = new Set(STREAK_LINES.map((line) => line.id));
    assert.ok(streakIds.has(run[0]!.line), 'a live run was not mentioned');
    assert.match(`${run[0]!.title} ${run[0]!.body}`, /\b3\b|\b4\b/, 'the run in the words is not the run on disk');
    for (const slot of run.slice(1)) {
      assert.ok(!streakIds.has(slot.line), `a run that will have ended is still claimed on ${slot.day}`);
      assert.doesNotMatch(`${slot.title} ${slot.body}`, /streak/i);
    }
    // The eve of a milestone takes the place of the streak set.
    const eve = planReminders(input({ practiceDays: [day(-5), day(-4), day(-3), day(-2), day(-1), TODAY] }));
    assert.equal(eve[0]?.line, MILESTONE_EVE_LINE.id);
    assert.equal(eve[0]?.title, 'One practice from your 7-day milestone');
    // Lines without the streak, when the learner asked for that: no count at all.
    const quiet = planReminders(input({ practiceDays: [day(-2), day(-1)], choice: { enabled: true, time: 'evening', mentionStreak: false } }));
    for (const slot of quiet) assert.doesNotMatch(`${slot.title} ${slot.body}`, /\d/, 'a line carried a count the learner asked to keep off the lock screen');

    // Never the same line on two days in a row, in one plan or across two.
    const sets = [
      input(),
      input({ practiceDays: [day(-9)] }),
      input({ practiceDays: [day(-1)] }),
    ];
    for (const given of sets) {
      for (let offset = 0; offset < 30; offset += 1) {
        const slots = planReminders({ ...given, now: at(day(offset), 9), practiceDays: given.practiceDays.map((d) => addDays(d, offset)) });
        for (let i = 1; i < slots.length; i += 1) {
          if (slots[i]!.day === addDays(slots[i - 1]!.day, 1)) assert.notEqual(slots[i]!.line, slots[i - 1]!.line, `the same line on ${slots[i - 1]!.day} and ${slots[i]!.day}`);
        }
      }
    }
    // Across plans: the line that went out yesterday is not today's.
    const routine = ROUTINE_LINES.slice(0, 2);
    for (const said of routine) {
      const today = planReminders(input({ log: { ...emptyLog(), last: { day: day(-1), line: said.id } } }));
      assert.notEqual(today[0]?.line, said.id, `${said.id} went out yesterday and again today`);
    }
  });
});

describe('only what the phone held counts — F771 review', () => {
  /** A plan handed to the OS this morning, and the log as it was written then. */
  const planned = at(TODAY, 9);
  const window = () => planReminders(input({ now: planned }));
  const handed = () => plannedLog(emptyLog(), window(), planned);
  const later = at(day(10), 9);

  test('a reminder taken back from the phone never counts as sent, so it can never pause itself', () => {
    // The OS held the plan the whole time and nobody answered: the note went out, and the pause is real.
    assert.equal(window().length, UNANSWERED_LIMIT + 1);
    const real = settleLog(heldLog(handed(), planned), later);
    assert.equal(real.pauseSent, true, 'a plan the phone held to the end no longer pauses');
    assert.equal(real.log.sent.length, UNANSWERED_LIMIT + 1);
    // Settling a stale log on its own would pause it, which is why nothing settles without asking what the OS holds.
    assert.equal(settleLog(handed(), later).pauseSent, true);

    // Turned off in Settings the next lunchtime: what had arrived stays arrived, and the rest never will.
    const closed = closeLog(handed(), at(day(1), 12));
    assert.deepEqual(closed.sent, [TODAY]);
    assert.deepEqual(closed.slots, []);
    assert.equal(closed.plannedAt, undefined, 'a closed log still names a plan the OS no longer holds');
    assert.equal(settleLog(closed, later).pauseSent, false, 'a reminder turned off came back paused');
    assert.deepEqual(settleLog(closed, later).log.sent, [TODAY]);

    // Signed out, so the account's log could not be written: the device says no plan is held, and none of it counts.
    for (const held of [null, planned + 1]) {
      const dropped = heldLog(handed(), held);
      assert.deepEqual(dropped.slots, [], `a plan the OS does not hold (${String(held)}) kept its slots`);
      assert.equal(settleLog(dropped, later).pauseSent, false, 'a reminder left behind at a sign-out came back paused');
      assert.deepEqual(settleLog(dropped, later).log.sent, []);
    }
    // A log from before plans were named has nothing the OS can vouch for.
    assert.deepEqual(heldLog({ ...emptyLog(), slots: plannedSlots(window()) }, planned).slots, []);

    // Each of the review's three flows, through the one decision the planner makes.
    // (a) Off in Settings, then days later on again; (b) sign-out, sign-in days
    // later; (c) the permission revoked, then granted again. None of them pauses.
    const off = replanStep({ now: at(day(1), 12), choice: { enabled: false, time: 'evening' }, chosenNow: true, permitted: false, log: handed(), held: planned });
    assert.equal(off.kind, 'take-back');
    assert.deepEqual(off.log.slots, []);
    const revoked = replanStep({ now: at(day(1), 12), choice: { enabled: true, time: 'evening' }, chosenNow: false, permitted: false, log: handed(), held: planned });
    assert.equal(revoked.kind, 'take-back');
    assert.equal(revoked.kind === 'take-back' && revoked.pause, false);
    const flows: readonly [string, ReminderLog][] = [
      ['off, then on again from disk', off.log],
      ['signed out and back', handed()],
      ['permission back', revoked.log],
    ];
    for (const [name, log] of flows) {
      const back = replanStep({ now: later, choice: { enabled: true, time: 'evening' }, chosenNow: false, permitted: true, log, held: null });
      assert.equal(back.kind, 'plan', `${name}: the reminder paused itself without its note ever going out`);
    }
    // Paused and off still plan nothing, and a pause is only ever for a reminder that is on.
    assert.equal(replanStep({ now: later, choice: { enabled: true, time: 'evening', paused: true }, chosenNow: false, permitted: true, log: handed(), held: planned }).kind, 'take-back');
    const offAfterNote = replanStep({ now: later, choice: { enabled: false, time: 'evening' }, chosenNow: false, permitted: true, log: handed(), held: planned });
    assert.equal(offAfterNote.kind === 'take-back' && offAfterNote.pause, false, 'a reminder that is off was marked paused');

    // On a phone: every place the planner lets go of the OS's slots says so
    // first, and it settles only through the decision above.
    const planner = code('./ReminderPlanner.tsx');
    assert.doesNotMatch(planner, /settleLog\(/, 'the planner settles a log without asking which plan the OS holds');
    assert.equal((planner.match(/cancelReminder\(\)/g) ?? []).length, 2, 'the planner cancels somewhere other than its take-back and the sign-out');
    assert.match(planner, /if \(held !== null\) await saveHeldPlan\(null\);\s*await record\(\);\s*return cancelReminder\(\);/, 'a take-back cancels before it says the plan is gone');
    assert.match(planner, /return alone\(async \(\) => \{\s*await saveHeldPlan\(null\);\s*return cancelReminder\(\);\s*\}\);/, 'a sign-out cancels without saying the plan is gone');
    assert.equal((planner.match(/schedulePlan\(/g) ?? []).length, 1);
    assert.match(planner, /await saveHeldPlan\(null\);\s*const outcome = await schedulePlan\(slots\);/, 'a new plan replaces the old before the old is let go');
    assert.match(planner, /if \(outcome !== 'done'\) \{\s*await record\(closeLog\(log, now\)\);/, 'a refused plan leaves the old slots counting');
    assert.match(planner, /if \(\(await record\(plannedLog\(log, slots, now\)\)\) === 'durable'\) await saveHeldPlan\(now\);/);
    // Settings turns the reminder off through the planner's one chain, never around it.
    const settings = code('../settings/SettingsScreen.tsx');
    assert.doesNotMatch(settings, /cancelReminder/, 'Settings cancels behind the planner, so a plan in flight can land after the off');
    assert.equal((settings.match(/const outcome = await replanReminders\(\{ choice: wanted \}\);/g) ?? []).length, 2);
    // And the sign-out cancel is keyed on who is signed in, so the
    // password-recovery screen (the same learner) cancels nothing.
    const app = code('../../App.tsx');
    assert.equal((app.match(/stopReminders\(\)/g) ?? []).length, 1);
    assert.match(app, /const signedInAs = status === 'signedIn' \? user\?\.id \?\? null : null;/);
    assert.match(app, /useLayoutEffect\(\(\) => \{\s*if \(status === 'loading'\) return;\s*const was = lastSignedIn\.current;\s*lastSignedIn\.current = signedInAs;\s*if \(was !== null && was !== signedInAs\) void stopReminders\(\);\s*\}, \[status, signedInAs\]\);/);
    const signedInRoot = app.slice(app.indexOf('function SignedInRoot('), app.indexOf('function Gate('));
    assert.ok(signedInRoot.length > 0, 'SignedInRoot moved; this check reads nothing');
    assert.doesNotMatch(signedInRoot, /stopReminders/, 'leaving the signed-in tree (the recovery screen) cancels the reminder');
  });

  test('a yes after days with the reminder off plans the full window, never a pause', () => {
    // Off in Settings the day after it was planned, and ten days later the
    // recap's Remind me. The yes is a choice made now: it plans, and a visit
    // (the learner is in the app) clears the count, so the full window returns.
    const off = closeLog(handed(), at(day(1), 12));
    for (const chosenNow of [true, false]) {
      const yes = replanStep({ now: later, choice: { enabled: true, time: 'evening' }, chosenNow, permitted: true, log: off, held: null });
      assert.equal(yes.kind, 'plan', 'a yes after a long time off was read as a pause');
      const slots = planReminders(input({ now: later, log: noteOpened(yes.log, later, UTC) }));
      assert.equal(slots.length, UNANSWERED_LIMIT + 1, 'a yes after a long time off planned less than the full window');
      assert.ok(slots.every((slot) => slot.day >= day(10)));
    }
    // Even over a log that would pause, a choice made now plans.
    assert.equal(replanStep({ now: later, choice: { enabled: true, time: 'evening' }, chosenNow: true, permitted: true, log: handed(), held: planned }).kind, 'plan');

    // On a phone: the ask plans the very choice it wrote, and its put-back
    // after a refusal restores what was there rather than writing off.
    const planner = code('./ReminderPlanner.tsx');
    assert.match(planner, /const yes = \(mode: ReminderMode\): StoredReminder => \(\{ \.\.\.\(stored \?\? \{\}\), enabled: true, time: mode, paused: false \}\);/);
    assert.match(planner, /schedule: \(mode\) => replanReminders\(\{ tutor, choice: yes\(mode\) \}\),/, 'the ask plans without its choice, so a fresh yes can be read as a pause');
    assert.match(planner, /save: \(reminder\) => \(reminder\.enabled \? saveReminder\(yes\(reminder\.time\)\) : saveReminder\(stored \?\? reminder\)\),/);
    assert.match(planner, /const step = replanStep\(\{ now, choice, chosenNow: options\.choice !== undefined, permitted, log: stored, held \}\);/);
  });
});
