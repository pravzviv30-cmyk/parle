/**
 * The largest `game` blob the reader in `model.ts` accepts, built rather than
 * estimated (F729).
 *
 * Every list at its cap, every string at its longest, every number as wide as
 * the reader lets it be: moments at the last instant a date can hold (sixteen
 * digits, which a merge can carry in from another device even though a local
 * write refuses anything after tomorrow), a bonus key's stamp at its thirteen
 * digits, active time at its one-day ceiling, every XP and count at its bound.
 * `model.test.ts` seals it in a sync envelope and measures it against the
 * 512 KiB ceiling, and `scripts/verifyDataBoundaries.mjs` writes it into a
 * disposable `learner_state` so the database's own byte, item and depth limits
 * are measured too. A bound raised in `model.ts` grows this blob, and both
 * checks then say whether it still fits. Pure: no storage, no clock.
 */

import { QUESTS, addDays, dayKeyOf, type DayKey } from '@luvani/core';

import {
  CLAIM_DAYS_KEPT,
  GAME_VERSION,
  MAX_BADGE_ID,
  MAX_BADGES,
  MAX_BONUS,
  MAX_COVERS,
  MAX_GAME_TIME,
  MAX_GOAL_DAYS,
  MAX_MONTH_COUNT,
  MAX_MONTH_XP,
  MAX_MONTHS,
  MAX_ROW_XP,
  MAX_SEEN,
  MAX_SEEN_KEY,
  MAX_SITTING_ACTIVE_MS,
  MAX_SITTINGS,
  QUEST_DAYS_KEPT,
  type StoredGame,
} from './model.ts';

/** A month key `n` months before `month`. */
function monthsBefore(month: string, n: number): string {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 - n;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** The widest stamp a bonus key may carry: thirteen digits. */
const WIDEST_KEY_STAMP = 9_999_999_999_999;

export function fullGame(now: number): StoredGame {
  const today: DayKey = dayKeyOf(now);
  // Sixteen digits, every one distinct, all within a second of each other so no age window cuts any.
  const at = (i: number): number => MAX_GAME_TIME - i;
  const month = today.slice(0, 7);
  const ids = QUESTS.map((q) => q.id).sort((a, b) => b.length - a.length);
  return {
    version: GAME_VERSION,
    sittings: Array.from({ length: MAX_SITTINGS }, (_, i) => ({ at: at(i), source: 'review' as const, activeMs: MAX_SITTING_ACTIVE_MS })),
    covers: Array.from({ length: MAX_COVERS }, (_, i) => ({ day: addDays(today, -i), kind: 'freeze' as const, at: at(i) })),
    goalDays: Array.from({ length: MAX_GOAL_DAYS }, (_, i) => addDays(today, -i)),
    questDays: Array.from({ length: QUEST_DAYS_KEPT }, (_, i) => ({ day: addDays(today, -i), ids: [ids[0]!, ids[1]!, ids[2]!], at: at(i) })),
    claims: Array.from({ length: CLAIM_DAYS_KEPT }, (_, d) =>
      ids.map((questId, q) => ({ day: addDays(today, -d), questId, xp: MAX_ROW_XP, at: at(d * ids.length + q) })),
    ).flat(),
    questMonths: Array.from({ length: MAX_MONTHS }, (_, i) => ({ month: monthsBefore(month, i), count: MAX_MONTH_COUNT, xp: MAX_MONTH_XP })),
    xpMonths: Array.from({ length: MAX_MONTHS }, (_, i) => ({ month: monthsBefore(month, i), xp: MAX_MONTH_XP })),
    bonus: Array.from({ length: MAX_BONUS }, (_, i) => ({
      key: `${'x'.repeat(24)}:${WIDEST_KEY_STAMP - i}`,
      xp: MAX_ROW_XP,
      at: at(i),
    })),
    bonusMonths: Array.from({ length: MAX_MONTHS }, (_, i) => ({ month: monthsBefore(month, i), xp: MAX_MONTH_XP })),
    badges: Array.from({ length: MAX_BADGES }, (_, i) => ({ id: `badge-${String(i).padStart(MAX_BADGE_ID - 6, '0')}`, at: at(i) })),
    seen: Array.from({ length: MAX_SEEN }, (_, i) => ({ key: `level:${String(i).padStart(MAX_SEEN_KEY - 6, '0')}`, at: at(i) })),
  };
}
