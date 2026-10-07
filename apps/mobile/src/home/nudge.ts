/**
 * Home's one line under the hero (F767; README Part 5.F).
 *
 * Said only when a streak is really running (at least one practice day in the
 * live run, which means yesterday counted) and today has not been practised
 * yet. Otherwise there is no line at all: a learner who has practised, who has
 * no run, or whose facts could not be read is told nothing. On the eve of a
 * milestone the line names the milestone instead.
 *
 * The words are `game/copy.ts`'s, which holds them to the streak copy rules:
 * a fact and an offer, never a warning, a countdown or a plea.
 */

import { isStreakMilestone, type StreakState } from '@luvani/core';

import { GAME_COPY } from '../game/copy.ts';

export function homeNudge(run: Pick<StreakState, 'current' | 'today'> | null): string | null {
  if (run === null || run.today !== 'open') return null;
  if (!Number.isSafeInteger(run.current) || run.current < 1) return null;
  const next = run.current + 1;
  return isStreakMilestone(next) ? GAME_COPY.nudge.milestoneEve(next) : GAME_COPY.nudge.waiting(run.current);
}
