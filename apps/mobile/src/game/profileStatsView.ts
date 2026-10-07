/**
 * Profile's game half (F769; README Part 5.F): the two tiles, the freezes a
 * plan holds, and the daily goal as five choices.
 *
 * - The tiles are the streak (it opens the Streak screen) and the level (it
 *   opens Progress), each from the game view; a tile whose fact could not be
 *   read is not drawn, and the level is a number, never a rank name.
 * - The freezes line is a subscriber's alone (D4) and only once the plan is
 *   known. A free learner is not sold anything here.
 * - The goal is No goal, Casual, Regular, Serious and Intense (D5): core's
 *   four tiers, gentlest first, after the choice of none. The days-a-week
 *   question is gone. Each tier says its size in words, as the rest of the
 *   settings card does, so no settings label counts at anybody.
 *
 * Pure, so `profileStatsView.test.ts` holds it without a renderer.
 */

import { DAILY_GOAL_TIERS, type DailyGoalMinutes, type DailyGoalTierId, type StreakState, type XpLevel } from '@luvani/core';

import { GAME_COPY } from './copy.ts';

export interface StatTileView {
  id: 'streak' | 'level';
  value: string;
  words: string;
  label: string;
  opens: 'Streak' | 'MyFrench';
}

export interface ProfileStatsView {
  tiles: readonly StatTileView[];
  /** "2 ready", for a subscriber; null for anyone else or an unknown plan. */
  freezes: { title: string; ready: string; held: number } | null;
}

export function profileStatsView(input: {
  streak: StreakState | null;
  level: XpLevel | null;
  freezes: number | null;
  protection: { freezes: boolean } | null;
}): ProfileStatsView | null {
  const tiles: StatTileView[] = [];
  if (input.streak !== null) {
    const current = Math.max(0, Math.floor(input.streak.current));
    const words = GAME_COPY.streakScreen.count(current);
    tiles.push({ id: 'streak', value: `${current}`, words: GAME_COPY.streak.label, label: `${words}. Opens your streak.`, opens: 'Streak' });
  }
  if (input.level !== null) {
    const title = GAME_COPY.level.title(input.level.level);
    tiles.push({ id: 'level', value: `${input.level.level}`, words: 'Level', label: `${title}. Opens Progress.`, opens: 'MyFrench' });
  }
  if (tiles.length === 0) return null;
  const freezes =
    input.protection?.freezes === true && input.freezes !== null
      ? { title: GAME_COPY.streakScreen.freezes.title, ready: GAME_COPY.streakScreen.freezes.ready(input.freezes), held: input.freezes }
      : null;
  return { tiles, freezes };
}

export type GoalChoiceKey = 'none' | DailyGoalTierId;

export interface GoalChoice {
  key: GoalChoiceKey;
  minutes: DailyGoalMinutes | null;
  title: string;
  detail: string;
}

/** Each tier's minutes as a word, so the choice never shows a numeral. */
const MINUTE_WORDS: Readonly<Record<DailyGoalMinutes, string>> = { 5: 'Five', 10: 'Ten', 15: 'Fifteen', 20: 'Twenty' };

export const NO_GOAL = 'No goal';

export const GOAL_CHOICES: readonly GoalChoice[] = [
  { key: 'none', minutes: null, title: NO_GOAL, detail: 'Practise when it suits you' },
  ...DAILY_GOAL_TIERS.map((tier) => ({
    key: tier.id,
    minutes: tier.minutes,
    title: tier.label,
    detail: `${MINUTE_WORDS[tier.minutes]} minutes a day`,
  })),
];

/** The choice a stored goal marks: none for no goal, or the tier with those minutes. */
export function goalChoiceOf(minutes: number | null): GoalChoiceKey {
  return GOAL_CHOICES.find((choice) => choice.minutes === minutes)?.key ?? 'none';
}
