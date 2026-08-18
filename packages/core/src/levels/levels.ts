/**
 * Experience, and the six names it earns.
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
 * Deliberately absent: a streak. PRODUCT.md calls streaks a guilt mechanic
 * implicated in intermediate-plateau churn, and that commitment stands.
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
 */
export function totalXp(entries: readonly DatedXp[], dayKey: (at: number) => string = localDayKey): number {
  const byDay = new Map<string, number>();
  for (const e of entries) {
    const key = dayKey(e.at);
    byDay.set(key, (byDay.get(key) ?? 0) + Math.max(0, e.xp));
  }
  let total = 0;
  for (const dayTotal of byDay.values()) total += Math.min(dayTotal, DAILY_XP_CAP);
  return total;
}

/** Local calendar date, as YYYY-MM-DD. */
export function localDayKey(at: number): string {
  const d = new Date(at);
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}
