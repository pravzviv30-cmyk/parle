/**
 * The one reminder planner (Come alive, README Part 5.F and Part 6: canonical).
 *
 * Pure: no store, no OS, no clock of its own. `now` and the calendar arrive as
 * arguments, the learner's facts arrive as plain data, and the answer is the
 * list of dated slots the native module hands the OS. `ReminderPlanner.tsx`
 * reads the facts and calls this; `plan.test.ts` runs it across days.
 *
 * The rules, each held by a test:
 *
 * 1. **Time.** A preset is kept as chosen. `smart` takes the first finished
 *    practice of each local day in the last 14, and with three days or more
 *    uses their median, 30 minutes earlier, rounded down to the quarter hour
 *    and kept between 08:00 and 21:30. Until then it is 18:00.
 * 2. **One slot a day.** From today, seven days ahead, on the chosen weekdays,
 *    one slot per local day, keyed `practice:{day}`. Today is skipped when it
 *    is already practised, or when its time has passed.
 * 3. **The pause.** A reminder that arrived and was followed by no practice,
 *    no tap and no visit to the app is unanswered. After four in a row the
 *    next slot is a kind note saying reminders will stop, and nothing follows
 *    it; once it has gone out the reminder is paused until the learner turns
 *    it on again. Any practice, tap or visit starts the count again.
 * 4. **Words.** With a live run the streak set (the eve of a milestone takes
 *    its place), otherwise the routine set; never the same line two days in a
 *    row; always the chosen tutor's name. The run is projected for each day as
 *    it will stand if nothing else is practised before then, which is truthful
 *    because every practice re-plans.
 *
 * 5. **Only what the phone held counts.** A slot counts as arrived only while
 *    the OS still held its plan when its time came. Every plan is named by the
 *    instant it was handed over (`plannedAt`), and the device remembers which
 *    plan the OS holds (`store.ts` `loadHeldPlan`). A log whose plan was taken
 *    back (the reminder turned off, a sign-out, a refused permission, a refused
 *    schedule) counts none of its slots, so a reminder the learner turned off
 *    can never come back paused (`replanStep`).
 *
 * At most five slots are ever pending (the pause note is the fifth), far under
 * the 64 iOS keeps for one app.
 */

import { addDays, dayKeyOf, isDayKey, isStreakMilestone, streakFrom, weekdayIndex, type DayKey, type StreakCover } from '@luvani/core';

import {
  GUEST_PAUSE_LINE,
  MILESTONE_EVE_LINE,
  PAUSE_LINE,
  ROUTINE_LINES,
  SMART_FALLBACK,
  STREAK_LINES,
  reminderMessage,
  reminderTime,
  type ClockTime,
  type ReminderLine,
  type ReminderOpen,
  type StoredReminder,
} from './reminder.ts';

/** The window planned ahead, today included. */
export const PLAN_DAYS = 7;
/** Reminders in a row that may go unanswered; the next slot is the pause note. */
export const UNANSWERED_LIMIT = 4;
/** The days of finishes the smart time reads, and of history the log keeps. */
export const HISTORY_DAYS = 14;
/** Days with a finish before the smart time trusts a rhythm. */
export const SMART_MIN_DAYS = 3;
/** How far ahead of the usual first practice the reminder comes. */
export const SMART_LEAD_MINUTES = 30;
/** The quarter hour the smart time is rounded down to. */
export const SMART_STEP_MINUTES = 15;
/** The smart time's bounds, minutes after local midnight: 08:00 and 21:30. */
export const SMART_EARLIEST = 8 * 60;
export const SMART_LATEST = 21 * 60 + 30;

/** The identifier prefix every slot carries, and the only notifications this app cancels. */
export const SLOT_PREFIX = 'practice:';

/** The device's calendar, as the planner needs it. Injected, so a test can run in any zone. */
export interface Calendar {
  /** The local day an instant falls on. */
  dayOf(at: number): DayKey;
  /** Minutes after local midnight. */
  minuteOf(at: number): number;
  /** The instant of `hour:minute` local time on `day`. */
  at(day: DayKey, hour: number, minute: number): number;
}

/** This phone's own calendar. Reads no clock: every instant is handed in. */
export const LOCAL_CALENDAR: Calendar = {
  dayOf: (at) => dayKeyOf(at),
  minuteOf: (at) => {
    const local = new Date(at);
    return local.getHours() * 60 + local.getMinutes();
  },
  at: (day, hour, minute) => {
    const [year, month, date] = day.split('-').map(Number) as [number, number, number];
    return new Date(year, month - 1, date, hour, minute, 0, 0).getTime();
  },
};

/** A slot the OS was handed, as the log remembers it. */
export interface PlannedSlot {
  day: DayKey;
  at: number;
  /** Which line it said, so the next day's can differ. */
  line?: string;
  /** True for the pause note. */
  pause?: true;
}

/** The last reminder that arrived: its day and which line it said. */
export interface SentLine {
  day: DayKey;
  line: string;
}

/**
 * What this phone remembers about its reminders: day keys, the last 14 of
 * each, and the slots last handed to the OS. Nothing in it is a word the
 * learner said or a number they were shown.
 */
export interface ReminderLog {
  /** Days a reminder arrived (its slot's time passed while it was still planned). */
  sent: DayKey[];
  /** Days a reminder was tapped. */
  answered: DayKey[];
  /** Days the app was opened after that day's reminder had arrived, or on a day with none. */
  opened: DayKey[];
  /** The slots last handed to the OS. */
  slots: PlannedSlot[];
  /**
   * The instant those slots were handed to the OS, which names their plan.
   * Absent once the plan is taken back: slots with no plan the OS holds never
   * count as arrived (`heldLog`).
   */
  plannedAt?: number;
  /** The last reminder that arrived, so the next day never repeats its line. */
  last?: SentLine;
}

export function emptyLog(): ReminderLog {
  return { sent: [], answered: [], opened: [], slots: [] };
}

/** One slot, ready for the OS. */
export interface ReminderSlot {
  id: `practice:${DayKey}`;
  day: DayKey;
  at: number;
  title: string;
  body: string;
  open: ReminderOpen;
  /** Which line it says (`reminder.ts`). */
  line: string;
  /** True for the pause note. */
  pause: boolean;
}

export interface PlanInput {
  now: number;
  calendar: Calendar;
  choice: StoredReminder;
  /** Finished practices, epoch ms. Only the last 14 days are read. */
  finishes: readonly number[];
  /** The learner's practice days: the streak's own source. */
  practiceDays: readonly DayKey[];
  /** Days a freeze, a repair or a trip kept the run; none for a guest. */
  covers: readonly StreakCover[];
  /** The chosen tutor's name. */
  tutor: string;
  /** The log, already brought up to `now` (`settleLog`, then `noteOpened` when the app is open). */
  log: ReminderLog;
  /** A guest has no Settings, so their pause note says so without a door. */
  guest?: boolean;
  /** Plan nothing for today: the practice facts could not be read, so today might be practised. */
  todayUnknown?: boolean;
}

/** The newest `HISTORY_DAYS` distinct valid day keys, oldest first. */
function capDays(days: readonly string[]): DayKey[] {
  const held = [...new Set(days.filter((day) => isDayKey(day)))].sort();
  return held.slice(Math.max(0, held.length - HISTORY_DAYS));
}

/** A log as this build keeps it: valid, bounded, sorted. */
export function boundLog(log: ReminderLog): ReminderLog {
  const slots = new Map<DayKey, PlannedSlot>();
  for (const slot of log.slots) {
    if (!isDayKey(slot.day) || !Number.isSafeInteger(slot.at) || slot.at <= 0) continue;
    slots.set(slot.day, {
      day: slot.day,
      at: slot.at,
      ...(typeof slot.line === 'string' && slot.line.length > 0 ? { line: slot.line } : {}),
      ...(slot.pause === true ? { pause: true as const } : {}),
    });
  }
  const last = log.last;
  return {
    sent: capDays(log.sent),
    answered: capDays(log.answered),
    opened: capDays(log.opened),
    slots: [...slots.values()].sort((a, b) => a.at - b.at).slice(0, PLAN_DAYS),
    ...(isInstant(log.plannedAt) ? { plannedAt: log.plannedAt } : {}),
    ...(last !== undefined && isDayKey(last.day) && typeof last.line === 'string' && last.line.length > 0 ? { last: { day: last.day, line: last.line } } : {}),
  };
}

/** An epoch instant this build would have written. */
function isInstant(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/**
 * Bring the log up to `now`: every planned slot whose time has passed arrived,
 * so its day joins `sent` and it leaves `slots`. `pauseSent` is true when the
 * pause note was among them, which is when the reminder pauses itself.
 *
 * Sound only for a log whose plan the OS still holds, so the planner never
 * calls it on anything else: `heldLog` first drops the slots of a plan that
 * was taken back at a moment nobody wrote down (a sign-out), and every place
 * the planner takes a plan back closes the log as it does (`closeLog`).
 */
export function settleLog(log: ReminderLog, now: number): { log: ReminderLog; pauseSent: boolean } {
  const fired = log.slots.filter((slot) => slot.at <= now).sort((a, b) => a.at - b.at);
  const newest = fired[fired.length - 1];
  const last = newest?.line !== undefined ? { day: newest.day, line: newest.line } : log.last;
  return {
    log: boundLog({
      ...log,
      sent: [...log.sent, ...fired.map((slot) => slot.day)],
      slots: log.slots.filter((slot) => slot.at > now),
      ...(last !== undefined ? { last } : {}),
    }),
    pauseSent: fired.some((slot) => slot.pause === true),
  };
}

/**
 * The log as far as the OS can vouch for it. `held` is the plan the OS holds
 * now (`store.ts` `loadHeldPlan`). A log whose plan is not that one was taken
 * back at some moment nobody could write down, a sign-out being the usual
 * one, so none of its slots is known to have arrived and they are dropped
 * rather than counted. Counting too few only delays a pause; counting a slot
 * that never arrived pauses a reminder the learner never ignored.
 */
export function heldLog(log: ReminderLog, held: number | null): ReminderLog {
  if (log.plannedAt !== undefined && log.plannedAt === held) return log;
  return closedLog(log);
}

/** The log with no plan in the OS: its history kept, its slots and their plan gone. */
function closedLog(log: ReminderLog): ReminderLog {
  return boundLog({ sent: log.sent, answered: log.answered, opened: log.opened, slots: [], ...(log.last !== undefined ? { last: log.last } : {}) });
}

/**
 * The log as the planner takes its plan back from the OS at `now`: what had
 * arrived by then is kept as arrived, and what was still to come never will.
 * Settling a closed log later finds nothing, so it can never pause.
 */
export function closeLog(log: ReminderLog, now: number): ReminderLog {
  return closedLog(settleLog(log, now).log);
}

/** The log once the OS has taken `slots`, named by the instant it took them. */
export function plannedLog(log: ReminderLog, slots: readonly ReminderSlot[], now: number): ReminderLog {
  return boundLog({ ...log, slots: plannedSlots(slots), plannedAt: now });
}

/** What one re-plan knows before it decides. */
export interface ReplanFacts {
  now: number;
  /** The learner's choice, or null when there is none. A guest's pause rides in `paused`. */
  choice: StoredReminder | null;
  /** The caller has just made this choice (Settings, the ask): that is a turning on, never a pause. */
  chosenNow: boolean;
  /** The OS allows notifications. */
  permitted: boolean;
  /** The log as stored. */
  log: ReminderLog;
  /** The plan the OS holds (`store.ts` `loadHeldPlan`), or null. */
  held: number | null;
}

/**
 * Plan, or take the plan back. Either way the log comes back settled up to
 * `now` from what the OS really held, and for a take-back it is closed, so
 * nothing it planned can be counted later. `pause` is true when the pause
 * note has gone out and nobody has just turned the reminder on: the caller
 * records the pause, and nothing is planned until it is turned on again.
 */
export type ReplanStep = { kind: 'take-back'; log: ReminderLog; pause: boolean } | { kind: 'plan'; log: ReminderLog };

export function replanStep(facts: ReplanFacts): ReplanStep {
  const settled = settleLog(heldLog(facts.log, facts.held), facts.now);
  const on = facts.choice !== null && facts.choice.enabled === true && facts.choice.paused !== true;
  const pause = on && settled.pauseSent && !facts.chosenNow;
  if (!on || pause || !facts.permitted) return { kind: 'take-back', log: closedLog(settled.log), pause };
  return { kind: 'plan', log: settled.log };
}

/**
 * The app is open now, after every reminder that has arrived: each of those
 * days is answered by this visit. Today counts too, unless today's reminder is
 * still on its way, because a visit before it arrives says nothing about it.
 */
export function noteOpened(log: ReminderLog, now: number, calendar: Calendar): ReminderLog {
  const today = calendar.dayOf(now);
  const pending = log.slots.some((slot) => slot.day === today && slot.at > now);
  return boundLog({ ...log, opened: [...log.opened, ...log.sent.filter((day) => day <= today), ...(pending ? [] : [today])] });
}

/** A reminder was tapped: its day is answered. */
export function noteAnswered(log: ReminderLog, day: DayKey): ReminderLog {
  return boundLog({ ...log, answered: [...log.answered, day] });
}

/** The day in a slot's identifier, or null for an identifier this app did not write. */
export function slotDay(id: string): DayKey | null {
  if (!id.startsWith(SLOT_PREFIX)) return null;
  const day = id.slice(SLOT_PREFIX.length);
  return isDayKey(day) ? day : null;
}

/**
 * Reminders in a row that went unanswered: the days one arrived after the last
 * day the learner practised, tapped one, or opened the app after it arrived.
 */
export function unansweredRun(log: ReminderLog, practiceDays: readonly DayKey[], today: DayKey): number {
  const engaged = [...practiceDays, ...log.answered, ...log.opened].filter((day) => isDayKey(day) && day <= today).sort();
  const last = engaged.length > 0 ? engaged[engaged.length - 1]! : null;
  return new Set(log.sent.filter((day) => day <= today && (last === null || day > last))).size;
}

/**
 * The learner's own time: the median first finish of each recent day, half an
 * hour earlier, on the quarter hour, between 08:00 and 21:30. Null until three
 * days have a finish, when the evening stands in.
 */
export function smartTime(finishes: readonly number[], now: number, calendar: Calendar): ClockTime | null {
  const today = calendar.dayOf(now);
  const from = addDays(today, -(HISTORY_DAYS - 1));
  const first = new Map<DayKey, number>();
  for (const at of finishes) {
    if (!Number.isFinite(at) || at <= 0 || at > now) continue;
    const day = calendar.dayOf(at);
    if (day < from || day > today) continue;
    const minute = calendar.minuteOf(at);
    const held = first.get(day);
    if (held === undefined || minute < held) first.set(day, minute);
  }
  if (first.size < SMART_MIN_DAYS) return null;
  const minutes = [...first.values()].sort((a, b) => a - b);
  const middle = Math.floor(minutes.length / 2);
  const median = minutes.length % 2 === 1 ? minutes[middle]! : Math.floor((minutes[middle - 1]! + minutes[middle]!) / 2);
  const early = Math.floor((median - SMART_LEAD_MINUTES) / SMART_STEP_MINUTES) * SMART_STEP_MINUTES;
  const clamped = Math.min(SMART_LATEST, Math.max(SMART_EARLIEST, early));
  return { hour: Math.floor(clamped / 60), minute: clamped % 60 };
}

/** The time a choice fires at today: the preset's, or the smart time (the evening until the rhythm shows). */
export function fireTime(choice: Pick<StoredReminder, 'time'>, finishes: readonly number[], now: number, calendar: Calendar): ClockTime {
  if (choice.time !== 'smart') {
    const preset = reminderTime(choice.time);
    return { hour: preset.hour, minute: preset.minute };
  }
  return smartTime(finishes, now, calendar) ?? SMART_FALLBACK;
}

/** Expo's weekday numbering, which a stored `days` list uses: 1 for Sunday to 7 for Saturday. */
function expoWeekday(day: DayKey): number {
  return ((weekdayIndex(day) + 1) % 7) + 1;
}

/** Whole days since 1970-01-01, for a rotation that never repeats on consecutive days. */
function dayNumber(day: DayKey): number {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  return Math.round(Date.UTC(year, month - 1, date) / 86_400_000);
}

/**
 * The line for one day: the milestone eve, the streak set, or the routine set,
 * rotated by the day, and never `avoid` (the line the day before said). A
 * learner who asked for lines without their streak gets the two routine lines
 * that carry no count at all.
 */
function lineFor(day: DayKey, n: number, lifetime: number, mentionStreak: boolean, avoid: string | null): ReminderLine {
  if (mentionStreak && n >= 1 && isStreakMilestone(n + 1) && avoid !== MILESTONE_EVE_LINE.id) return MILESTONE_EVE_LINE;
  const set = mentionStreak && n >= 1 ? STREAK_LINES : mentionStreak && lifetime >= 1 ? ROUTINE_LINES : ROUTINE_LINES.slice(0, 2);
  const index = dayNumber(day) % set.length;
  const line = set[index]!;
  return line.id === avoid ? set[(index + 1) % set.length]! : line;
}

/**
 * The slots to hand the OS, oldest first: at most one a day, none on a day
 * already practised, and a pause note in the fifth unanswered slot with nothing
 * after it. Empty when the reminder is off or paused.
 */
export function planReminders(input: PlanInput): ReminderSlot[] {
  const { now, calendar, choice } = input;
  if (choice.enabled !== true || choice.paused === true) return [];
  const today = calendar.dayOf(now);
  const practiceDays = input.practiceDays.filter((day) => isDayKey(day) && day <= today);
  const practised = new Set(practiceDays);
  const budget = UNANSWERED_LIMIT + 1 - unansweredRun(input.log, practiceDays, today);
  if (budget <= 0) return [];
  const time = fireTime(choice, input.finishes, now, calendar);
  const weekdays = Array.isArray(choice.days) && choice.days.length > 0 ? new Set(choice.days) : null;
  const lifetime = practised.size;
  const mentionStreak = choice.mentionStreak !== false;

  const days: { day: DayKey; at: number }[] = [];
  for (let offset = 0; offset < PLAN_DAYS && days.length < budget; offset += 1) {
    const day = addDays(today, offset);
    if (weekdays !== null && !weekdays.has(expoWeekday(day))) continue;
    if (day === today && (practised.has(today) || input.todayUnknown === true)) continue;
    const at = calendar.at(day, time.hour, time.minute);
    if (at <= now) continue;
    days.push({ day, at });
  }

  const pauseLine = input.guest === true ? GUEST_PAUSE_LINE : PAUSE_LINE;
  // The line the day before said: the last one that arrived, then each slot's own.
  let previous: { day: DayKey; line: string } | null = input.log.last ?? null;
  return days.map(({ day, at }, index) => {
    const pause = days.length === budget && index === budget - 1;
    // The run as it will stand on `day` if nothing else is practised first:
    // the streak counts the days before it, and a day not yet lived is open.
    const n = streakFrom({ practiceDays, covers: input.covers, today: day }).current;
    const avoid = previous !== null && previous.day === addDays(day, -1) ? previous.line : null;
    const line = pause ? pauseLine : lineFor(day, n, lifetime, mentionStreak, avoid);
    previous = { day, line: line.id };
    const message = reminderMessage(line, { n, lifetime, tutor: input.tutor });
    return { id: `${SLOT_PREFIX}${day}` as const, day, at, title: message.title, body: message.body, open: line.open, line: line.id, pause };
  });
}

/** The log entry for what was just handed to the OS. */
export function plannedSlots(slots: readonly ReminderSlot[]): PlannedSlot[] {
  return slots.map((slot) => ({ day: slot.day, at: slot.at, line: slot.line, ...(slot.pause ? { pause: true as const } : {}) }));
}
