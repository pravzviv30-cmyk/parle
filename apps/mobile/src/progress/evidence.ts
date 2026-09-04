/**
 * The evidence row — what My French can honestly count, and when.
 *
 * Three facts sit at the head of My French: situations handled, lines kept,
 * and the level name. Each is a count core or the phrasebook already keeps,
 * read here and never recomputed, and each appears only once it is real. A
 * learner who has done nothing meets no row at all, on progress/today.ts's
 * rule: a rail of zeros is a quota, and a quota is the streak wearing a
 * different hat. `hasEvidence` is the gate the screen waits on, and the screen
 * decides none of this itself.
 *
 * Profile borrows `levelName` for the line under the learner's name, so the
 * two surfaces cannot disagree about when a level is worth saying: Home's level
 * card, My French's row and Profile's line all go quiet at zero XP together.
 *
 * Numbers are allowed here. My French is not mid-session, and DESIGN.md's rule
 * is that no mid-session message counts at anybody. What is still banned is a
 * ratio, a percentage or a score, and nothing below can produce one.
 */

import { levelFor, totalXp, type LevelStanding, type MissionProgress } from '@luvani/core';
import type { Phrasebook } from '../phrases/phrasebook.ts';

export interface EvidenceStat {
  /** A count or a level name, never a ratio. */
  value: string;
  /** Words under the value: soft ink, sentence case, no digit. */
  label: string;
}

export interface Evidence {
  situations: number;
  lines: number;
  standing: LevelStanding;
  /** Only what has been earned, in reading order. Empty draws nothing. */
  stats: readonly EvidenceStat[];
}

/** The level worth saying, or nothing: a name at zero XP is a promise, not evidence. */
export function levelName(standing: LevelStanding): string | null {
  return standing.xp > 0 ? standing.name : null;
}

export function evidenceFrom(input: {
  missions: readonly Pick<MissionProgress, 'timesFinished'>[];
  book: Pick<Phrasebook, 'count'>;
  activity: Parameters<typeof totalXp>[0];
}): Evidence {
  const situations = input.missions.filter((item) => item.timesFinished > 0).length;
  const lines = input.book.count;
  const standing = levelFor(totalXp(input.activity));
  const stats: EvidenceStat[] = [];
  if (situations > 0) {
    stats.push({ value: String(situations), label: situations === 1 ? 'Situation handled' : 'Situations handled' });
  }
  if (lines > 0) {
    stats.push({ value: String(lines), label: lines === 1 ? 'Line kept' : 'Lines kept' });
  }
  const level = levelName(standing);
  if (level !== null) stats.push({ value: level, label: 'Level' });
  return { situations, lines, standing, stats };
}

/** The gate the screen waits on. False draws no row at all. */
export function hasEvidence(evidence: Evidence): boolean {
  return evidence.stats.length > 0;
}
