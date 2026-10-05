/**
 * The daily goal: a few minutes of practice a day, chosen by the learner
 * (founder decision D5 replaces the days-a-week question with it).
 *
 * The minutes rule is the app's momentum card rule (`goalFrom`,
 * apps/mobile/src/progress/momentum.ts), moved here so the goal ring, the
 * minutes quest and the momentum card can only ever agree:
 *
 * - Only measured active learning time counts (`activeMs`): typed or spoken,
 *   with idle and away gaps already left out by the screen's clock. Wall-clock
 *   duration is never read.
 * - A sitting with no measured time is untimed. It adds nothing and marks the
 *   day as partly untimed, because nothing measured is not zero minutes of
 *   practice, and a real sitting must never be read back as a nought.
 * - Minutes are floored. This is a claim about time the learner actually
 *   spent, and the direction to be wrong in is the modest one.
 */

import { localDayKey } from '../levels/levels.ts';

export type DailyGoalTierId = 'casual' | 'regular' | 'serious' | 'intense';

export type DailyGoalMinutes = 5 | 10 | 15 | 20;

export interface DailyGoalTier {
  id: DailyGoalTierId;
  minutes: DailyGoalMinutes;
  label: string;
  line: string;
}

export const DAILY_GOAL_TIERS: readonly DailyGoalTier[] = [
  { id: 'casual', minutes: 5, label: 'Casual', line: 'A quick moment of French' },
  { id: 'regular', minutes: 10, label: 'Regular', line: 'Room for a full scene' },
  { id: 'serious', minutes: 15, label: 'Serious', line: 'A longer conversation' },
  { id: 'intense', minutes: 20, label: 'Intense', line: 'Conversation plus practice' },
];

export function isDailyGoalMinutes(value: unknown): value is DailyGoalMinutes {
  return DAILY_GOAL_TIERS.some((tier) => tier.minutes === value);
}

/** The tier for a stored target, or null for no goal or a value no tier has. */
export function goalTierFor(minutes: number | null): DailyGoalTier | null {
  return DAILY_GOAL_TIERS.find((tier) => tier.minutes === minutes) ?? null;
}

export interface GoalSitting {
  /** Epoch ms when the sitting finished. */
  at: number;
  /** Measured active learning time, or absent when the sitting measured none. */
  activeMs?: number;
}

export interface GoalProgress {
  /** Measured active time today, in ms. */
  activeMs: number;
  /** Whole minutes of it, floored. */
  minutes: number;
  target: DailyGoalMinutes | null;
  /** True once the floored minutes reach the target. Never true without one. */
  met: boolean;
  /** True when a sitting today measured no time, so the minutes may undercount. */
  untimed: boolean;
}

export function goalProgressFrom(input: {
  sittings: readonly GoalSitting[];
  target: DailyGoalMinutes | null;
  today: string;
  dayKey?: (at: number) => string;
}): GoalProgress {
  const dayKey = input.dayKey ?? localDayKey;
  let activeMs = 0;
  let untimed = false;
  for (const sitting of input.sittings) {
    if (dayKey(sitting.at) !== input.today) continue;
    const measured = sitting.activeMs;
    if (typeof measured !== 'number' || !Number.isFinite(measured)) {
      untimed = true;
      continue;
    }
    activeMs += Math.max(0, measured);
  }
  const minutes = Math.floor(activeMs / 60_000);
  const target = isDailyGoalMinutes(input.target) ? input.target : null;
  return { activeMs, minutes, target, met: target !== null && minutes >= target, untimed };
}
