/**
 * Today's nudge slot as Today draws it (Board A moment 3). The freeze line is
 * gone once seen, and whether it has been seen is a read of the synced game
 * store, so the slot holds the line back until that read has answered:
 * drawing it and then taking it away would be a line the learner half saw.
 * `known` holds what the reads said; a read that failed counts as unseen.
 */

import type { DayKey, StreakState } from '@luvani/core';

import { todayNudge, type TodayNudge } from './nudge.ts';

export function nudgeSlot(
  run: Pick<StreakState, 'current' | 'today' | 'lastPracticeDay' | 'coveredInRun'> | null,
  today: DayKey | null,
  known: ReadonlyMap<string, boolean>,
): { nudge: TodayNudge | null; ask: string | null } {
  if (today === null) return { nudge: null, ask: null };
  const nudge = todayNudge(run, today, (key) => known.get(key) === true);
  if (nudge?.seenKey != null && !known.has(nudge.seenKey)) return { nudge: null, ask: nudge.seenKey };
  return { nudge, ask: null };
}
