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

import { STREAK_BAN_EXEMPTIONS, guiltIn, streakGuiltIn } from '../copy/guilt.ts';

/** A save line with its exempted words taken out (D25), for the scans. */
const exempted = (line: string): string => STREAK_BAN_EXEMPTIONS.flatMap(({ words }) => words).reduce((rest, word) => rest.replace(new RegExp(word, 'gi'), ''), line);
import { reminderOpenOf, reminderPhraseOf, routeForReminder } from './openTarget.ts';
import {
  PLAN_DAYS,
  UNANSWERED_LIMIT,
  closeLog,
  emptyLog,
  heldLog,
  noteAnswered,
  noteOpened,
  freezeProtectionOf,
  freeRefillOf,
  heardRefill,
  talkOf,
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
import { FREE_TALK_LINE, MILESTONE_EVE_LINE, PAUSE_LINE, WEEKLY_LINE, REMINDER_COPY, REMINDER_LINES, ROUTINE_LINES, STREAK_LINES, STREAK_SAVE_LINES, reminderMessage } from './reminder.ts';

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
    assert.match(native, /request\.identifier\.startsWith\(prefix\)\) await Notifications\.cancelScheduledNotificationAsync\(request\.identifier\)/);
    assert.match(native, /async function cancelOwn\(prefix: string = SLOT_PREFIX\)/);
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
    // The save lines, by identity, are the one exemption (STREAK_BAN_EXEMPTIONS):
    // their exempted words are taken out, and the rest is scanned as usual.
    const saveCopy = new Set(STREAK_SAVE_LINES.flatMap((line) => [1, 2, 6, 29, 99, 364].flatMap((n) => [line.title({ n, lifetime: n, tutor: 'Léa' }), line.body({ n, lifetime: n, tutor: 'Léa' })])));
    for (const raw of REMINDER_COPY) {
      const line = saveCopy.has(raw) ? exempted(raw) : raw;
      assert.equal(guiltIn(line), undefined, `guilt in reminder copy: ${line}`);
      assert.equal(streakGuiltIn(line), undefined, `a streak nag in reminder copy: ${line}`);
      assert.doesNotMatch(line, /[—–·!]/, `a dash, a middot or a shout in reminder copy: ${line}`);
      assert.doesNotMatch(line, /in a row|yesterday/i, `a run read as unbroken days, or a day gone by: ${line}`);
    }

    // Each line opens what it promises: a line about today's phrase opens
    // today's phrase, the pause note opens Settings, a line about talking
    // opens Speak, the week opens the Streak screen (founder, 2026-11-19), and
    // the rest open Home, which a slot with a planned phrase turns into that
    // phrase (T1.3, below).
    assert.ok(REMINDER_LINES.includes(FREE_TALK_LINE) && REMINDER_LINES.includes(WEEKLY_LINE), 'the free-talk or weekly line is outside the scans');
    for (const line of REMINDER_LINES) {
      const words = `${line.title({ n: 3, lifetime: 3, tutor: 'Marie' })} ${line.body({ n: 3, lifetime: 3, tutor: 'Marie' })}`;
      const expected = /phrase/i.test(words) ? 'daily-phrase' : line.id === 'pause' ? 'settings' : /\btalk\b/i.test(words) ? 'speak' : /this week/i.test(words) ? 'streak' : 'home';
      assert.equal(line.open, expected, `"${words}" opens ${line.open}`);
    }
    assert.deepEqual(routeForReminder('daily-phrase', 'phrase-123'), { name: 'DailyPractice', params: { id: 'phrase-123' } });
    assert.deepEqual(routeForReminder('daily-phrase', null), { name: 'Tabs', params: { screen: 'Home' } }, 'a phrase line opened a phrase that is not today\'s');
    assert.deepEqual(routeForReminder('settings', 'phrase-123'), { name: 'Settings' });
    assert.deepEqual(routeForReminder('home', 'phrase-123'), { name: 'Tabs', params: { screen: 'Home' } });
    assert.deepEqual(routeForReminder('streak', 'phrase-123'), { name: 'Streak' });
    assert.equal(reminderOpenOf('streak'), 'streak');
    assert.equal(reminderOpenOf('somewhere'), 'home');
    assert.equal(reminderOpenOf(undefined), 'home');
    for (const slot of planReminders(input({ practiceDays: [day(-2), day(-1)] }))) {
      assert.ok(['home', 'daily-phrase', 'settings', 'speak', 'streak'].includes(slot.open));
    }

    // The slot carries where it opens; a tap hands that on with the slot's
    // name, the launch tap included; the app follows it once the navigator is
    // ready, to the phrase Home shows today.
    const native = code('./schedule.native.ts');
    assert.match(native, /content: \{ title: slot\.title, body: slot\.body, data: \{ open: slot\.open, \.\.\.\('phraseId' in slot && slot\.phraseId !== undefined \? \{ phraseId: slot\.phraseId \} : \{\}\) \} \}/);
    assert.match(native, /Notifications\.addNotificationResponseReceivedListener\(take\)/);
    assert.match(native, /const launch = Notifications\.getLastNotificationResponse\(\);/, 'a tap that launched the app from cold goes nowhere');
    assert.match(native, /handler\(typeof open === 'string' \? open : 'home', request\.identifier, request\.content\.data\?\.phraseId\)/);
    const app = code('../../App.tsx');
    assert.match(app, /useReminderTaps\(navigationRef\);/);
    // The phrase is the one Home shows: the same pool, at the same standing, for today.
    assert.match(code('./todayPhrase.ts'), /return levelFor\(totalXp\(facts\.activity\)\)\.index;/, 'the phrase a reminder opens is not picked the way Home picks it');
    assert.match(code('./todayPhrase.ts'), /return todayItems\(level, at\)\.phrase;/);
    assert.match(code('./todayPhrase.ts'), /return phraseOn\(await phraseLevel\(\), now\)\.id;/);
    const planner = code('./ReminderPlanner.tsx');
    assert.match(planner, /todayPhraseId\(Date\.now\(\)\)/, 'the phrase is worked out before the tap rather than at it');
    // The phrase the slot named wins; today's pick is only for a notification that carries none (T1.3).
    assert.match(planner, /const named = reminderPhraseOf\(phrase\);/);
    assert.match(planner, /named !== null \? Promise\.resolve\(named\) : todayPhraseId\(Date\.now\(\)\)/);
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

describe('the save line: only on a real cliff, inside the one slot (T1.2, D25)', () => {
  const FREE = { cap: 1, paidSince: null, protectedSince: '2026-09-01' };
  const SAVE = new Set(STREAK_SAVE_LINES.map((line) => line.id));
  const saves = (slots: readonly ReminderSlot[]) => slots.filter((slot) => SAVE.has(slot.line));
  // Four days kept, the last by a freeze still within its seven days: none held.
  const spent = { practiceDays: [day(-4), day(-3), day(-2)], covers: [{ day: day(-1), kind: 'freeze' as const, at: 0 }] };

  test('(a) a projected cliff with today unpractised is the save line, opening today\'s phrase', () => {
    const slots = planReminders(input({ ...spent, freezes: FREE }));
    assert.equal(slots[0]?.day, TODAY);
    assert.ok(SAVE.has(slots[0]!.line), `today said ${slots[0]?.line}`);
    assert.equal(slots[0]?.open, 'daily-phrase');
    assert.match(`${slots[0]?.title}`, /\b3[- ]day/);
    assert.equal(saves(slots).length, 1, 'a save line after the run had already ended');
  });

  test('(b) a freeze that would cover the day means no save line that day', () => {
    const slots = planReminders(input({ practiceDays: [day(-3), day(-2), day(-1)], freezes: FREE }));
    assert.equal(slots[0]?.day, TODAY);
    assert.ok(!SAVE.has(slots[0]!.line), 'a save line on a day the held freeze covers');
  });

  test('(c) plan unknown, or a guest, gets no save line', () => {
    assert.deepEqual(saves(planReminders(input({ ...spent }))), []);
    assert.deepEqual(saves(planReminders(input({ ...spent, guest: true }))), []);
  });

  test('(d) a learner who asked for lines without their streak gets no save line', () => {
    assert.deepEqual(saves(planReminders(input({ ...spent, freezes: FREE, choice: { enabled: true, time: 'evening', mentionStreak: false } }))), []);
  });

  test('(e) a run under three gets no save line', () => {
    assert.deepEqual(saves(planReminders(input({ practiceDays: [day(-1)], freezes: FREE }))), []);
    assert.deepEqual(saves(planReminders(input({ practiceDays: [day(-2)], covers: [{ day: day(-1), kind: 'freeze', at: 0 }], freezes: FREE }))), []);
  });

  test('(f) the fifth unanswered slot is still the pause note, and a paused learner gets nothing', () => {
    const slots = planReminders(input({ ...spent, freezes: FREE }));
    assert.equal(slots.length, UNANSWERED_LIMIT + 1);
    assert.equal(slots[UNANSWERED_LIMIT]?.line, 'pause');
    assert.deepEqual(planReminders(input({ ...spent, freezes: FREE, choice: { enabled: true, time: 'evening', paused: true } })), []);
  });

  test('(g) with a held free freeze, D+1 projects the run alive through it and D+2 is the save line', () => {
    const slots = planReminders(input({ practiceDays: [day(-2), day(-1), TODAY], freezes: FREE }));
    const next = slots.find((slot) => slot.day === day(1))!;
    const after = slots.find((slot) => slot.day === day(2))!;
    assert.ok(STREAK_LINES.some((line) => line.id === next.line) || next.line === MILESTONE_EVE_LINE.id, `D+1 said ${next.line}`);
    assert.ok(SAVE.has(after.line), `D+2 said ${after.line}: the projection forgot the freeze D+1 would spend`);
    assert.match(after.title, /\b3[- ]day/);
  });

  test('the save line waits one more day when a freeze is banked', () => {
    // As (g), but yesterday held two practices: the bank covers D+1, the free
    // freeze D+2, so D+3 is the first cliff (F1269).
    const banked = planReminders(input({ practiceDays: [day(-2), day(-1), TODAY], finishes: [at(day(-1), 9), at(day(-1), 19)], freezes: FREE }));
    const said = (d: number) => banked.find((slot) => slot.day === day(d))!.line;
    assert.ok(!SAVE.has(said(2)), `D+2 said ${said(2)}: the planner forgot the banked freeze`);
    assert.ok(SAVE.has(said(3)), `D+3 said ${said(3)}`);
  });

  test('a freeze banked three weeks ago still moves the save line', () => {
    // As (g), with the two practices 20 days back: past the smart time's 14 days, still banked.
    const old = planReminders(input({ practiceDays: [day(-20), day(-2), day(-1), TODAY], finishes: [at(day(-20), 9), at(day(-20), 19)], freezes: FREE }));
    const said = (d: number) => old.find((slot) => slot.day === day(d))!.line;
    assert.ok(!SAVE.has(said(2)), `D+2 said ${said(2)}: the planner forgot a bank older than 14 days`);
    assert.ok(SAVE.has(said(3)), `D+3 said ${said(3)}`);
  });

  test('no reminder line names a repair or a banked freeze', () => {
    for (const line of REMINDER_LINES) {
      for (const n of [0, 3, 12]) {
        const message = reminderMessage(line, { n, lifetime: n, tutor: 'Céline' });
        assert.doesNotMatch(`${message.title} ${message.body}`, /repair|bank|freeze|bring back|\bearn/i, `${line.id} names a repair or a freeze`);
      }
    }
  });

  test('(h) still exactly one practice:{day} slot per day', () => {
    for (const over of [{ ...spent, freezes: FREE }, { practiceDays: [day(-2), day(-1), TODAY], freezes: FREE }]) {
      const slots = planReminders(input(over));
      assert.deepEqual(slots.map((slot) => slot.id), slots.map((slot) => `practice:${slot.day}`));
      assert.equal(new Set(slots.map((slot) => slot.day)).size, slots.length);
    }
  });
});

describe('the freezes this phone saw (T1.2 review)', () => {
  test('a paid plan holds two from paidSince, a protected learner one, anything else is unknown', () => {
    assert.deepEqual(freezeProtectionOf({ paidSince: '2026-10-01', protectedSince: '2026-09-01' }), { cap: 2, paidSince: '2026-10-01', protectedSince: '2026-09-01' });
    assert.deepEqual(freezeProtectionOf({ paidSince: null, protectedSince: '2026-09-01' }), { cap: 1, paidSince: null, protectedSince: '2026-09-01' });
    assert.equal(freezeProtectionOf({ paidSince: null, protectedSince: null }), undefined);
    assert.equal(freezeProtectionOf(null), undefined);
  });
});

describe('a reminder worth reading, slice A (T1.3, D28)', () => {
  /** A phrase per local day, so a phrase picked for the wrong day shows. */
  /** Ids in the real shape, from a café scene, so the everyday allow-list lets them through. */
  const phrases = (english: string, situation = 'situation:cafe-first-coffee') => (at: number) => ({ id: `phrase:${situation}:${UTC.dayOf(at)}`, en: english, fr: 'Je voudrais un café' });
  const named = (slots: readonly ReminderSlot[]) => slots.filter((slot) => slot.line === 'phrase-named');

  test('the named phrase line says the English of the day\'s phrase, never the French, and carries its id', () => {
    const slots = planReminders(input({ phraseFor: phrases("I'd like a coffee.") }));
    const said = named(slots);
    assert.ok(said.length > 0, 'the rotation never named the phrase');
    for (const slot of said) {
      assert.equal(slot.title, 'How do you say this?');
      assert.equal(slot.body, "“I'd like a coffee” Today's phrase, with Céline.");
      assert.equal(slot.open, 'daily-phrase');
      assert.equal(slot.phraseId, `phrase:situation:cafe-first-coffee:${slot.day}`);
      assert.doesNotMatch(`${slot.title} ${slot.body}`, /café|voudrais/);
    }
    const question = named(planReminders(input({ phraseFor: phrases('Where is the station?') })));
    assert.equal(question[0]?.body, "“Where is the station?” Today's phrase, with Céline.", 'a question lost its question mark');
  });

  test('a phrase whose line would fail the scans is never named: the generic phrase line says it instead', () => {
    for (const [english, situation] of [['Hurry up!'], ['I missed the train'], ['Coffee — black'], [''], ['   '], ['Two coffees, table 4'], ['Hello.', 'situation:pharmacy-headache'], ['Hello.', 'situation:admin-which-counter'], ['Hello.', 'situation:not-a-scene'], ['Hello.', undefined]] as const) {
      const pick = situation === undefined ? (at: number) => ({ id: `phrase-${UTC.dayOf(at)}`, en: english }) : phrases(english, situation);
      const slots = planReminders(input({ phraseFor: pick }));
      assert.deepEqual(named(slots), [], `"${english}" was named`);
      const plain = planReminders(input({ phraseFor: phrases('Hello.') }));
      const day = named(plain)[0]!.day;
      // The generic phrase line in the named line's place, unless the day before already said it.
      const said = slots.find((slot) => slot.day === day)?.line;
      const before = slots.find((slot) => slot.day === addDays(day, -1))?.line;
      assert.ok(said === 'routine-phrase' || before === 'routine-phrase', `"${english}" fell back to ${said}`);
    }
    // A guest, even with a phrase to hand: never named.
    assert.ok(named(planReminders(input({ phraseFor: phrases('Hello.') }))).length > 0, 'the guest check below proves nothing');
    assert.deepEqual(named(planReminders(input({ guest: true, phraseFor: phrases('Hello.') }))), []);
  });

  test('the tap opens the phrase the line named, even after midnight', () => {
    const pick = phrases('Hello.');
    const slot = named(planReminders(input({ phraseFor: pick })))[0]!;
    const afterMidnight = slot.at + 7 * 3_600_000;
    assert.notEqual(pick(afterMidnight).id, slot.phraseId, 'the test cannot tell the two days apart');
    assert.deepEqual(routeForReminder(reminderOpenOf(slot.open), reminderPhraseOf(slot.phraseId)), { name: 'DailyPractice', params: { id: pick(slot.at).id } });
    // Older notifications carry none, and the tap falls back to today's pick.
    assert.equal(reminderPhraseOf(undefined), null);
    assert.equal(reminderPhraseOf(''), null);
    assert.equal(reminderPhraseOf(42), null);
  });

  test('taps open a practice, not Home: the pause note keeps Settings, and guest lines stay as they are', () => {
    const histories: Partial<PlanInput>[] = [{}, { practiceDays: [day(-2), day(-1)] }, { practiceDays: [day(-1)], choice: { enabled: true, time: 'evening', mentionStreak: false } }];
    for (const history of histories) {
      for (const slot of planReminders(input({ ...history, phraseFor: phrases('Hello.') }))) {
        assert.notEqual(slot.open, 'home', `${slot.line} opens Home`);
        assert.equal(slot.phraseId, `phrase:situation:cafe-first-coffee:${slot.day}`);
        if (slot.pause) assert.equal(slot.open, 'settings');
      }
    }
    const guest = planReminders(input({ guest: true, phraseFor: phrases('Hello.') }));
    assert.ok(guest.some((slot) => slot.open === 'daily-phrase'), 'a guest line changed where it opens');
    assert.ok(guest.every((slot) => slot.phraseId === undefined));
  });

  test('the free-talk line: on the free plan, the first slot at or after the refill, opening Speak', () => {
    const refill = at(day(1), 12);
    const slots = planReminders(input({ freeRefill: refill }));
    const free = slots.filter((slot) => slot.line === 'free-talk');
    assert.equal(free.length, 1);
    assert.equal(free[0]?.day, day(1));
    assert.equal(free[0]?.title, 'Céline is free to talk again');
    assert.equal(free[0]?.body, 'A conversation is ready when you are.');
    assert.equal(free[0]?.open, 'speak');
    assert.deepEqual(routeForReminder('speak', 'phrase-123'), { name: 'Tabs', params: { screen: 'Tutor' } });
    assert.equal(reminderOpenOf('speak'), 'speak');
    // A refill already gone by, a guest, or no known refill: never.
    assert.ok(!planReminders(input({ freeRefill: at(TODAY, 8) })).some((slot) => slot.line === 'free-talk'), 'a refill already passed said "again" every day');
    assert.ok(!planReminders(input({ freeRefill: refill, guest: true })).some((slot) => slot.line === 'free-talk'));
    assert.ok(!planReminders(input()).some((slot) => slot.line === 'free-talk'));
    // Heard from billing: the free plan, run out, with a known refill, and nothing else.
    const out = { canStart: false, secondsRemaining: 0 };
    assert.equal(freeRefillOf({ plan: 'trial', periodEnd: '2026-10-08T12:00:00.000Z', ...out }), Date.UTC(2026, 9, 8, 12));
    assert.equal(freeRefillOf({ plan: 'trial', periodEnd: '2026-10-08T12:00:00.000Z', canStart: false, secondsRemaining: 40 }), Date.UTC(2026, 9, 8, 12), 'too little left to start is run out');
    assert.equal(freeRefillOf({ plan: 'trial', periodEnd: '2026-10-08T12:00:00.000Z', canStart: true, secondsRemaining: 600 }), undefined, 'a learner who never ran out heard "again"');
    assert.equal(freeRefillOf({ plan: 'trial', periodEnd: null, ...out }), undefined);
    assert.equal(freeRefillOf({ plan: 'starter', periodEnd: '2026-10-08T12:00:00.000Z', ...out }), undefined);
    assert.equal(freeRefillOf({ plan: 'regular', periodEnd: '2026-10-08T12:00:00.000Z', ...out }), undefined);
    assert.equal(freeRefillOf(null), undefined);
  });

  test('the weekly line: on a Sunday slot, with the streak mentioned, the 7 days ending that Sunday', () => {
    // Saturday morning; Sunday is day(4). A practice on day(-3) is outside its week.
    const now = at(day(3), 9);
    const week = { now, practiceDays: [day(-3), day(1), day(2)], finishes: [at(day(-3), 9), at(day(1), 9), at(day(2), 9), at(day(2), 19)] };
    const slots = planReminders(input(week));
    const weekly = slots.filter((slot) => slot.line === 'weekly');
    assert.equal(weekly.length, 1);
    assert.equal(weekly[0]?.day, day(4));
    assert.equal(weekly[0]?.title, 'This week with Céline');
    assert.equal(weekly[0]?.body, '2 days of French, 3 practices.');
    assert.equal(weekly[0]?.open, 'streak');
    assert.deepEqual(routeForReminder(reminderOpenOf(weekly[0]?.open), reminderPhraseOf(weekly[0]?.phraseId)), { name: 'Streak' }, 'the week does not open the Streak screen');
    // The week's first day, Monday day(-2), is counted.
    const monday = planReminders(input({ now, practiceDays: [day(-2)], finishes: [at(day(-2), 9)] })).find((slot) => slot.line === 'weekly');
    assert.equal(monday?.body, '1 day of French, 1 practice.', 'the Monday of the week was not counted');
    // An empty week: no weekly line on its Sunday.
    assert.ok(!planReminders(input({ now, practiceDays: [day(-3)], finishes: [at(day(-3), 9)] })).some((slot) => slot.line === 'weekly'), 'an empty week got a weekly line');
    const one = planReminders(input({ now, practiceDays: [day(2)], finishes: [at(day(2), 9)] })).find((slot) => slot.line === 'weekly');
    assert.equal(one?.body, '1 day of French, 1 practice.');
    // Streak off: no weekly line, and no digits.
    const quiet = planReminders(input({ ...week, choice: { enabled: true, time: 'evening', mentionStreak: false } }));
    assert.ok(!quiet.some((slot) => slot.line === 'weekly'));
    for (const slot of [...quiet, ...planReminders(input({ ...week, phraseFor: phrases('Hello.'), choice: { enabled: true, time: 'evening', mentionStreak: false } }))]) {
      assert.doesNotMatch(`${slot.title} ${slot.body}`, /\d/, `a number on the lock screen with streak mentions off: ${slot.title} / ${slot.body}`);
    }
    // A week whose reminder days exclude Sunday has none.
    assert.ok(!planReminders(input({ ...week, choice: { enabled: true, time: 'evening', days: [2, 3, 4, 5, 6, 7] } })).some((slot) => slot.line === 'weekly'));
    // Only ever on a Sunday.
    for (const slot of planReminders(input({ practiceDays: [day(-1)] }))) {
      if (slot.line === 'weekly') assert.equal(new Date(`${slot.day}T00:00:00Z`).getUTCDay(), 0);
    }
  });

  test('"A moment of French" opens the conversation, like the free-to-talk line (founder, 2026-11-19)', () => {
    const moment = ROUTINE_LINES.find((line) => line.id === 'routine-moment')!;
    assert.equal(moment.open, 'speak');
    assert.deepEqual(routeForReminder(moment.open, null), { name: 'Tabs', params: { screen: 'Tutor' } });
    // A slot with a planned phrase still opens Speak for it, not the phrase.
    const slot = planReminders(input({ phraseFor: phrases('Hello.') })).find((next) => next.line === 'routine-moment');
    assert.equal(slot?.open, 'speak');
  });

  test('the refill as billing answered it: kept for its account, kept through a failed fetch', () => {
    const out = { plan: 'trial' as const, periodEnd: '2026-10-08T12:00:00.000Z', canStart: false, secondsRemaining: 0 };
    const known = heardRefill(null, 3, out);
    assert.deepEqual(known, { owner: 3, at: Date.UTC(2026, 9, 8, 12), talk: { free: true, open: false } });
    // A null answer (a failure or the timeout) keeps what was known.
    assert.equal(heardRefill(known, 3, null), known);
    assert.equal(heardRefill(null, 3, null), null);
    // A real answer replaces it, a paid plan included.
    assert.deepEqual(heardRefill(known, 3, { ...out, plan: 'starter' }), { owner: 3, at: undefined, talk: { free: false, open: false } });
    assert.deepEqual(heardRefill(known, 4, out), { owner: 4, at: Date.UTC(2026, 9, 8, 12), talk: { free: true, open: false } });
  });

  test('the planner hears billing on mount, on a billing change, on the foreground and after a settle, one fetch each', () => {
    const planner = code('./ReminderPlanner.tsx');
    // Only the account it was read for plans with it, and a sign-out forgets it.
    assert.match(planner, /const refill = freeRefill !== null && freeRefill\.owner === owner \? freeRefill\.at : undefined;/, 'another account\'s refill is planned for');
    assert.match(planner, /export function stopReminders\(\): Promise<ScheduleOutcome> \{\s*if \(!REMINDERS_AVAILABLE\) return Promise\.resolve\('unavailable'\);\s*freeRefill = null;/, 'a sign-out keeps the refill');
    // Heard, then planned; a null answer keeps the last one.
    assert.match(planner, /if \(owner !== scopeGeneration\(\)\) return;\s*freeRefill = heardRefill\(freeRefill, owner, status\);/);
    assert.match(planner, /void replanReminders\(\{ tutor: tutorRef\.current \}\);\s*\}\);\s*\};/, 'the refetch does not re-plan once billing answered');
    // A settle and a return to the foreground refetch, and re-plan through the fetch, not beside it.
    // The re-plan comes first, so a short visit is noted before the app leaves; the fetch re-plans again when billing answers.
    assert.match(planner, /const replanThenHear = \(\): void => \{\s*void replanReminders\(\{ tutor: tutorRef\.current \}\);\s*hear\(\);\s*\};/, 'the foreground or a settle waits for billing before it plans');
    assert.match(planner, /const offSettled = onSettled\(replanThenHear\);/, 'a settled sitting does not re-plan at once and refetch billing');
    assert.match(planner, /if \(state === 'active'\) replanThenHear\(\);\s*else if \(replansOn\(state\)\) void replanReminders\(\{ tutor: tutorRef\.current \}\);/, 'the foreground does not re-plan at once and refetch billing');
    // With nobody to ask billing for, hearing still re-plans.
    assert.match(planner, /if \(userId === null\) \{\s*void replanReminders\(\{ tutor: tutorRef\.current \}\);\s*return;\s*\}/, 'the planner with no account never plans when it hears');
    assert.equal((planner.match(/fetchBillingStatus\(/g) ?? []).length, 1, 'billing is fetched in more than one place');
    // The billing listener leaves with the planner.
    assert.match(planner, /const offBilling = onBillingChange\(/);
    assert.match(planner, /return \(\) => \{\s*offSettled\(\);\s*appState\.remove\(\);\s*offBilling\(\);\s*\};/, 'the billing listener outlives the planner');
  });

  test('precedence: pause, milestone eve, save, free talk, weekly, then the rotation', () => {
    const FREE = { cap: 1, paidSince: null, protectedSince: '2026-09-01' };
    const spent = { practiceDays: [day(-4), day(-3), day(-2)], covers: [{ day: day(-1), kind: 'freeze' as const, at: 0 }] };
    // Save beats free talk on the same slot.
    const save = planReminders(input({ ...spent, freezes: FREE, freeRefill: at(TODAY, 12) }));
    assert.ok(STREAK_SAVE_LINES.some((line) => line.id === save[0]?.line), `today said ${save[0]?.line}`);
    // Free talk beats weekly on a Sunday.
    const now = at(day(3), 9);
    const sunday = planReminders(input({ now, practiceDays: [day(2)], finishes: [at(day(2), 9)], freeRefill: at(day(4), 12) }));
    assert.equal(sunday.find((slot) => slot.day === day(4))?.line, 'free-talk');
    // The pause note still takes the fifth unanswered slot.
    const fifth = planReminders(input({ freeRefill: at(day(4), 12) }));
    assert.equal(fifth[UNANSWERED_LIMIT]?.line, 'pause');
  });
});

describe('your talk days in the plan (T1.4, founder 2026-11-19)', () => {
  // TODAY, 2026-10-07, is a Wednesday. Expo weekdays: 2 Monday, 4 Wednesday, 6 Friday, 1 Sunday.
  const MWF = { enabled: true, time: 'evening' as const, talkDays: [2, 4, 6] };
  const PAID = { free: false, open: true };
  const talking = (slots: readonly ReminderSlot[]) => slots.filter((slot) => slot.line === 'talk-day' || slot.line === 'talk-day-free').map((slot) => slot.day);

  test('a talk day says "A conversation with {tutor} today" only when a conversation can start, opening Speak', () => {
    const slots = planReminders(input({ choice: MWF, talk: PAID }));
    // Wed and Fri; Monday, day(5), falls after the fifth slot (the pause note, day(4)).
    assert.deepEqual(talking(slots), [TODAY, day(2)], 'Wed and Fri');
    const wed = slots[0]!;
    assert.equal(wed.title, 'A conversation with Céline today');
    assert.equal(wed.body, 'Céline is ready to talk when you are.');
    assert.equal(wed.open, 'speak');
    // A free learner who can still start: the same line.
    assert.deepEqual(talking(planReminders(input({ choice: MWF, talk: { free: true, open: true } }))), [TODAY, day(2)]);
    // Nothing can start (a paid plan with no minutes left, or the free one used with no known refill): the usual line.
    assert.deepEqual(talking(planReminders(input({ choice: MWF, talk: { free: false, open: false } }))), []);
    assert.deepEqual(talking(planReminders(input({ choice: MWF, talk: { free: true, open: false } }))), []);
    // Heard from billing: the plan known, and whether one can start now.
    assert.deepEqual(talkOf({ plan: 'starter', periodEnd: null, canStart: true, secondsRemaining: 600 }), { free: false, open: true });
    assert.deepEqual(talkOf({ plan: 'regular', periodEnd: null, canStart: true, secondsRemaining: 0 }), { free: false, open: false });
    assert.deepEqual(talkOf({ plan: 'trial', periodEnd: null, canStart: false, secondsRemaining: 0 }), { free: true, open: false });
    assert.equal(talkOf(null), undefined);
  });

  test('the free body when the free conversation came back before the slot', () => {
    const refill = at(day(1), 12);
    const slots = planReminders(input({ choice: MWF, talk: { free: true, open: false }, freeRefill: refill }));
    // Wednesday, before the refill: the usual line. Friday, after it: the free body.
    assert.deepEqual(talking(slots), [day(2)]);
    const fri = slots.find((slot) => slot.day === day(2))!;
    assert.equal(fri.line, 'talk-day-free');
    assert.equal(fri.title, 'A conversation with Céline today');
    assert.equal(fri.body, 'Céline is free to talk again.');
    assert.equal(fri.open, 'speak');
    // Thursday, the first slot after the refill and no talk day, keeps the free-to-talk line.
    assert.equal(slots.find((slot) => slot.day === day(1))?.line, 'free-talk');
  });

  test('order: pause, milestone eve, save, talk day, free to talk, the week line', () => {
    const FREE = { cap: 1, paidSince: null, protectedSince: '2026-09-01' };
    const spent = { practiceDays: [day(-4), day(-3), day(-2)], covers: [{ day: day(-1), kind: 'freeze' as const, at: 0 }] };
    // Save beats the talk day.
    const save = planReminders(input({ ...spent, freezes: FREE, choice: MWF, talk: PAID }));
    assert.ok(STREAK_SAVE_LINES.some((line) => line.id === save[0]?.line), `today said ${save[0]?.line}`);
    // The milestone eve beats it: a six-day run makes Wednesday the eve of seven.
    const eve = planReminders(input({ practiceDays: [day(-6), day(-5), day(-4), day(-3), day(-2), day(-1)], choice: MWF, talk: PAID }));
    assert.equal(eve[0]?.line, MILESTONE_EVE_LINE.id);
    // The talk day beats free to talk on the refill's first slot.
    const free = planReminders(input({ choice: MWF, talk: { free: true, open: false }, freeRefill: at(TODAY, 12) }));
    assert.equal(free[0]?.line, 'talk-day-free');
    assert.ok(!free.some((slot) => slot.line === 'free-talk'), 'free to talk said again after the talk day said it');
    // The talk day beats the week line on a Sunday talk day.
    const now = at(day(3), 9);
    const sunday = planReminders(input({ now, practiceDays: [day(2)], finishes: [at(day(2), 9)], choice: { ...MWF, talkDays: [1, 4] }, talk: PAID }));
    assert.equal(sunday.find((slot) => slot.day === day(4))?.line, 'talk-day');
    // The pause note still takes the fifth unanswered slot, talk day or not.
    const fifth = planReminders(input({ choice: { ...MWF, talkDays: [1] }, talk: PAID }));
    assert.equal(fifth[UNANSWERED_LIMIT]?.day, day(4));
    assert.equal(fifth[UNANSWERED_LIMIT]?.line, 'pause');
  });

  test('Sunday and Monday are next to each other, and at most three days: a set that breaks the rule plans no talk day', () => {
    for (const talkDays of [[1, 2], [7, 1], [2, 3], [2, 4, 6, 1], [2, 2]]) {
      assert.deepEqual(talking(planReminders(input({ choice: { ...MWF, talkDays }, talk: PAID }))), [], `${talkDays} was planned`);
    }
    assert.deepEqual(talking(planReminders(input({ now: at(day(3), 9), choice: { ...MWF, talkDays: [1, 3] }, talk: PAID }))), [day(4), day(6)], 'Sun and Tue');
  });

  test('guests and an unknown plan get no talk day', () => {
    assert.deepEqual(talking(planReminders(input({ choice: MWF, talk: PAID, guest: true }))), []);
    assert.deepEqual(talking(planReminders(input({ choice: MWF }))), []);
  });

  test('a missed talk day says nothing, the days stay where they are, and a practised talk day gets nothing', () => {
    // Thursday morning, Wednesday's talk day missed.
    const choice = { ...MWF, talkDays: [2, 4, 6] };
    const thursday = planReminders(input({ now: at(day(1), 9), choice, talk: PAID, log: { ...emptyLog(), sent: [TODAY] } }));
    assert.equal(thursday[0]?.day, day(1));
    assert.notEqual(thursday[0]?.line, 'talk-day');
    for (const slot of thursday) assert.doesNotMatch(`${slot.title} ${slot.body}`, /miss|again tomorrow|last|yesterday/i, `"${slot.title} / ${slot.body}" reads the missed day`);
    assert.deepEqual(talking(thursday), [day(2)]);
    assert.deepEqual(choice.talkDays, [2, 4, 6]);
    // One a day: a talk day already practised has no reminder.
    assert.ok(!planReminders(input({ choice, talk: PAID, practiceDays: [TODAY] })).some((slot) => slot.day === TODAY));
    // Every talk-day slot names the tutor, and with streak mentions off carries no digit.
    for (const slot of planReminders(input({ choice: { ...choice, mentionStreak: false }, talk: PAID }))) {
      assert.ok(`${slot.title} ${slot.body}`.includes('Céline'));
      assert.doesNotMatch(`${slot.title} ${slot.body}`, /\d/);
    }
  });
});
