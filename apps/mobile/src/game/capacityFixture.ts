/**
 * The largest `game` blob the bounds in `model.ts` allow, built rather than
 * estimated (F729).
 *
 * Every list at its cap, every string at its longest, every number at its
 * widest. `model.test.ts` seals it in a sync envelope and measures it against
 * the 512 KiB ceiling, and `scripts/verifyDataBoundaries.mjs` writes it into a
 * disposable `learner_state` so the database's own byte, item and depth limits
 * are measured too. A bound raised in `model.ts` grows this blob, and both
 * checks then say whether it still fits. Pure: no storage, no clock.
 */

import { CHEST, QUESTS, addDays, dayKeyOf, type DayKey } from '@luvani/core';

import {
  CLAIM_KEEP_DAYS,
  GAME_VERSION,
  MAX_BADGE_ID,
  MAX_BADGES,
  MAX_BONUS,
  MAX_COVERS,
  MAX_GOAL_DAYS,
  MAX_MONTH_COUNT,
  MAX_MONTH_XP,
  MAX_MONTHS,
  MAX_ROW_XP,
  MAX_SEEN,
  MAX_SEEN_KEY,
  MAX_SITTINGS,
  QUEST_DAYS_KEPT,
  type StoredGame,
} from './model.ts';

/** A month key `n` months before `month`. */
function monthsBefore(month: string, n: number): string {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 - n;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function fullGame(now: number): StoredGame {
  const today: DayKey = dayKeyOf(now);
  const at = (i: number): number => now - i;
  const month = today.slice(0, 7);
  const ids = QUESTS.map((q) => q.id).sort((a, b) => b.length - a.length);
  return {
    version: GAME_VERSION,
    sittings: Array.from({ length: MAX_SITTINGS }, (_, i) => ({ at: at(i), source: 'review' as const, activeMs: 3_599_999.999 })),
    covers: Array.from({ length: MAX_COVERS }, (_, i) => ({ day: addDays(today, -i), kind: 'freeze' as const, at: at(i) })),
    goalDays: Array.from({ length: MAX_GOAL_DAYS }, (_, i) => addDays(today, -i)),
    questDays: Array.from({ length: QUEST_DAYS_KEPT }, (_, i) => ({ day: addDays(today, -i), ids: [ids[0]!, ids[1]!, ids[2]!], at: at(i) })),
    claims: Array.from({ length: CLAIM_KEEP_DAYS }, (_, d) =>
      [...ids, CHEST].map((questId, q) => ({ day: addDays(today, -d), questId, xp: MAX_ROW_XP, at: at(d * 13 + q) })),
    ).flat(),
    questMonths: Array.from({ length: MAX_MONTHS }, (_, i) => ({ month: monthsBefore(month, i), count: MAX_MONTH_COUNT, xp: MAX_MONTH_XP })),
    xpMonths: Array.from({ length: MAX_MONTHS }, (_, i) => ({ month: monthsBefore(month, i), xp: MAX_MONTH_XP })),
    bonus: Array.from({ length: MAX_BONUS }, (_, i) => ({
      key: `${'x'.repeat(24)}:${String(at(i)).padStart(13, '0')}`,
      xp: MAX_ROW_XP,
      at: at(i),
    })),
    bonusMonths: Array.from({ length: MAX_MONTHS }, (_, i) => ({ month: monthsBefore(month, i), xp: MAX_MONTH_XP })),
    badges: Array.from({ length: MAX_BADGES }, (_, i) => ({ id: `badge-${String(i).padStart(MAX_BADGE_ID - 6, '0')}`, at: at(i) })),
    seen: Array.from({ length: MAX_SEEN }, (_, i) => ({ key: `level:${String(i).padStart(MAX_SEEN_KEY - 6, '0')}`, at: at(i) })),
  };
}
