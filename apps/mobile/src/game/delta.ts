/**
 * What one finished sitting changed, read back after the writes landed.
 *
 * `game/settle.ts` produces it and nothing else does. A screen's end card draws
 * its tiles from it, and `game/events.ts` turns it into the moments the
 * celebration host may play. Every field is a value read from a persisted store
 * after the write resolved, never a value the screen believed it had earned, so
 * a number on a card is always a number on disk (founder KEEP rule: no fake
 * progress). A safety stop never settles (F137), so it never has a delta.
 *
 * The shared contract for Phase 1 of docs/come-alive (README Part 6): one
 * pipeline, one type.
 */
import type { CoverKind, DailyGoalMinutes, QuestId, StreakState } from '@luvani/core';
import type { SittingSource } from './model.ts';

/** Where a finished sitting came from (the game store's one list). Never a new activity kind (F731). */
export type { SittingSource };

export interface GameDelta {
  /** `sitting:${source}:${at}`, the sitting's identity on an end card. The store keys the same sitting as `${at}|${source}`. */
  readonly key: string;
  readonly source: SittingSource;
  /** Epoch ms the sitting finished. */
  readonly at: number;
  /** Measured active time of this sitting, or null when it was not timed. */
  readonly activeMs: number | null;
  readonly xp: {
    /** XP the sitting produced before any cap. */
    readonly earned: number;
    /** XP the displayed total actually gained from the activity log (the shown daily cap applies). */
    readonly counted: number;
    /** True when the daily cap withheld some of `earned`. */
    readonly capped: boolean;
    /** Fixed XP credited outside the activity log for this sitting (+5 on an ungraded win, D6). */
    readonly bonus: number;
    /** Quest XP credited by this sitting, +10 for each quest it finished. */
    readonly questXp: number;
    readonly totalBefore: number;
    readonly totalAfter: number;
  };
  readonly goal: {
    /** The learner's daily goal in minutes, or null when they chose none. */
    readonly target: DailyGoalMinutes | null;
    readonly minutesBefore: number;
    readonly minutesAfter: number;
    /** True only on the sitting that crossed the goal today. */
    readonly metNow: boolean;
  };
  readonly streak: {
    readonly before: StreakState;
    readonly after: StreakState;
    /** True only on the first finished practice of the day (or the one that completed a repair). */
    readonly extendedNow: boolean;
    /** The milestone this sitting crossed (7, 30, 100, 365, then every 365), or null. */
    readonly milestone: number | null;
    /** Set when this sitting completed a repair or a cover bridged the run, else null. */
    readonly restoredBy: CoverKind | null;
  };
  readonly quests: {
    /** Quests this sitting completed, in slot order. */
    readonly completedNow: readonly QuestId[];
    /** Quests done today after this sitting, 0 to 3. Read `allQuestsDoneNow` for the sitting that finished the third. */
    readonly done: number;
  };
  readonly level: {
    /** Display level (xpLevelFor) before and after. Never a level name. */
    readonly before: number;
    readonly after: number;
  };
  /** Badge ids awarded by this sitting, in catalogue order. */
  readonly badges: readonly string[];
}

/** The number of quests a day deals. */
const QUESTS_A_DAY = 3;

/**
 * True on the sitting that finished the day's third quest: it completed a
 * quest, and after it all three are done. That sitting's end card says "All
 * three quests done today." with the `quest` sound, and nothing else happens:
 * no chest, no extra XP, no takeover (founder decision D22). Every later end
 * that day still reads the quiet line, silently.
 */
export function allQuestsDoneNow(delta: Pick<GameDelta, 'quests'>): boolean {
  return delta.quests.completedNow.length > 0 && delta.quests.done >= QUESTS_A_DAY;
}
