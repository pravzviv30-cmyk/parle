/**
 * Picking a day's three quests.
 *
 * Deterministic: a seeded generator (mulberry32) over an FNV-1a hash of
 * `${seed}|${day}`, where the seed is the account id. Two devices therefore
 * pick the same three without talking to each other, and the app saves the
 * first pick of the day so a later change in eligibility never reshuffles it.
 *
 * The hash and the generator are part of the contract between app versions:
 * change either and two devices on different builds disagree about the day.
 * The pinned pick in select.test.ts is there to make that change loud.
 */

import type { DailyGoalMinutes } from '../goal/goal.ts';
import { QUESTS, questEligible, type QuestEligibility, type QuestFamily, type QuestId, type QuestSlot } from './catalogue.ts';

/** 32-bit FNV-1a over the string's UTF-16 code units (the standard hash for ASCII ids). */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** The mulberry32 generator: numbers in [0, 1), the same sequence for the same seed. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Day one's quests: no choice, three things a first day can do. */
export const DAY_ONE_QUESTS: readonly [QuestId, QuestId, QuestId] = ['finish-practice', 'phrase-of-day', 'minutes'];

const SLOTS: readonly QuestSlot[] = ['easy', 'core', 'stretch'];

/** Always offerable in each slot, and of different families, so a pick can never come up empty. */
const FALLBACK: Readonly<Record<QuestSlot, QuestId>> = { easy: 'finish-practice', core: 'practice-set', stretch: 'sound-check' };

export function questsForDay(input: {
  day: string;
  seed: string;
  eligibility: QuestEligibility;
  goalTarget: DailyGoalMinutes | null;
}): [QuestId, QuestId, QuestId] {
  if (input.eligibility.practiceDaysBefore <= 0) return [...DAY_ONE_QUESTS];

  const random = mulberry32(fnv1a(`${input.seed}|${input.day}`));
  const families = new Set<QuestFamily>();
  const picked: QuestId[] = [];
  for (const slot of SLOTS) {
    const candidates = QUESTS.filter(
      (q) => q.slot === slot && !families.has(q.family) && questEligible(q.id, input.eligibility, input.goalTarget),
    );
    // Drawn even when there is one candidate, so each slot always uses one
    // number and a change in one slot's eligibility never shifts another's.
    const draw = random();
    const quest = candidates.length > 0 ? candidates[Math.floor(draw * candidates.length)]! : QUESTS.find((q) => q.id === FALLBACK[slot])!;
    families.add(quest.family);
    picked.push(quest.id);
  }
  return [picked[0]!, picked[1]!, picked[2]!];
}
