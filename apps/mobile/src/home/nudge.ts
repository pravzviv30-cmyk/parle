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

import { addDays, isStreakMilestone, weekdayIndex, WEEKDAY_NAMES, type DayKey, type StreakState } from '@luvani/core';

import { celebrationKey } from '../celebrate/events.ts';
import { GAME_COPY } from '../game/copy.ts';

export function homeNudge(run: Pick<StreakState, 'current' | 'today'> | null): string | null {
  if (run === null || run.today !== 'open') return null;
  if (!Number.isSafeInteger(run.current) || run.current < 1) return null;
  const next = run.current + 1;
  return isStreakMilestone(next) ? GAME_COPY.nudge.milestoneEve(next) : GAME_COPY.nudge.waiting(run.current);
}

/** What Today's nudge slot shows: the line, whether the freeze mark sits beside it, and the seen key to mark once shown. */
export interface TodayNudge {
  readonly text: string;
  readonly freezeMark: boolean;
  /** `covered:<newest covered day>` for the freeze line, to mark seen (synced) once it has shown; null otherwise. */
  readonly seenKey: string | null;
}

/**
 * Today's nudge slot (Board A moment 3, founder 2026-11-19). Speaks only when
 * `homeNudge` would. A milestone eve keeps the slot; then, until it is seen,
 * the freeze line for days a freeze covered since the last practice (travel
 * days are not freezes); then the usual line. No streak count beside it.
 */
export function todayNudge(
  run: Pick<StreakState, 'current' | 'today' | 'lastPracticeDay' | 'coveredInRun'> | null,
  today: DayKey,
  seen: (key: string) => boolean,
): TodayNudge | null {
  const line = homeNudge(run);
  if (run === null || line === null) return null;
  const plain = { text: line, freezeMark: false, seenKey: null };
  if (isStreakMilestone(run.current + 1)) return plain;
  const last = run.lastPracticeDay;
  const frozen = last === null ? [] : run.coveredInRun.filter((held) => held.kind === 'freeze' && held.day > last).map((held) => held.day);
  const newest = frozen[frozen.length - 1];
  if (newest === undefined) return plain;
  const seenKey = celebrationKey.covered(newest);
  if (seen(seenKey)) return plain;
  const when = newest === addDays(today, -1) ? 'yesterday' : WEEKDAY_NAMES[weekdayIndex(newest)]!;
  return { text: frozen.length === 1 ? GAME_COPY.nudge.coveredDay(when) : GAME_COPY.nudge.coveredDays(frozen.length), freezeMark: true, seenKey };
}
