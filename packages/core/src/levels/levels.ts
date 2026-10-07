/**
 * Experience, the six names it earns, and the numbered level a learner sees.
 *
 * Two constraints shaped every number here.
 *
 * The first is PRODUCT.md principle 4, "Competence over compulsion": a ladder
 * is a compulsion metric unless every input is evidence of competence. So XP is
 * earned ONLY for production — words actually said, turns composed unaided,
 * phrases resolved, cards recalled. Never for minutes elapsed, sessions
 * started, or opening the app. You cannot grind this by leaving it running.
 *
 * The second is that a day should not be able to buy a level. Hence the daily
 * cap: a marathon Sunday counts for a good day and no more, which also means
 * the ladder measures returning rather than bingeing.
 *
 * Two ladders live here and they must not be confused. `levelFor` and its six
 * names are the content-difficulty standing: they pick the daily phrase pool
 * and the scene, and are never rendered. `xpLevelFor` is the numbered level a
 * learner sees (Level 1, 2, 3), on its own fixed curve. Changing the first would
 * silently change what content a learner gets, so the display never reads it.
 *
 * The daily streak (founder decision D2, 2026-10-04) counts practice days, not
 * XP, and lives in `../streak`. Fixed bonuses (quests and the +5 for
 * practising) are kept by the app outside the activity log, so nothing in this
 * file ever sees them and no new activity kind is needed.
 */

export const LEVEL_NAMES = ['Beginner', 'Rookie', 'General', 'Captain', 'Master', 'Veteran'] as const;

export type LevelName = (typeof LEVEL_NAMES)[number];

/**
 * XP at which each level begins.
 *
 * Increments of 150 / 450 / 900 / 1700 / 2800 — decelerating, so the early
 * levels arrive while a habit is still forming and the last one is a real
 * distance. At a steady four sittings a week (roughly 130 XP), Rookie lands in
 * about a week and a half, General around five weeks, Captain around eleven,
 * Master around six months, and Veteran a little under a year.
 */
export const LEVEL_THRESHOLDS: readonly number[] = [0, 150, 600, 1500, 3200, 6000];

/** Nobody earns more than this in one day, however long they stay. */
export const DAILY_XP_CAP = 100;

export interface LevelStanding {
  index: number;
  name: LevelName;
  /** Total XP earned, all time. */
  xp: number;
  /** Null at the top of the ladder. */
  next: { name: LevelName; xpAway: number } | null;
}

export function levelFor(xp: number): LevelStanding {
  const total = Math.max(0, Math.floor(xp));
  let index = 0;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i += 1) {
    if (total >= LEVEL_THRESHOLDS[i]!) index = i;
  }
  const nextIndex = index + 1;
  const next =
    nextIndex < LEVEL_THRESHOLDS.length
      ? { name: LEVEL_NAMES[nextIndex]!, xpAway: LEVEL_THRESHOLDS[nextIndex]! - total }
      : null;
  return { index, name: LEVEL_NAMES[index]!, xp: total, next };
}

// ───────────────────────────────────────────────────────────── what earns XP

/** Only the fields XP cares about, so callers need not pass a whole summary. */
export interface LessonEvidence {
  /** Distinct words said aloud, correctly. */
  wordsProduced: readonly string[];
  /** Share of turns the learner composed French for themselves. */
  unassistedRate: number;
}

export interface ConversationEvidence {
  /** Phrases the recap kept — what the learner actually got said. */
  phraseCount: number;
  unassistedRate: number;
}

export interface DrillEvidence {
  /** Ended correct first time. */
  clean: number;
  /** Ended correct after the spelling was pointed out. */
  typoCorrected: number;
}

export interface ReviewEvidence {
  /** Cards recalled without help. */
  recalled: number;
}

function clamp(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(value)));
}

/** A finished guided lesson. */
export function lessonXp(e: LessonEvidence): number {
  const words = Math.min(e.wordsProduced.length, 10) * 2;
  const unaided = e.unassistedRate >= 0.5 ? 10 : 0;
  return clamp(20 + words + unaided, 60);
}

/** A finished free conversation. */
export function conversationXp(e: ConversationEvidence): number {
  const phrases = Math.max(0, e.phraseCount) * 2;
  const unaided = e.unassistedRate >= 0.5 ? 10 : 0;
  return clamp(25 + phrases + unaided, 70);
}

/** One sitting at the drill bank. */
export function drillXp(e: DrillEvidence): number {
  return clamp(Math.max(0, e.clean) * 2 + Math.max(0, e.typoCorrected), 30);
}

/** One sitting at the review deck. */
export function reviewXp(e: ReviewEvidence): number {
  return clamp(Math.max(0, e.recalled), 20);
}

// ────────────────────────────────────────────────────────────── the daily cap

export interface DatedXp {
  /** Epoch milliseconds. */
  at: number;
  xp: number;
}

/**
 * Total XP with the daily cap applied.
 *
 * Grouped by LOCAL calendar date rather than UTC, so a session at eleven at
 * night counts for the day the learner thinks they did it. `dayKey` is injected
 * for the same reason the rest of core takes `now`: a rule about dates that
 * cannot be tested across a boundary is a rule nobody can trust.
 *
 * `cap` defaults to the content-difficulty cap, which is also the one cap the
 * learner is shown (README Part 6). It is a parameter so a caller never has to
 * re-implement the grouping to ask a different question of the same log.
 */
export function totalXp(
  entries: readonly DatedXp[],
  dayKey: (at: number) => string = localDayKey,
  cap: number = DAILY_XP_CAP,
): number {
  const byDay = new Map<string, number>();
  for (const e of entries) {
    const key = dayKey(e.at);
    byDay.set(key, (byDay.get(key) ?? 0) + Math.max(0, e.xp));
  }
  const limit = Math.max(0, cap);
  let total = 0;
  for (const dayTotal of byDay.values()) total += Math.min(dayTotal, limit);
  return total;
}

/**
 * The XP one new entry actually adds to the capped total.
 *
 * `entries` is the log BEFORE `entry` was written. The answer is the change in
 * `totalXp`, never the entry's own figure, so the "+N XP" on an end card can
 * only name what was counted: after a long day it may be less than the sitting
 * earned, and once the day is full it is 0 and the card draws no XP line.
 * Only entries on the same local day as `entry` can change the answer, so
 * those are the only ones summed.
 */
export function xpCreditedFor(
  entries: readonly DatedXp[],
  entry: DatedXp,
  cap: number = DAILY_XP_CAP,
  dayKey: (at: number) => string = localDayKey,
): number {
  const limit = Math.max(0, cap);
  const day = dayKey(entry.at);
  let before = 0;
  for (const e of entries) {
    if (dayKey(e.at) === day) before += Math.max(0, e.xp);
  }
  const after = before + Math.max(0, entry.xp);
  return Math.min(after, limit) - Math.min(before, limit);
}

// ─────────────────────────────────────────────────── the level a learner sees

/** The longest a single display level ever takes, in XP. */
export const LEVEL_STEP_MAX = 500;

/**
 * XP from the start of display level `level` to the start of the next.
 *
 * min(500, 50 + 25(n - 1)): fifty for the first, twenty-five more each level,
 * flat at five hundred from Level 19 on. The step never shrinks, so a later
 * level is never quicker than an earlier one, and the flat top means a steady
 * learner keeps levelling about once a week rather than watching the gaps grow
 * without end.
 */
export function levelStep(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return Math.min(LEVEL_STEP_MAX, 50 + 25 * (n - 1));
}

/** The level at which the step first reaches its ceiling. */
const FLAT_FROM = (LEVEL_STEP_MAX - 50) / 25 + 1; // 19

/** XP at which display level `level` begins. Level 1 begins at 0. */
export function levelThreshold(level: number): number {
  const n = Math.max(1, Math.floor(level));
  // Sum of the rising steps 1 .. min(n - 1, FLAT_FROM - 1), then flat steps.
  const rising = Math.min(n - 1, FLAT_FROM - 1);
  const risingXp = rising * 50 + (25 * rising * (rising - 1)) / 2;
  const flat = Math.max(0, n - 1 - rising);
  return risingXp + flat * LEVEL_STEP_MAX;
}

export interface XpLevel {
  /** The numbered level, from 1. Never a name. */
  level: number;
  /** XP earned since this level began. */
  intoLevel: number;
  /** XP this level spans, start to start. */
  levelSpan: number;
  /** XP still to earn before the next level. Always at least 1. */
  toNext: number;
}

/**
 * The numbered level for a displayed XP total.
 *
 * A total that is negative, fractional or not a number reads as the whole XP
 * below it, never as more: the level a learner sees is a claim about XP they
 * earned, and the direction to be wrong in is the modest one.
 */
export function xpLevelFor(total: number): XpLevel {
  const xp = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  const flatStart = levelThreshold(FLAT_FROM);
  let level: number;
  if (xp >= flatStart) {
    level = FLAT_FROM + Math.floor((xp - flatStart) / LEVEL_STEP_MAX);
  } else {
    level = 1;
    while (levelThreshold(level + 1) <= xp) level += 1;
  }
  const start = levelThreshold(level);
  const levelSpan = levelStep(level);
  const intoLevel = xp - start;
  return { level, intoLevel, levelSpan, toNext: levelSpan - intoLevel };
}

/** Local calendar date, as YYYY-MM-DD. */
export function localDayKey(at: number): string {
  const d = new Date(at);
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}
