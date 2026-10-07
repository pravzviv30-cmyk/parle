/**
 * What the game layer shows, worked out from facts already on disk (Come
 * alive, Phase 1, F744).
 *
 * Pure: no storage, no clock, no React. `game/settle.ts` reads the stores and
 * hands the facts here, the hooks in `GameProvider.tsx` render what comes back,
 * and every rule about a number a learner sees lives in this file or in core,
 * so the end card, Home and the takeovers can only ever agree.
 *
 * Two rules matter most.
 *
 * - **One shown cap.** Activity XP is counted under `DAILY_XP_CAP` (100 a day),
 *   the same cap that pitches content difficulty (README Part 6). Quest XP and
 *   the fixed +5 "for practising" XP are kept in the game store, outside the
 *   activity log, so no new activity kind ever exists (F731).
 * - **The total never falls.** Each month counts the larger of the stored
 *   rollup and what the live rows still show, so an activity entry aging out of
 *   the log after 400 days, or a claim aging out after 62, takes nothing away.
 *
 * One rule about quests on two devices. A day's deal is frozen per device, and
 * two devices can be dealt different quests for the same day (the microphone,
 * the plan and the practice days synced so far all feed the deal). After a
 * merge the earliest deal is the one shown, but a quest the other device dealt,
 * the learner finished and the device credited stays earned: its claim is a
 * persisted event, the store's monthly rollups already count it, and taking it
 * back would make the total fall. So XP and the monthly quest count read every
 * claim; the day's rows read the deal shown; and `done` counts every quest
 * claimed today, whichever device's deal it came from, up to three. Claims
 * only ever join, so the day's count never falls after a merge, and "All three
 * quests done today." is said only once three quests really were (D22).
 */

import {
  DAILY_XP_CAP,
  freezesHeld,
  goalProgressFrom,
  localDayKey,
  milestoneCrossed,
  questMonthOf,
  questProgress,
  repairOffer,
  streakFrom,
  xpLevelFor,
  type BadgeFacts,
  type DailyGoalMinutes,
  type DayFacts,
  type DayKey,
  type GoalProgress,
  type QuestId,
  type QuestProgress,
  type RepairOffer,
  type StreakCover,
  type StreakState,
  type XpLevel,
} from '@luvani/core';

import { celebrationKey } from '../celebrate/events.ts';
import type { ActivityEntry } from '../progress/activity.ts';
import { capabilitiesFor, type PlanTier } from '../purchases/capabilities.ts';
import { bonusDay, type BadgeAward, type StoredGame, type XpMonth } from './model.ts';

/** The one daily cap a learner is shown for activity XP (README Part 6). */
export const SHOWN_XP_CAP = DAILY_XP_CAP;

/** The fixed XP for a win nothing grades (founder decision D6). */
export const PRACTISE_BONUS_XP = 5;

/** The part of the server's billing answer the game reads. Null everywhere means unknown. */
export interface BillingFacts {
  plan: PlanTier;
  lapsed: boolean;
  secondsRemaining: number;
  canStart: boolean;
}

/**
 * What other stores know that the game reads: the goal, the deck, the scenes
 * and the sound checks. Each is a count of persisted practice; a store that
 * cannot be read reads as nothing, which can only undercount.
 */
export interface OutsideFacts {
  goalTarget: DailyGoalMinutes | null;
  /** Phrase cards in the deck, sound cards excluded. */
  phraseCards: number;
  /** Phrase cards added today. */
  newPhrasesToday: number;
  /** Successful recalls, all time: Σ(reps − 1) over phrase cards. */
  recalls: number;
  /** Scenes earned on your own, ever. */
  scenesOnOwn: number;
  /** Scene finishes on your own today. */
  scenesOnOwnToday: number;
  allA0ScenesEarned: boolean;
  soundChecks: number;
  soundChecksToday: number;
}

export const NO_OUTSIDE_FACTS: OutsideFacts = {
  goalTarget: null,
  phraseCards: 0,
  newPhrasesToday: 0,
  recalls: 0,
  scenesOnOwn: 0,
  scenesOnOwnToday: 0,
  allA0ScenesEarned: false,
  soundChecks: 0,
  soundChecksToday: 0,
};

/** Everything the game layer derives from, read once. */
export interface GameFacts {
  activity: readonly ActivityEntry[];
  /** The learner's practice days: the streak's source of truth. */
  practiceDays: readonly DayKey[];
  game: StoredGame;
  outside: OutsideFacts;
  billing: BillingFacts | null;
}

export interface XpView {
  /** The displayed total: activity, quests and fixed XP, never falling. */
  total: number;
  activity: number;
  quests: number;
  bonus: number;
  /** Activity XP counted today under the shown cap. */
  today: number;
  /** True once today's activity XP has reached the shown cap. */
  todayCapped: boolean;
}

export interface QuestsView {
  day: DayKey;
  /** Today's three, or null until they are dealt. */
  ids: readonly QuestId[] | null;
  progress: readonly QuestProgress[];
  claimed: readonly QuestId[];
  /**
   * Today's quests done, 0 to 3: every quest claimed today, on this device or
   * another, up to the three a day holds. Never falls within a day.
   */
  done: number;
  facts: DayFacts;
}

export interface GameView {
  today: DayKey;
  streak: StreakState;
  /** Freezes ready now; 0 without a confirmed paid plan. */
  freezes: number;
  xp: XpView;
  level: XpLevel;
  goal: GoalProgress;
  quests: QuestsView;
  badges: readonly BadgeAward[];
  /**
   * The practice days and covers the streak is folded from, for the Streak
   * screen's week strip and month calendar (Phase 4), so they draw the same
   * days the number above counts.
   */
  days: { practiceDays: readonly DayKey[]; covers: readonly StreakCover[] };
  /** What the confirmed plan opens for the streak, or null while the plan is unknown. */
  protection: { freezes: boolean; repair: boolean } | null;
  /** The repair a subscriber is earning now, or null: never for a free learner or an unknown plan (D4). */
  repair: RepairOffer | null;
  /**
   * Measured minutes over every finished sitting this phone holds, floored:
   * the same sittings and the same rule as today's goal ring, so Progress's
   * "Minutes practised" and Home's ring agree about a daily phrase (Phase 4).
   */
  minutesPractised: number;
}

type DayOf = (at: number) => DayKey;

/**
 * Whether the server's answer opens streak protection (founder decision D4).
 * Unknown opens nothing. The one place the game layer asks the plan table, and
 * it reads `streakProtection` alone: freezes and repair gate no earned learning.
 */
export function protectionOf(billing: BillingFacts | null): { freezes: boolean; repair: boolean } | null {
  if (billing === null) return null;
  const protection = capabilitiesFor(billing.plan, billing.lapsed).streakProtection;
  return { freezes: protection.freezes > 0, repair: protection.repair };
}

/** Every finished sitting: the activity log's and the zero-XP ones the game store keeps. */
export function finishedSittings(facts: Pick<GameFacts, 'activity' | 'game'>): { at: number; activeMs?: number }[] {
  const out: { at: number; activeMs?: number }[] = [];
  for (const entry of facts.activity) out.push(entry.activeMs === undefined ? { at: entry.at } : { at: entry.at, activeMs: entry.activeMs });
  for (const sitting of facts.game.sittings) out.push(sitting.activeMs === undefined ? { at: sitting.at } : { at: sitting.at, activeMs: sitting.activeMs });
  return out;
}

/**
 * Whole minutes of measured active time over `sittings`, floored, by the goal
 * ring's rule (`core/goal`): an untimed sitting adds nothing, and a bad
 * measurement adds nothing rather than taking time away.
 */
export function measuredMinutes(sittings: readonly { activeMs?: number }[]): number {
  let ms = 0;
  for (const sitting of sittings) {
    const measured = sitting.activeMs;
    if (typeof measured === 'number' && Number.isFinite(measured)) ms += Math.max(0, measured);
  }
  return Math.floor(ms / 60_000);
}

/**
 * When each finished sitting of one kind ended: the log's entries of that kind
 * and the zero-XP sittings the game store keeps for it. A conversation that
 * earned nothing still happened, so it still counts as a conversation.
 */
export function finishedOfKind(facts: Pick<GameFacts, 'activity' | 'game'>, kind: ActivityEntry['kind']): number[] {
  return [
    ...facts.activity.filter((entry) => entry.kind === kind).map((entry) => entry.at),
    ...facts.game.sittings.filter((sitting) => sitting.source === kind).map((sitting) => sitting.at),
  ];
}

/** Capped activity XP per calendar month, the rows the rollup raises to. */
export function activityMonths(activity: readonly ActivityEntry[], dayOf: DayOf = localDayKey): XpMonth[] {
  const byDay = new Map<DayKey, number>();
  for (const entry of activity) {
    const day = dayOf(entry.at);
    byDay.set(day, (byDay.get(day) ?? 0) + Math.max(0, entry.xp));
  }
  const byMonth = new Map<string, number>();
  for (const [day, xp] of byDay) {
    const month = day.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + Math.min(xp, SHOWN_XP_CAP));
  }
  return [...byMonth.entries()]
    .filter(([, xp]) => xp > 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([month, xp]) => ({ month, xp: Math.floor(xp) }));
}

/** Σ over months of the larger of the stored rollup and the live figure. */
function neverFalling(live: ReadonlyMap<string, number>, stored: readonly { month: string; xp: number }[]): number {
  const months = new Map<string, number>(live);
  for (const row of stored) months.set(row.month, Math.max(months.get(row.month) ?? 0, row.xp));
  let total = 0;
  for (const xp of months.values()) total += xp;
  return total;
}

/** The displayed XP total and its three parts. */
export function displayXp(facts: Pick<GameFacts, 'activity' | 'game'>, dayOf: DayOf = localDayKey): { activity: number; quests: number; bonus: number; total: number } {
  const activityLive = new Map(activityMonths(facts.activity, dayOf).map((m) => [m.month, m.xp] as const));
  const questLive = new Map<string, number>();
  for (const claim of facts.game.claims) {
    const month = questMonthOf(claim.day);
    questLive.set(month, (questLive.get(month) ?? 0) + claim.xp);
  }
  const bonusLive = new Map<string, number>();
  for (const row of facts.game.bonus) {
    const day = bonusDay(row.key);
    if (day === null) continue;
    const month = day.slice(0, 7);
    bonusLive.set(month, (bonusLive.get(month) ?? 0) + row.xp);
  }
  const activity = neverFalling(activityLive, facts.game.xpMonths);
  const quests = neverFalling(questLive, facts.game.questMonths.map((m) => ({ month: m.month, xp: m.xp })));
  const bonus = neverFalling(bonusLive, facts.game.bonusMonths);
  return { activity, quests, bonus, total: activity + quests + bonus };
}

/** Today's facts for the quests, each counted from persisted practice. */
export function dayFactsFrom(facts: GameFacts, today: DayKey, goal: GoalProgress, dayOf: DayOf = localDayKey): DayFacts {
  const entries = facts.activity.filter((e) => dayOf(e.at) === today);
  const sittings = facts.game.sittings.filter((s) => dayOf(s.at) === today);
  const rawXp = entries.reduce((sum, e) => sum + Math.max(0, e.xp), 0);
  return {
    finished: entries.length + sittings.length,
    phrasePractices: sittings.filter((s) => s.source === 'phrase').length,
    recalled: entries.filter((e) => e.kind === 'review').reduce((sum, e) => sum + Math.max(0, e.xp), 0),
    conversations: entries.filter((e) => e.kind === 'convo').length + sittings.filter((s) => s.source === 'convo').length,
    practiceSets: entries.filter((e) => e.kind === 'drill').length + sittings.filter((s) => s.source === 'drill').length,
    xp: Math.min(rawXp, SHOWN_XP_CAP),
    minutes: goal.minutes,
    goalMet: goal.met,
    newPhrases: facts.outside.newPhrasesToday,
    scenesOnOwn: facts.outside.scenesOnOwnToday,
    soundChecks: facts.outside.soundChecksToday,
  };
}

/** Quests claimed per month, the larger of the rollup and the live claims. */
function questMonthCounts(game: StoredGame): { month: string; count: number }[] {
  const live = new Map<string, number>();
  for (const claim of game.claims) {
    const month = questMonthOf(claim.day);
    live.set(month, (live.get(month) ?? 0) + 1);
  }
  for (const row of game.questMonths) live.set(row.month, Math.max(live.get(row.month) ?? 0, row.count));
  return [...live.entries()].map(([month, count]) => ({ month, count }));
}

export function badgeFactsFrom(facts: GameFacts, view: Pick<GameView, 'streak' | 'level'>): BadgeFacts {
  return {
    longestStreak: view.streak.longest,
    lifetimeDays: view.streak.lifetimeDays,
    conversations: finishedOfKind(facts, 'convo').length,
    scenesOnOwn: facts.outside.scenesOnOwn,
    allA0ScenesEarned: facts.outside.allA0ScenesEarned,
    phraseCards: facts.outside.phraseCards,
    recalls: facts.outside.recalls,
    goalDays: facts.game.goalDays.length,
    level: view.level.level,
    soundChecks: facts.outside.soundChecks,
    questMonths: questMonthCounts(facts.game),
  };
}

/**
 * A day's quests done, 0 to 3: every distinct quest claimed that day, whichever
 * device's deal it came from, up to the three the deal holds. Nothing is done
 * on a day not dealt yet. `settle.ts` counts a sitting's `doneBefore` with it.
 */
export function questsDoneOf(ids: readonly QuestId[] | null, claimed: readonly QuestId[]): number {
  return ids === null ? 0 : Math.min(ids.length, new Set(claimed).size);
}

export function gameViewFrom(facts: GameFacts, today: DayKey, dayOf: DayOf = localDayKey): GameView {
  const streakInput = { practiceDays: facts.practiceDays, covers: facts.game.covers, today };
  const streak = streakFrom(streakInput);
  const protection = protectionOf(facts.billing);
  const freezes = freezesHeld({ ...streakInput, entitled: protection?.freezes === true });
  const xpParts = displayXp(facts, dayOf);
  const sittings = finishedSittings(facts);
  const goal = goalProgressFrom({ sittings, target: facts.outside.goalTarget, today, dayKey: dayOf });
  const dayFacts = dayFactsFrom(facts, today, goal, dayOf);
  const held = facts.game.questDays.find((row) => row.day === today);
  const ids = held ? [...held.ids] : null;
  const claimed = facts.game.claims.filter((c) => c.day === today).map((c) => c.questId);
  const todayRaw = facts.activity.filter((e) => dayOf(e.at) === today).reduce((sum, e) => sum + Math.max(0, e.xp), 0);
  return {
    today,
    streak,
    freezes,
    xp: { ...xpParts, today: Math.min(todayRaw, SHOWN_XP_CAP), todayCapped: todayRaw >= SHOWN_XP_CAP },
    level: xpLevelFor(xpParts.total),
    goal,
    quests: {
      day: today,
      ids,
      progress: ids === null ? [] : ids.map((id) => questProgress(id, dayFacts, facts.outside.goalTarget)),
      claimed,
      done: questsDoneOf(ids, claimed),
      facts: dayFacts,
    },
    badges: facts.game.badges,
    days: { practiceDays: facts.practiceDays, covers: facts.game.covers },
    protection,
    repair: protection?.repair === true ? repairOffer({ ...streakInput, entitled: true, sittings, dayKey: dayOf }) : null,
    minutesPractised: measuredMinutes(sittings),
  };
}

/**
 * The celebration keys for what is true now: today's streak, the
 * largest milestone of the live run, the current level and every badge held.
 * The existing-learner seed and the quiet catch-up mark these seen, so a fact
 * the learner already has never bursts onto the screen as news.
 */
export function currentMomentKeys(view: GameView): string[] {
  const keys: string[] = [];
  if (view.streak.today === 'practised') keys.push(celebrationKey.streak(view.today));
  const milestone = milestoneCrossed(0, view.streak.current);
  if (milestone !== null && view.streak.runStart !== null) keys.push(celebrationKey.milestone(milestone, view.streak.runStart));
  if (view.level.level >= 2) keys.push(celebrationKey.level(view.level.level));
  for (const badge of view.badges) keys.push(celebrationKey.badge(badge.id));
  return keys;
}
