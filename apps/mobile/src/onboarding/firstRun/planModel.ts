/**
 * The plan the first run builds, as data (come alive, README Part 5.C rows 1 to
 * 5). Pure, so a Node suite reads every rule:
 *
 * - `GOAL_TIERS`: the four daily goals (founder decision D5) and the share of a
 *   ring each one fills, which `GoalDial` draws.
 * - `suggestedMinutes`: the tier marked "Suggested". It is derived from the
 *   learner's own earlier answers by `presetMinutes` (work and a move ask for
 *   fifteen, a beginner five, everyone else ten), never from what other people
 *   chose, and never from an answer nobody gave: where the level was not asked
 *   (the short variant) only work or a move suggest anything. Nothing is
 *   preselected: the mark is a word, not a choice.
 * - `ringShare`: the plan reveal's ring, the same share the goal's dial shows.
 *   "Choose each time" sets no target, so its ring is the empty track.
 */

import type { GoalQuarters } from '../../icons/GoalDial.tsx';
import { levelOf, presetMinutes } from '../plan.ts';
import type { PlanMinutes, PreAccountOnboardingDraft } from '../preAccountDraft.ts';

export type GoalMinutes = 5 | 10 | 15 | 20;

export interface GoalTier {
  readonly minutes: GoalMinutes;
  readonly title: string;
  readonly quarters: GoalQuarters;
}

/** Casual, Regular, Serious, Intense: gentlest first. */
export const GOAL_TIERS: readonly GoalTier[] = [
  { minutes: 5, title: 'Casual', quarters: 1 },
  { minutes: 10, title: 'Regular', quarters: 2 },
  { minutes: 15, title: 'Serious', quarters: 3 },
  { minutes: 20, title: 'Intense', quarters: 4 },
];

/** What a goal tier says under its name. */
export function tierLine(minutes: GoalMinutes): string {
  return `${minutes} minutes a day`;
}

/** The one tier the learner's own answers point at. A true derivation, never "most common". */
export function suggestedMinutes(draft: PreAccountOnboardingDraft): GoalMinutes | null {
  // Without a level answer only the reason can point anywhere, and only work
  // and a move do; the default level is not something the learner said.
  if (draft.startLevel === null && draft.reason !== 'work' && draft.reason !== 'moving') return null;
  const preset = presetMinutes(levelOf(draft), draft.reason);
  return preset === 'none' ? null : preset;
}

/** What a screen reader says for one tier: its name, its size and, when true, that it is suggested. */
export function tierLabel(tier: GoalTier, suggested: boolean): string {
  return `${tier.title}, ${tierLine(tier.minutes)}${suggested ? ', suggested' : ''}`;
}

/** The share of the ring the plan reveal draws for a goal: a quarter per five minutes, none when no target is set. */
export function ringShare(minutes: PlanMinutes): number {
  return minutes === 'none' ? 0 : minutes / 20;
}
