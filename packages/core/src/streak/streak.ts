/**
 * The daily streak, folded from practice days (founder decisions D2 to D4).
 *
 * A streak day is any finished practice on the learner's local calendar day.
 * The number is the practice days in the live run. A covered day (a freeze, a
 * repair, a travel day) keeps the run alive and adds nothing to the count, so
 * the number a learner reads is always days they practised, never days a rule
 * filled in for them.
 *
 * The run ends at today when today is practised, otherwise at yesterday: until
 * today is over, an unpractised today is still open, not a gap. Days after
 * today are ignored everywhere, so a clock that runs fast on another device can
 * never tick off a day the learner has not lived yet (the `ahead` rule from
 * the app's momentum card).
 *
 * Nothing here reads a clock. `today` is passed in, which is what lets every
 * rule below be tested across midnight, daylight saving and a leap day.
 */

import { addDays, daysBetween, daysInMonth, isDayKey, weekdayIndex, type DayKey } from './dayKey.ts';

export type CoverKind = 'freeze' | 'repair' | 'travel';

export interface StreakCover {
  day: DayKey;
  kind: CoverKind;
  /** Epoch ms when the cover was written. */
  at: number;
}

export interface StreakInput {
  practiceDays: readonly DayKey[];
  covers: readonly StreakCover[];
  today: DayKey;
}

export interface StreakState {
  /** Practice days in the live run. Covers bridge the run and add 0. */
  current: number;
  today: 'practised' | 'open';
  /** First practice day of the live run, or null when there is no run. */
  runStart: DayKey | null;
  /** The longest run ever held, counted the same way. Never below `current`. */
  longest: number;
  /** Practice days in all, up to today. Covers never add to it. */
  lifetimeDays: number;
  lastPracticeDay: DayKey | null;
  /** Uncovered days between the last practised-or-covered day and today, today excluded. */
  gap: DayKey[];
  coveredInRun: { day: DayKey; kind: CoverKind }[];
}

/** When two covers name one day, the earliest written wins; a tie goes by this order. */
const KIND_ORDER: readonly CoverKind[] = ['travel', 'repair', 'freeze'];

interface Days {
  today: DayKey;
  practised: ReadonlySet<DayKey>;
  covered: ReadonlyMap<DayKey, CoverKind>;
}

/**
 * The facts the rules read, cleaned once.
 *
 * Unreadable keys are dropped, practice after today is ignored, and a cover
 * counts only for a day before today that was not practised (a practised day
 * needs no cover, and today is never covered).
 */
function daysOf(input: StreakInput): Days {
  if (!isDayKey(input.today)) throw new RangeError(`Not a calendar day: "${input.today}"`);
  const today = input.today;
  const practised = new Set<DayKey>();
  for (const day of input.practiceDays) {
    if (isDayKey(day) && day <= today) practised.add(day);
  }
  const chosen = new Map<DayKey, StreakCover>();
  for (const cover of input.covers) {
    if (!isDayKey(cover.day) || cover.day >= today || practised.has(cover.day)) continue;
    if (!KIND_ORDER.includes(cover.kind)) continue;
    const held = chosen.get(cover.day);
    if (
      !held ||
      cover.at < held.at ||
      (cover.at === held.at && KIND_ORDER.indexOf(cover.kind) < KIND_ORDER.indexOf(held.kind))
    ) {
      chosen.set(cover.day, cover);
    }
  }
  const covered = new Map<DayKey, CoverKind>();
  for (const [day, cover] of chosen) covered.set(day, cover.kind);
  return { today, practised, covered };
}

function counts(days: Days, day: DayKey): boolean {
  return days.practised.has(day) || days.covered.has(day);
}

interface Run {
  current: number;
  runStart: DayKey | null;
  coveredInRun: { day: DayKey; kind: CoverKind }[];
}

/** The live run, walked back one calendar day at a time from its end. */
function runEndingAt(days: Days, end: DayKey): Run {
  let current = 0;
  let runStart: DayKey | null = null;
  const covers: { day: DayKey; kind: CoverKind }[] = [];
  for (let day = end; counts(days, day); day = addDays(day, -1)) {
    if (days.practised.has(day)) {
      current += 1;
      runStart = day;
    } else {
      covers.push({ day, kind: days.covered.get(day)! });
    }
  }
  // Covers before the run's first practice day belong to no run.
  const coveredInRun = runStart === null ? [] : covers.filter((c) => c.day > runStart!).reverse();
  return { current, runStart, coveredInRun };
}

export function streakFrom(input: StreakInput): StreakState {
  const days = daysOf(input);
  const { today, practised, covered } = days;
  const practisedToday = practised.has(today);

  const run = runEndingAt(days, practisedToday ? today : addDays(today, -1));

  // Every counted day, oldest first, folded into runs for the longest.
  const counted = [...new Set([...practised, ...covered.keys()])].sort();
  let longest = 0;
  let inRun = 0;
  let previous: DayKey | null = null;
  for (const day of counted) {
    if (previous === null || daysBetween(previous, day) !== 1) inRun = 0;
    if (practised.has(day)) inRun += 1;
    if (inRun > longest) longest = inRun;
    previous = day;
  }

  const sortedPractice = [...practised].sort();
  const lastPracticeDay = sortedPractice.length > 0 ? sortedPractice[sortedPractice.length - 1]! : null;

  // The gap runs from the day after the last counted day before today, up to yesterday.
  const before = counted.filter((day) => day < today);
  const lastCounted = before.length > 0 ? before[before.length - 1]! : null;
  const gap: DayKey[] = [];
  if (lastCounted !== null) {
    for (let day = addDays(lastCounted, 1); day < today; day = addDays(day, 1)) gap.push(day);
  }

  return {
    current: run.current,
    today: practisedToday ? 'practised' : 'open',
    runStart: run.runStart,
    longest: Math.max(longest, run.current),
    lifetimeDays: practised.size,
    lastPracticeDay,
    gap,
    coveredInRun: run.coveredInRun,
  };
}

// ─────────────────────────────────────────────────────────────── milestones

/** The named milestones. After 365, every further 365 days is one too. */
export const STREAK_MILESTONES = [7, 30, 100, 365] as const;

const YEAR = 365;

export function isStreakMilestone(days: number): boolean {
  const n = Math.floor(days);
  if (n <= 0) return false;
  return (STREAK_MILESTONES as readonly number[]).includes(n) || (n > YEAR && n % YEAR === 0);
}

/** The first milestone after `days`. */
export function nextStreakMilestone(days: number): number {
  const n = Math.max(0, Math.floor(days));
  for (const m of STREAK_MILESTONES) if (m > n) return m;
  return (Math.floor(n / YEAR) + 1) * YEAR;
}

/**
 * The milestone a streak passed going from `before` to `after`, or null.
 *
 * When one change passes several (a seeded history, a sync), the largest is
 * named: one celebration for the biggest true thing, never a burst.
 */
export function milestoneCrossed(before: number, after: number): number | null {
  const from = Math.floor(before);
  const to = Math.floor(after);
  if (!(to > from) || to < STREAK_MILESTONES[0]) return null;
  let largest: number;
  if (to >= YEAR) {
    largest = Math.floor(to / YEAR) * YEAR;
  } else {
    largest = STREAK_MILESTONES[0];
    for (const m of STREAK_MILESTONES) if (m <= to) largest = m;
  }
  return largest > from ? largest : null;
}

// ──────────────────────────────────────────────────── the week and the month

export type DayState = 'practised' | 'covered' | 'today-open' | 'open' | 'ahead';

export type WeekdayLetter = 'M' | 'T' | 'W' | 'F' | 'S';

/** Full names, for screen readers; the strip draws only the letter. */
export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

const WEEKDAY_LETTERS: readonly WeekdayLetter[] = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export interface WeekCell {
  day: DayKey;
  label: WeekdayLetter;
  name: (typeof WEEKDAY_NAMES)[number];
  state: DayState;
  /** What covered the day, when `state` is `covered`. */
  cover: CoverKind | null;
}

export interface MonthCell {
  day: DayKey;
  /** Day of the month, from 1. */
  date: number;
  /** 0 for Monday through 6 for Sunday, so a grid knows where the 1st sits. */
  weekday: number;
  state: DayState;
  cover: CoverKind | null;
}

/**
 * How a day is drawn. Future first, so a stray future timestamp is still drawn
 * as ahead. There is no "missed": a past day without practice is simply open.
 */
function stateOf(days: Days, day: DayKey): { state: DayState; cover: CoverKind | null } {
  if (day > days.today) return { state: 'ahead', cover: null };
  if (days.practised.has(day)) return { state: 'practised', cover: null };
  if (day === days.today) return { state: 'today-open', cover: null };
  const cover = days.covered.get(day);
  if (cover) return { state: 'covered', cover };
  return { state: 'open', cover: null };
}

/** This calendar week, Monday first, with today in it. */
export function weekStripFrom(input: StreakInput): WeekCell[] {
  const days = daysOf(input);
  const monday = addDays(days.today, -weekdayIndex(days.today));
  return WEEKDAY_LETTERS.map((label, i) => {
    const day = addDays(monday, i);
    return { day, label, name: WEEKDAY_NAMES[i]!, ...stateOf(days, day) };
  });
}

/** Every day of one month (`month` from 1), first to last. Empty for a month that does not exist. */
export function monthFrom(input: StreakInput & { year: number; month: number }): MonthCell[] {
  const { year, month } = input;
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || year < 1 || year > 9999) {
    return [];
  }
  const days = daysOf(input);
  const prefix = `${`${year}`.padStart(4, '0')}-${`${month}`.padStart(2, '0')}-`;
  const cells: MonthCell[] = [];
  for (let date = 1; date <= daysInMonth(year, month); date += 1) {
    const day = `${prefix}${`${date}`.padStart(2, '0')}`;
    cells.push({ day, date, weekday: weekdayIndex(day), ...stateOf(days, day) });
  }
  return cells;
}

/** Shared with the freeze, repair and travel rules, so they read the same cleaned facts. */
export function streakDaysOf(input: StreakInput): {
  today: DayKey;
  practised: ReadonlySet<DayKey>;
  covered: ReadonlyMap<DayKey, CoverKind>;
} {
  return daysOf(input);
}

/** Practice days in the run that ends on `end` (covers bridge it, adding 0). */
export function runLengthEndingAt(input: StreakInput, end: DayKey): number {
  return runEndingAt(daysOf(input), end).current;
}
