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
 *    its place, and on a cliff day of a run of three or more, one where no
 *    freeze would cover it, the save set does; D25), otherwise the routine set; never the same line two days in a
 *    row; always the chosen tutor's name. The run is projected for each day as
 *    it will stand if nothing else is practised before then, spending the
 *    freezes the streak would spend on the way, which is truthful because
 *    every practice re-plans.
 *
 *    On top of that (T1.3, D28): after the save line, the free-talk line on
 *    the first slot at or after a known free refill, then the week on a
 *    Sunday; the named phrase sits in the rotations, picked for the slot's
 *    own day, and its id rides on the slot so a tap opens it.
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

import {
  addDays,
  dayKeyOf,
  doublePracticeDays,
  FREE_FREEZE_CAP,
  FREEZE_CAP,
  freezeCoverDays,
  isDayKey,
  isStreakMilestone,
  streakFrom,
  weekdayIndex,
  type DayKey,
  type FreezeProtection,
  type StreakCover,
} from '@luvani/core';

import {
  FREE_TALK_LINE,
  GUEST_PAUSE_LINE,
  MILESTONE_EVE_LINE,
  NAMED_PHRASE_LINE,
  PAUSE_LINE,
  ROUTINE_LINES,
  SMART_FALLBACK,
  STREAK_LINES,
  STREAK_SAVE_LINES,
  WEEKLY_LINE,
  namedPhraseFits,
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
  /** The phrase planned for the slot's day, which a tap opens (T1.3); absent for a guest. */
  phraseId?: string;
}

export interface PlanInput {
  now: number;
  calendar: Calendar;
  choice: StoredReminder;
  /** Finished practices, epoch ms. The smart time reads the last 14 days; the freeze bank reads every day with two. */
  finishes: readonly number[];
  /** The learner's practice days: the streak's own source. */
  practiceDays: readonly DayKey[];
  /** Days a freeze, a repair or a trip kept the run; none for a guest. */
  covers: readonly StreakCover[];
  /** What the learner's freezes may reach, as this phone saw it; absent when unknown (and for a guest), so no save line. */
  freezes?: FreezeProtection;
  /** The chosen tutor's name. */
  tutor: string;
  /** The log, already brought up to `now` (`settleLog`, then `noteOpened` when the app is open). */
  log: ReminderLog;
  /** A guest has no Settings, so their pause note says so without a door. */
  guest?: boolean;
  /** Plan nothing for today: the practice facts could not be read, so today might be practised. */
  todayUnknown?: boolean;
  /** The day's phrase for a slot's instant, as Home would pick it then; absent for a guest (T1.3). */
  phraseFor?: (at: number) => { id: string; en: string };
  /** On the free plan, when the free conversation comes back (`freeRefillOf`); absent when unknown (T1.3). */
  freeRefill?: number;
}

/**
 * The free plan's refill instant from what billing answered, or undefined for
 * a paid plan, an unknown plan, or a refill not yet known. Held in memory by
 * the planner only; a refill used on another device may leave it stale (D28).
 */
export function freeRefillOf(status: { plan: string; periodEnd: string | null } | null): number | undefined {
  if (status === null || status.plan !== 'trial' || status.periodEnd === null) return undefined;
  const at = new Date(status.periodEnd).getTime();
  return Number.isFinite(at) ? at : undefined;
}

/**
 * What this phone first saw of the learner's freezes (`game/gameLocal.ts`): a
 * paid plan holds two from paidSince, a protected free learner one, and
 * anything else is unknown, so no save line. No billing call.
 */
export function freezeProtectionOf(local: { paidSince: DayKey | null; protectedSince: DayKey | null } | null): FreezeProtection | undefined {
  if (local === null) return undefined;
  if (local.paidSince !== null) return { cap: FREEZE_CAP, paidSince: local.paidSince, protectedSince: local.protectedSince };
  if (local.protectedSince !== null) return { cap: FREE_FREEZE_CAP, paidSince: null, protectedSince: local.protectedSince };
  return undefined;
}

/** A save line needs a run of at least this many days (T1.2). */
export const SAVE_MIN_RUN = 3;

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
 * The line for one day: the milestone eve, the save set on a cliff day (no
 * freeze would cover it), the streak set, or the routine set,
 * rotated by the day, and never `avoid` (the line the day before said). A
 * learner who asked for lines without their streak gets the two routine lines
 * that carry no count at all.
 */
function lineFor(day: DayKey, n: number, lifetime: number, mentionStreak: boolean, avoid: string | null, cliff: boolean, special: ReminderLine | null, named: boolean): ReminderLine {
  if (mentionStreak && n >= 1 && isStreakMilestone(n + 1) && avoid !== MILESTONE_EVE_LINE.id) return MILESTONE_EVE_LINE;
  const save = mentionStreak && cliff && n >= SAVE_MIN_RUN;
  // Free talk, then the week (T1.3), after the save line and before the rotation.
  if (!save && special !== null) return special;
  const base = save ? STREAK_SAVE_LINES : mentionStreak && n >= 1 ? STREAK_LINES : mentionStreak && lifetime >= 1 ? ROUTINE_LINES : ROUTINE_LINES.filter((line) => line.id !== 'routine-so-far');
  // No phrase to name, or one that would fail the scans: the generic phrase line in its place.
  const generic = base === STREAK_LINES ? STREAK_LINES.find((line) => line.id === 'streak-phrase')! : ROUTINE_LINES.find((line) => line.id === 'routine-phrase')!;
  const set = named ? base : base.map((line) => (line === NAMED_PHRASE_LINE ? generic : line));
  const index = dayNumber(day) % set.length;
  const line = set[index]!;
  // The next line that differs, since the generic stand-in may sit beside the generic line itself.
  return line.id === avoid ? [...set.slice(index + 1), ...set.slice(0, index)].find((next) => next.id !== avoid) ?? line : line;
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
  const protection = input.guest === true ? undefined : input.freezes;
  let covers: readonly StreakCover[] = input.covers;
  // Days with two finished practices bank a freeze, read by the same rule settle reads.
  const bankDays = doublePracticeDays(input.finishes.map((at) => ({ at })), calendar.dayOf);
  let projectedTo: DayKey | null = protection === undefined ? null : today;
  // The line the day before said: the last one that arrived, then each slot's own.
  let previous: { day: DayKey; line: string } | null = input.log.last ?? null;
  const freeRefill = input.guest === true || input.freeRefill === undefined || input.freeRefill <= now ? undefined : input.freeRefill;
  return days.map(({ day, at }, index) => {
    const pause = days.length === budget && index === budget - 1;
    // The run as it will stand on `day` if nothing else is practised first:
    // the streak counts the days before it, and a day not yet lived is open.
    // Each day up to it spends the freezes the streak would spend (the same
    // rule, core `freezeCoverDays`), so the reminder and the streak agree.
    for (; projectedTo !== null && projectedTo <= day; projectedTo = addDays(projectedTo, 1)) {
      const spent = freezeCoverDays(protection!, { practiceDays, covers, today: projectedTo, bankDays });
      covers = [...covers, ...spent.map((cover) => ({ day: cover, kind: 'freeze' as const, at: now }))];
    }
    const n = streakFrom({ practiceDays, covers, today: day }).current;
    // A cliff: no freeze would cover `day` once it is over.
    const cliff = protection !== undefined && freezeCoverDays(protection, { practiceDays, covers, today: addDays(day, 1), bankDays }).length === 0;
    const avoid = previous !== null && previous.day === addDays(day, -1) ? previous.line : null;
    // The phrase planned for this day, named in the line and opened by a tap (T1.3).
    const phrase = input.guest === true ? undefined : input.phraseFor?.(at);
    // The free conversation back: the first slot at or after a refill still to come.
    const freeTalk = freeRefill !== undefined && at >= freeRefill && (index === 0 || days[index - 1]!.at < freeRefill);
    // The week ending this Sunday: its practice days and finished sittings, only with the streak mentioned.
    const from = addDays(day, -6);
    const week = { days: practiceDays.filter((d) => d >= from && d <= day).length, practices: input.finishes.filter((f) => calendar.dayOf(f) >= from && calendar.dayOf(f) <= day).length };
    const weekly = mentionStreak && weekdayIndex(day) === 6 && week.days >= 1;
    const special = freeTalk ? FREE_TALK_LINE : weekly ? WEEKLY_LINE : null;
    const line = pause ? pauseLine : lineFor(day, n, lifetime, mentionStreak, avoid, cliff, special, phrase !== undefined && namedPhraseFits(phrase.en, input.tutor));
    previous = { day, line: line.id };
    const message = reminderMessage(line, { n, lifetime, tutor: input.tutor, ...(phrase !== undefined ? { english: phrase.en } : {}), week });
    // A slot with a planned phrase opens a practice, never Home.
    const open = phrase !== undefined && line.open === 'home' ? 'daily-phrase' : line.open;
    return { id: `${SLOT_PREFIX}${day}` as const, day, at, title: message.title, body: message.body, open, line: line.id, pause, ...(phrase !== undefined ? { phraseId: phrase.id } : {}) };
  });
}

/** The log entry for what was just handed to the OS. */
export function plannedSlots(slots: readonly ReminderSlot[]): PlannedSlot[] {
  return slots.map((slot) => ({ day: slot.day, at: slot.at, line: slot.line, ...(slot.pause ? { pause: true as const } : {}) }));
}
