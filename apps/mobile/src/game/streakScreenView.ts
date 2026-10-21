/**
 * What the Streak screen says (F770; README Part 5.D, D2, D4, D19).
 *
 * Everything here comes from the game view, which read it from disk: the run,
 * the lifetime total and the longest run (`core/streak`), the week and the
 * month drawn from the same practice days and covers the number counts, the
 * freezes a plan holds and the repair a subscriber is earning. Nothing is
 * worked out a second way.
 *
 * - **No "missed".** A past day without practice is "no practice"; a covered
 *   day says what covered it; a day still to come says so.
 * - **The lifetime total is always beside the run**, so a reset never shows a
 *   learner nothing (D2).
 * - **Freezes and repair** (D4, D23). A subscriber sees the freezes card with
 *   two, and the repair card while a repair is being earned. A free learner
 *   sees the freezes card with their one freeze, and one calm line,
 *   "Subscribers get a second freeze and can repair a streak within 2 days.", and
 *   See plans, only while a streak that just ended could still be repaired:
 *   no notification, no countdown, nothing at any other time. While the plan
 *   is unknown, neither is said.
 * - **Month arrows** go back as far as the first practised month and forward
 *   no further than this one.
 *
 * Pure, so `streakScreenView.test.ts` holds it without a renderer.
 */

import {
  MONTH_NAMES,
  STREAK_MILESTONES,
  WEEKDAY_NAMES,
  isDayKey,
  localDayKey,
  monthFrom,
  nextFreezeReturn,
  nextStreakMilestone,
  recentBreak,
  weekStripFrom,
  weekdayIndex,
  type CoverKind,
  type DayKey,
  type DayState,
  type StreakCover,
} from '@luvani/core';

import { lifetimeDayLine } from '../progress/dayCount.ts';
import { GAME_COPY } from './copy.ts';
import type { MedalState } from './art/shapes.ts';
import type { GameView } from './view.ts';

export interface CalendarMonth {
  year: number;
  /** 1 to 12. */
  month: number;
}

export interface DayCellView {
  day: DayKey;
  state: DayState;
  cover: CoverKind | null;
  /** The weekday letter (the week strip) or the date (the month). */
  mark: string;
  /** What a screen reader says: the full weekday or date, then what the day was. */
  label: string;
  /** Whether this cell is today (B-Streak: its letter is drawn 800 ink). */
  today: boolean;
}

export interface MonthView extends CalendarMonth {
  title: string;
  /** Empty cells before the 1st, Monday first. */
  leading: number;
  cells: readonly DayCellView[];
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface MilestoneView {
  days: number;
  reached: boolean;
  medal: MedalState;
  words: string;
  /** "Reached 3 October 2026", "Reached" for one counted from saved practice, or null. */
  when: string | null;
  label: string;
}

export interface StreakScreenView {
  hero: {
    count: number;
    /** True while a run is going: only then is the count drawn. With none, the words say how one starts. */
    running: boolean;
    lit: boolean;
    words: string;
    lifetime: string;
    longest: string | null;
    today: string;
    /** What a screen reader hears for the whole hero. */
    label: string;
  };
  week: readonly DayCellView[];
  month: MonthView;
  freezes: { held: number; max: number; title: string; ready: string; line: string; returns: string | null } | null;
  /**
   * The B-Streak freeze card (2026-10-20 UI-008): "1 streak freeze ready",
   * "Free with every account" on the free plan (D23), the paragraph, and the
   * trial pill's line only while the plan holds no repair. Null while the plan
   * is unknown, as `freezes` is.
   */
  freezeCard: { title: string; sub: string; line: string; returns: string | null; upsell: string | null } | null;
  /** The B-Streak milestone row: "7 days: a whole week of French", its bar and "3 of 7 days". No reward line: none is stored. */
  milestone: { days: number; title: string; progress: string; fraction: number };
  repair: { title: string; line: string; progress: string; done: number; needed: number } | null;
  /** The free learner's one calm line just after a reset (D4), or null. */
  repairForSubscribers: { line: string; action: string } | null;
  milestones: readonly MilestoneView[];
  nextMilestone: string;
}

/**
 * The month as weeks of exactly seven, Monday first: `leading` blanks, the
 * dates, then blanks to fill the last week. Each week is drawn as its own row,
 * so the grid can never wrap into six columns (2026-10-21, simulator at 402pt).
 */
export function monthWeeks<T>(leading: number, cells: readonly T[]): (T | null)[][] {
  const flat: (T | null)[] = [...Array.from({ length: Math.max(0, leading) }, () => null), ...cells];
  while (flat.length % 7 !== 0) flat.push(null);
  const weeks: (T | null)[][] = [];
  for (let i = 0; i < flat.length; i += 7) weeks.push(flat.slice(i, i + 7));
  return weeks;
}

/** The month's header row, Monday first (B-Streak). */
export const WEEKDAY_LETTERS: readonly string[] = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const MILESTONE_MEDALS: readonly MedalState[] = ['sun', 'mint', 'blue'];

/** The words for what a day was. Never "missed". */
export function dayWords(state: DayState, cover: CoverKind | null): string {
  const said = GAME_COPY.streakScreen.day;
  switch (state) {
    case 'practised':
      return said.practised;
    case 'covered':
      return cover === 'repair' ? said.repair : cover === 'travel' ? said.travel : said.freeze;
    case 'today-open':
      return said.todayOpen;
    case 'open':
      return said.open;
    case 'ahead':
      return said.ahead;
  }
}

/** "3 October 2026", from a calendar day, with the month in English whatever the phone's locale. */
export function dateWords(day: DayKey, withYear = true): string {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  const words = `${date} ${MONTH_NAMES[month - 1]!}`;
  return withYear ? `${words} ${year}` : words;
}

/** "Tuesday 14 October", for the day a freeze comes back. */
export function weekdayDateWords(day: DayKey): string {
  return `${WEEKDAY_NAMES[weekdayIndex(day)]!} ${dateWords(day, false)}`;
}

export function monthOf(day: DayKey): CalendarMonth {
  return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) };
}

export function shiftMonth(at: CalendarMonth, by: number): CalendarMonth {
  const index = at.year * 12 + (at.month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

const monthIndex = (at: CalendarMonth): number => at.year * 12 + at.month - 1;

/** The first month with a practice day in it, up to today, or null with none. */
export function firstPractisedMonth(practiceDays: readonly DayKey[], today: DayKey): CalendarMonth | null {
  let first: DayKey | null = null;
  for (const day of practiceDays) {
    if (!isDayKey(day) || day > today) continue;
    if (first === null || day < first) first = day;
  }
  return first === null ? null : monthOf(first);
}

/** The month the screen may show: never after this month, never before the first practised one. */
export function clampMonth(wanted: CalendarMonth, practiceDays: readonly DayKey[], today: DayKey): CalendarMonth {
  const last = monthOf(today);
  const first = firstPractisedMonth(practiceDays, today) ?? last;
  const index = Math.min(monthIndex(last), Math.max(monthIndex(first), monthIndex(wanted)));
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** "7 days: a whole week of French", the bar's fraction and "3 of 7 days", for the run as it stands. */
export function milestoneRow(current: number): StreakScreenView['milestone'] {
  const run = Math.max(0, Math.floor(current));
  const days = nextStreakMilestone(run);
  return {
    days,
    title: GAME_COPY.streakScreen.milestoneTitle(days),
    progress: GAME_COPY.streakScreen.milestoneProgress(run, days),
    fraction: Math.min(1, run / days),
  };
}

type StreakFacts = Pick<GameView, 'today' | 'streak' | 'freezes' | 'days' | 'protection' | 'repair' | 'badges'>;

export function streakScreenView(view: StreakFacts, shown: CalendarMonth): StreakScreenView {
  const today = view.today;
  const input = { practiceDays: view.days.practiceDays, covers: view.days.covers as readonly StreakCover[], today };
  const { streak } = view;
  const copy = GAME_COPY.streakScreen;

  const week = weekStripFrom(input).map(
    (cell): DayCellView => ({
      day: cell.day,
      state: cell.state,
      cover: cell.cover,
      mark: cell.label,
      label: `${cell.name}, ${dayWords(cell.state, cell.cover)}`,
      today: cell.day === today,
    }),
  );

  const at = clampMonth(shown, view.days.practiceDays, today);
  const cells = monthFrom({ ...input, year: at.year, month: at.month }).map(
    (cell): DayCellView => ({
      day: cell.day,
      state: cell.state,
      cover: cell.cover,
      mark: `${cell.date}`,
      label: `${dateWords(cell.day, false)}, ${dayWords(cell.state, cell.cover)}`,
      today: cell.day === today,
    }),
  );
  const first = firstPractisedMonth(view.days.practiceDays, today) ?? monthOf(today);
  const month: MonthView = {
    ...at,
    // 2026-10-20 UI-008, artboard B-Streak: "October"; the year only for a year gone by.
    title: at.year === monthOf(today).year ? MONTH_NAMES[at.month - 1]! : `${MONTH_NAMES[at.month - 1]!} ${at.year}`,
    leading: cells.length > 0 ? weekdayIndex(cells[0]!.day) : 0,
    cells,
    canGoBack: monthIndex(at) > monthIndex(first),
    canGoForward: monthIndex(at) < monthIndex(monthOf(today)),
  };

  const freezes =
    view.protection?.freezes === true
      ? (() => {
          const cap = view.protection?.cap ?? 0;
          const returning = view.freezes === 0 ? nextFreezeReturn(cap, input) : null;
          return {
            held: view.freezes,
            max: cap,
            title: copy.freezes.title,
            ready: copy.freezes.ready(view.freezes),
            line: copy.freezes.line,
            returns: returning === null ? null : copy.freezes.returns(weekdayDateWords(returning), cap),
          };
        })()
      : null;

  const freezeCard =
    freezes === null
      ? null
      : {
          title: freezes.held > 0 ? copy.card.ready(freezes.held) : copy.card.inUse(freezes.max),
          sub: freezes.max <= 1 ? copy.card.free : copy.card.plan,
          line: copy.card.line(freezes.max),
          returns: freezes.returns,
          upsell: view.protection?.repair === false ? copy.card.upsell : null,
        };

  const offer = view.protection?.repair === true ? view.repair : null;
  const repair =
    offer !== null && !offer.ready
      ? {
          title: copy.repair.title(offer.runBefore),
          line: copy.repair.line,
          progress: copy.repair.progress(offer.done, offer.needed),
          done: offer.done,
          needed: offer.needed,
        }
      : null;

  // The free learner's one line: only once the plan is known not to repair, and
  // only while a streak that just ended could still be repaired (D4).
  const repairForSubscribers =
    view.protection !== null && view.protection.repair === false && recentBreak(input) !== null
      ? { line: GAME_COPY.streak.repairForSubscribers, action: GAME_COPY.seePlans }
      : null;

  const milestones = STREAK_MILESTONES.map((days, index): MilestoneView => {
    const reached = streak.longest >= days;
    const award = view.badges.find((badge) => badge.id === `streak-${days}`);
    const when = !reached ? null : award !== undefined && award.at !== null ? copy.reachedOn(dateWords(localDayKey(award.at))) : copy.reached;
    const words = copy.milestone(days);
    return {
      days,
      reached,
      medal: reached ? MILESTONE_MEDALS[index % MILESTONE_MEDALS.length]! : 'next',
      words,
      when,
      label: reached ? `${words} milestone. ${when}` : `${words} milestone, not reached yet`,
    };
  });

  const longest = streak.longest > 0 ? copy.longest(streak.longest) : null;
  // With no run going there is no number to draw: "0 day streak" would be a
  // nought said at somebody, so the words say how a streak starts instead.
  const running = streak.current > 0;
  const lifetime = streak.lifetimeDays > 0 ? GAME_COPY.streak.lifetime(streak.lifetimeDays) : lifetimeDayLine([]);
  const todayLine = streak.today === 'practised' ? copy.todayCounts : running ? copy.reachNext(streak.current + 1) : copy.startsNext;
  return {
    hero: {
      count: streak.current,
      running,
      lit: streak.today === 'practised',
      words: running ? GAME_COPY.streak.label : copy.startStreak,
      lifetime,
      longest,
      today: todayLine,
      label: `${running ? copy.count(streak.current) : copy.startStreak}. ${lifetime}.${longest === null ? '' : ` ${longest}.`} ${todayLine}`,
    },
    week,
    month,
    freezes,
    repair,
    repairForSubscribers,
    milestones,
    nextMilestone: copy.nextMilestone(nextStreakMilestone(streak.current)),
    freezeCard,
    milestone: milestoneRow(streak.current),
  };
}
