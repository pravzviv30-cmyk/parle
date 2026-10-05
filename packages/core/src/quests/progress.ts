/**
 * How far along a day's quests are, and what to claim.
 *
 * Every number comes from practice the app has already persisted; this module
 * only reads the counts it is handed. Progress is capped at the target, so a
 * quest never reads "7 of 5", and a quest or chest is claimed once a day
 * however many times the app asks.
 */

import type { DailyGoalMinutes } from '../goal/goal.ts';
import { CHEST, questTarget, type QuestId } from './catalogue.ts';

/** Today's facts, each counted from persisted practice. */
export interface DayFacts {
  /** Finished practices today, any kind, zero-XP ones included. */
  finished: number;
  /** Daily phrase practices finished today. */
  phrasePractices: number;
  /** Cards recalled in review today. */
  recalled: number;
  /** Conversations finished today. */
  conversations: number;
  /** Practice sets (drills) finished today. */
  practiceSets: number;
  /** Activity XP counted today under the daily cap. Quest XP is never in it. */
  xp: number;
  /** Measured minutes today, from `goalProgressFrom`. */
  minutes: number;
  goalMet: boolean;
  /** Phrase cards added to the deck today, sound cards excluded. */
  newPhrases: number;
  /** Scenes finished on your own today. */
  scenesOnOwn: number;
  /** Sound checks tried today. */
  soundChecks: number;
}

export interface QuestProgress {
  id: QuestId;
  done: number;
  target: number;
  complete: boolean;
}

function count(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function measure(id: QuestId, facts: DayFacts): number {
  switch (id) {
    case 'finish-practice':
    case 'practise-twice':
      return count(facts.finished);
    case 'phrase-of-day':
      return count(facts.phrasePractices);
    case 'review-recall':
      return count(facts.recalled);
    case 'conversation':
      return count(facts.conversations);
    case 'practice-set':
      return count(facts.practiceSets);
    case 'xp':
      return count(facts.xp);
    case 'minutes':
      return count(facts.minutes);
    case 'new-phrases':
      return count(facts.newPhrases);
    case 'scene-on-own':
      return count(facts.scenesOnOwn);
    case 'sound-check':
      return count(facts.soundChecks);
    case 'goal':
      return facts.goalMet === true ? 1 : 0;
  }
}

export function questProgress(id: QuestId, facts: DayFacts, goalTarget: DailyGoalMinutes | null = null): QuestProgress {
  const target = questTarget(id, goalTarget);
  const done = Math.min(target, measure(id, facts));
  return { id, done, target, complete: done >= target };
}

export interface QuestClaim {
  day: string;
  questId: QuestId | typeof CHEST;
}

/**
 * What to claim now: each of the day's quests that is complete and not yet
 * claimed, then the chest once all three are done (claimed earlier or now) and
 * the chest itself is not yet claimed.
 */
export function questsToClaim(input: {
  day: string;
  ids: readonly QuestId[];
  facts: DayFacts;
  goalTarget: DailyGoalMinutes | null;
  claims: readonly QuestClaim[];
}): (QuestId | typeof CHEST)[] {
  const claimed = new Set(input.claims.filter((c) => c.day === input.day).map((c) => c.questId));
  const ids = [...new Set(input.ids)];
  const out: (QuestId | typeof CHEST)[] = [];
  let allDone = ids.length === 3;
  for (const id of ids) {
    const complete = questProgress(id, input.facts, input.goalTarget).complete;
    if (complete && !claimed.has(id)) out.push(id);
    if (!complete && !claimed.has(id)) allDone = false;
  }
  if (allDone && !claimed.has(CHEST)) out.push(CHEST);
  return out;
}

/** `YYYY-MM` for a day key. */
export function questMonthOf(day: string): string {
  return day.slice(0, 7);
}

/** Quests claimed in one calendar month (`YYYY-MM`), the chest excluded, each day's quest once. */
export function monthlyQuestCount(claims: readonly QuestClaim[], month: string): number {
  const seen = new Set<string>();
  for (const claim of claims) {
    if (claim.questId === CHEST || questMonthOf(claim.day) !== month) continue;
    seen.add(`${claim.day}|${claim.questId}`);
  }
  return seen.size;
}
