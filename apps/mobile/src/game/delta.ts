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
import { localDayKey, type CoverKind, type DailyGoalMinutes, type DayKey, type QuestId, type RepairOffer, type StreakCover, type StreakState } from '@luvani/core';
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
    /** True when this extension came after a day a freeze covered (any freeze the run kept, whoever wrote it). Board A moment 2. */
    readonly carried: boolean;
    /** The repair this settle wrote and the run kept, with the number the Streak screen promised, else null. Board A moment 4. */
    readonly repaired: RepairedRun | null;
  };
  readonly quests: {
    /** Quests this sitting completed, in slot order. */
    readonly completedNow: readonly QuestId[];
    /** Quests done today after this sitting, 0 to 3. Read `allQuestsDoneNow` for the sitting that finished the third. */
    readonly done: number;
    /**
     * Quests done today just before this sitting's own claims landed, 0 to 3,
     * counted from the same merged facts as `done`. A quest another phone
     * finished, even one that synced in while this sitting ran, was done before.
     */
    readonly doneBefore: number;
  };
  readonly level: {
    /** Display level (xpLevelFor) before and after. Never a level name. */
    readonly before: number;
    readonly after: number;
  };
  /** Badge ids awarded by this sitting, in catalogue order. */
  readonly badges: readonly string[];
  /** True only when this sitting's own landed write banked a freeze (Board A moment 5). Never predicted. */
  readonly banked: boolean;
}

export interface RepairedRun {
  /** The oldest day the kept repair covers: the moment's key is `repair:<day>`. */
  readonly day: DayKey;
  /** The run the Streak screen promised to bring back. */
  readonly runBefore: number;
}

/** The number of quests a day deals. */
const QUESTS_A_DAY = 3;

/**
 * True on the sitting that finished the day's third quest: its own claims took
 * the day from fewer than three done to three. That sitting's end card says
 * "All three quests done today." with the `quest` sound, and nothing else
 * happens: no chest, no extra XP, no takeover (founder decision D22). Once a
 * day reads three it stays three, so a later sitting that finishes another
 * quest (one from another phone's deal, after a merge) is not this sitting:
 * every later end that day still reads the quiet line, silently.
 */
export function allQuestsDoneNow(delta: Pick<GameDelta, 'quests'>): boolean {
  const { completedNow, done, doneBefore } = delta.quests;
  return completedNow.length > 0 && doneBefore < QUESTS_A_DAY && done >= QUESTS_A_DAY;
}

/**
 * True when the day's first practice extends a run across a day a freeze
 * covered since the previous practice. Read from the run as it stands, never
 * from what this settle wrote, because the quiet catch-up writes most freezes.
 * A refunded freeze (its day practised) is not in the run, a travel day is not
 * a freeze, and a repair takes its own moment.
 */
export function carriedNow(before: StreakState, after: StreakState, extendedFirst: boolean, repaired: RepairedRun | null): boolean {
  const last = before.lastPracticeDay;
  if (!extendedFirst || repaired !== null || last === null) return false;
  return after.coveredInRun.some((held) => held.kind === 'freeze' && held.day > last);
}

/**
 * The repair this settle wrote, if the run kept it as a repair: two phones can
 * write a freeze and a repair for one day, and the streak keeps one. Null when
 * nothing promised a number to bring back.
 */
export function repairedNow(written: readonly StreakCover[], after: StreakState, promised: RepairOffer | null): RepairedRun | null {
  if (promised === null) return null;
  const days = new Set(written.filter((cover) => cover.kind === 'repair').map((cover) => cover.day));
  const kept = after.coveredInRun.find((held) => held.kind === 'repair' && days.has(held.day));
  return kept === undefined ? null : { day: kept.day, runBefore: promised.runBefore };
}

/**
 * True only when this sitting banked a freeze and the disk says so: the bank
 * was empty before and is banked after, the sitting's day is a bank day, the
 * sitting itself is on disk, and neither the snapshot nor the disk (less this
 * sitting) held two sittings that day already, so a bank another phone made
 * is never claimed. A guest never banks.
 */
export function bankedNow(i: {
  source: SittingSource;
  at: number;
  day: DayKey;
  beforeSittings: readonly { at: number }[];
  afterSittings: readonly { at: number }[];
  beforeBanked: boolean;
  afterBanked: boolean;
  afterBankDays: readonly DayKey[];
}): boolean {
  if (i.source === 'guest' || i.beforeBanked || !i.afterBanked || !i.afterBankDays.includes(i.day)) return false;
  const onDay = (list: readonly { at: number }[]) => list.filter((sitting) => localDayKey(sitting.at) === i.day);
  const after = onDay(i.afterSittings);
  if (!after.some((sitting) => sitting.at === i.at)) return false;
  return onDay(i.beforeSittings).length < 2 && after.filter((sitting) => sitting.at !== i.at).length < 2;
}
