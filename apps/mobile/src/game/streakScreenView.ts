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
 * - **Freezes and repair are a plan's** (D4). A subscriber sees the freezes
 *   card, and the repair card while a repair is being earned. A free learner
 *   sees one calm line, "Subscribers can repair a streak within 2 days.", and
 *   See plans, only while a streak that just ended could still be repaired:
 *   no notification, no countdown, nothing at any other time. While the plan
 *   is unknown, neither is said.
 * - **Month arrows** go back as far as the first practised month and forward
 *   no further than this one.
 *
 * Pure, so `streakScreenView.test.ts` holds it without a renderer.
 */

import {
  FREEZE_CAP,
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
    lit: boolean;
    words: string;
    lifetime: string;
    longest: string | null;
    today: string;
  };
  week: readonly DayCellView[];
  month: MonthView;
  freezes: { held: number; max: number; title: string; ready: string; line: string; returns: string | null } | null;
  repair: { title: string; line: string; progress: string; done: number; needed: number } | null;
  /** The free learner's one calm line just after a reset (D4), or null. */
  repairForSubscribers: { line: string; action: string } | null;
  milestones: readonly MilestoneView[];
  nextMilestone: string;
}

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
    }),
  );
  const first = firstPractisedMonth(view.days.practiceDays, today) ?? monthOf(today);
  const month: MonthView = {
    ...at,
    title: `${MONTH_NAMES[at.month - 1]!} ${at.year}`,
    leading: cells.length > 0 ? weekdayIndex(cells[0]!.day) : 0,
    cells,
    canGoBack: monthIndex(at) > monthIndex(first),
    canGoForward: monthIndex(at) < monthIndex(monthOf(today)),
  };

  const freezes =
    view.protection?.freezes === true
      ? (() => {
          const returning = view.freezes === 0 ? nextFreezeReturn({ ...input, entitled: true }) : null;
          return {
            held: view.freezes,
            max: FREEZE_CAP,
            title: copy.freezes.title,
            ready: copy.freezes.ready(view.freezes),
            line: copy.freezes.line,
            returns: returning === null ? null : copy.freezes.returns(weekdayDateWords(returning)),
          };
        })()
      : null;

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
  return {
    hero: {
      count: streak.current,
      lit: streak.today === 'practised',
      words: GAME_COPY.streak.label,
      lifetime: streak.lifetimeDays > 0 ? GAME_COPY.streak.lifetime(streak.lifetimeDays) : lifetimeDayLine([]),
      longest,
      today: streak.today === 'practised' ? copy.todayCounts : streak.current > 0 ? copy.reachNext(streak.current + 1) : copy.startsNext,
    },
    week,
    month,
    freezes,
    repair,
    repairForSubscribers,
    milestones,
    nextMilestone: copy.nextMilestone(nextStreakMilestone(streak.current)),
  };
}
