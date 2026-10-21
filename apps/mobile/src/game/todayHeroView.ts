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

  return {
    flame: {
      lit: practised,
      count: running ? current : null,
      words: running ? GAME_COPY.streak.label : GAME_COPY.streakScreen.startStreak,
      label: running ? GAME_COPY.spoken.streak(current, practised) : GAME_COPY.spoken.noStreak,
    },
    goal: {
      minutes,
      target,
      fraction: target === null ? null : Math.min(1, minutes / target),
      met,
      words: met ? GAME_COPY.goal.reached : target === null ? GAME_COPY.goal.minutesToday(minutes) : GAME_COPY.goal.progress(minutes, target),
      label: target === null ? GAME_COPY.spoken.minutes(minutes) : GAME_COPY.spoken.goal(minutes, target),
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
 * chosen), and "Level 2" over "140 XP". With no run there is no number and no
 * streak word: "Practice" over "not yet today" (B5 learning-science review). The spoken labels stay the hero's own.
 */
export function statTiles(hero: TodayHeroView, xpTotal: number): Record<'streak' | 'goal' | 'level', { value: string; label: string }> {
  const count = hero.flame.count;
  return {
    streak: count === null ? { value: 'Practice', label: 'not yet today' } : { value: streakDays(count), label: 'streak' },
    goal: hero.goal.target === null
      ? { value: `${hero.goal.minutes} min`, label: 'today' }
      : { value: `${hero.goal.minutes} of ${hero.goal.target}`, label: 'min today' },
    level: { value: GAME_COPY.level.title(hero.level.level), label: `${whole(xpTotal)} XP` },
  };
}

/** "1 day", "3 days": the streak tile's number, the same words while it counts up. */
export const streakDays = (count: number): string => `${count} ${count === 1 ? 'day' : 'days'}`;
