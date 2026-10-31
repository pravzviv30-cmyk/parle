/**
 * What Home's hero says (F767; README Part 5.F, Part 6): the flame and the
 * streak, today's goal ring in measured minutes, and the level chip.
 *
 * Every number is one the game view read from disk, through the hooks
 * (`useStreak`, `useGoal`, `useLevel`, `useXp`): this file never works out a
 * level or an XP total (README Part 6, `display.test.ts`). When any of the
 * facts could not be read, or have not been read yet, the hero is null and
 * draws nothing: it never shows a 0 it cannot vouch for.
 *
 * - The flame is lit only when today counts. With no run there is no number,
 *   and the words say how a streak starts.
 * - The ring is today's measured minutes over the learner's goal, floored,
 *   with untimed practice adding nothing (`core/goal`). With no goal chosen
 *   there is no ring, only the minutes. Met is the mint ring and the words for
 *   it.
 * - The chip is the numbered level. Rank names are never shown.
 *
 * Pure, so `todayHeroView.test.ts` holds it without a renderer.
 */

import type { GoalProgress, StreakState, XpLevel } from '@luvani/core';

import { GAME_COPY } from './copy.ts';
import type { XpView } from './view.ts';

export interface TodayHeroView {
  flame: {
    /** True only when today counts. */
    lit: boolean;
    /** The live run's practice days, or null when there is no run, so no number is drawn. */
    count: number | null;
    /** The words beside the flame. */
    words: string;
    /** What a screen reader says for the flame half. */
    label: string;
  };
  goal: {
    /** Today's measured minutes, floored. */
    minutes: number;
    /** Some time was measured today but less than a whole minute (F918): drawn "Under 1", never a nought. */
    underAMinute?: boolean;
    /** The chosen goal in minutes, or null when none is chosen (then there is no ring). */
    target: number | null;
    /** Minutes over the goal, 0 to 1, or null with no goal. */
    fraction: number | null;
    met: boolean;
    words: string;
    label: string;
  };
  level: {
    level: number;
    words: string;
    label: string;
  };
}

export interface TodayHeroFacts {
  streak: StreakState | null;
  goal: GoalProgress | null;
  level: XpLevel | null;
  xp: XpView | null;
}

const whole = (value: number): number => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);

export function todayHeroView(facts: TodayHeroFacts): TodayHeroView | null {
  const { streak, goal, level, xp } = facts;
  if (streak === null || goal === null || level === null || xp === null) return null;

  const current = whole(streak.current);
  const practised = streak.today === 'practised';
  const running = current > 0;

  const minutes = whole(goal.minutes);
  const target = goal.target;
  const met = target !== null && goal.met;
  const under = minutes === 0 && Number.isFinite(goal.activeMs) && goal.activeMs > 0;
  const said = under ? (target === null ? 'Under 1' : 'under 1') : minutes;

  return {
    flame: {
      lit: practised,
      count: running ? current : null,
      words: running ? GAME_COPY.streak.label : GAME_COPY.streakScreen.startStreak,
      label: running ? GAME_COPY.spoken.streak(current, practised) : GAME_COPY.spoken.noStreak,
    },
    goal: {
      minutes,
      underAMinute: under,
      target,
      fraction: target === null ? null : Math.min(1, minutes / target),
      met,
      words: met ? GAME_COPY.goal.reached : target === null ? GAME_COPY.goal.minutesToday(minutes) : GAME_COPY.goal.progress(minutes, target),
      // Said as drawn: "Under 1" on the ring is "under 1" aloud, never "0 of 5".
      label: target === null ? GAME_COPY.spoken.minutes(said) : GAME_COPY.spoken.goal(said, target),
    },
    level: {
      level: level.level,
      words: GAME_COPY.level.title(level.level),
      label: GAME_COPY.spoken.level(level.level, whole(xp.total), level.toNext),
    },
  };
}

/**
 * The stats row's three tiles (2026-10-20, B5, B-Today): "3 days" over
 * "streak", "6 of 10" over "min today" (or "6 min" over "today" with no goal
 * chosen), and "XP level 2" over "140 XP" (F858). With no run there is no number and no
 * streak word: "Practice" over "not yet today" (B5 learning-science review). The spoken labels stay the hero's own.
 */
export function statTiles(hero: TodayHeroView, xpTotal: number): Record<'streak' | 'goal' | 'level', { value: string; label: string }> {
  const count = hero.flame.count;
  return {
    streak: count === null ? { value: 'Practice', label: 'not yet today' } : { value: streakDays(count), label: 'streak' },
    goal: hero.goal.target === null
      ? { value: `${minutesWords(hero)} min`, label: 'today' }
      : { value: `${minutesWords(hero)} of ${hero.goal.target}`, label: 'min today' },
    level: { value: GAME_COPY.level.title(hero.level.level), label: GAME_COPY.level.total(whole(xpTotal)) },
  };
}

/** "Under 1" while less than a minute was measured, so a short live sitting never reads nought (F918). */
export const UNDER_A_MINUTE = 'Under 1';
const minutesWords = (hero: TodayHeroView): string => (hero.goal.underAMinute === true ? UNDER_A_MINUTE : String(hero.goal.minutes));

/** "1 day", "3 days": the streak tile's number, the same words while it counts up. */
export const streakDays = (count: number): string => `${count} ${count === 1 ? 'day' : 'days'}`;

/**
 * Direction A's chunky stat tiles (UI-015): a big number over one small word.
 * With no run the streak tile says "Start" over "today", never a nought
 * (founder, 2026-10-31); under a minute is "<1" (founder, 2026-10-31). The
 * spoken labels stay the hero's own.
 */
export interface StatTileView {
  streak: { number: string; label: string; lit: boolean };
  goal: { number: string; of: string | null; label: string; ring: boolean; fraction: number | null };
  level: { number: string; label: string };
}

export function statTileView(hero: TodayHeroView): StatTileView {
  const count = hero.flame.count;
  const target = hero.goal.target;
  return {
    streak: count === null
      ? { number: 'Start', label: 'today', lit: hero.flame.lit }
      : { number: String(count), label: count === 1 ? 'day' : 'days', lit: hero.flame.lit },
    goal: {
      number: hero.goal.underAMinute === true ? '<1' : String(hero.goal.minutes),
      of: target === null ? null : `/${target}`,
      label: 'minutes',
      ring: target !== null,
      fraction: hero.goal.fraction,
    },
    level: { number: String(hero.level.level), label: 'level' },
  };
}

/**
 * How a tile sets its coin and its words.
 *
 * Three tiles share the row inside 16pt page margins with 8pt between them, so
 * at 375 each tile is (375 - 32 - 16) / 3 = 109pt: the 38pt coin, an 8pt gap
 * and "minutes" fit side by side inside 12pt padding (38 + 8 + 12 * 2 = 70,
 * leaving 34pt+ for the words at 1.0). At 320 a tile is (320 - 32 - 16) / 3 =
 * 91pt and "minutes" cannot sit beside the coin, so the coin stacks over the
 * number. From 1.6 (accessibility sizes) the tiles become full-width rows.
 */
export const SIDE_MIN_WIDTH = 104;
export const STAT_COIN = 38;
export const STAT_GAP = 8;
export const STAT_PADDING = 12;
export const SIDE_MAX_FONT_SCALE = 1.15;
export const ROWS_FONT_SCALE = 1.6;

export type StatTileLayout = 'side' | 'stacked' | 'rows';

export function statTileLayout(tileWidth: number, fontScale: number): StatTileLayout {
  if (!Number.isFinite(tileWidth) || !Number.isFinite(fontScale)) return 'stacked';
  if (fontScale >= ROWS_FONT_SCALE) return 'rows';
  return tileWidth >= SIDE_MIN_WIDTH && fontScale <= SIDE_MAX_FONT_SCALE ? 'side' : 'stacked';
}

/** One tile's width in a measured row: three tiles with two `STAT_GAP`s between them. */
export function statRowTileWidth(rowWidth: number): number {
  return (rowWidth - 2 * STAT_GAP) / 3;
}

/**
 * The coins' grounds (UI-015 dark table): butter, sage and lavender in light;
 * in dark the flame's butter would read as mud on the card, so it sits on the
 * hero chip. Decorative: each tile's label names its stat.
 */
export function statCoins(t: { mode: 'light' | 'dark'; butter: string; heroChip: string; sage: string; lavender: string }): { streak: string; goal: string; level: string } {
  return { streak: t.mode === 'dark' ? t.heroChip : t.butter, goal: t.sage, level: t.lavender };
}
