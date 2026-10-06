/**
 * The game layer's facts, and the one rule for putting two copies of them
 * together (Come alive, Phase 0, F729).
 *
 * Pure and free of AsyncStorage, for `goals/model.ts`'s reason: `sync/policy.ts`
 * merges this namespace under plain node, and `game/store.ts` validates its own
 * disk with the same functions the merge uses, so the disk and the merge can
 * never disagree about which rows exist.
 *
 * ## What is kept here, and what is not
 *
 * Facts only. A finished sitting that earned no XP, the covers that bridged a
 * streak, the days the daily goal was met, the three quests a day was dealt,
 * the quests claimed, the fixed "for practising" XP, the badges awarded and the
 * celebrations already played. The streak number, the level and quest progress
 * are never stored: core derives them from these facts and the activity log
 * every time, so a stored number can never disagree with the practice behind it.
 *
 * ## The merge
 *
 * Every field is a set union on an identity or a per-month maximum, and every
 * collision is settled by a total order (earliest `at`, then a field order,
 * then the canonical rendering). Every bound is "keep the last k of a sorted
 * set", ranked by the identity alone and in the same order the age window
 * prunes in. That makes the merge commutative, associative and idempotent,
 * which `policy.test.ts` property-tests over generated blobs.
 *
 * Monthly rollups are a maximum, not a sum, and the merge never derives them.
 * A local write folds the store's own claims and bonus rows into their months
 * before anything ages out (`rolledUp`), so every claim is counted by the
 * device that made it. The price is named: two devices that each claimed
 * different quests in one month and did not sync for two months keep the
 * larger of their two counts, not the sum. A rollup can only undercount; it
 * can never invent a quest.
 *
 * ## Adding to this file later
 *
 * A new quest id, cover kind or sitting source is a new value an older build
 * refuses, so it needs `GAME_VERSION` raised: an older build then goes quiet on
 * this namespace instead of dropping the rows it does not know and pushing the
 * loss. Badge ids and celebration keys are opaque on purpose: a badge another
 * build awarded is kept here even when this build cannot draw it, because
 * dropping it would take an award back.
 */

import {
  CHEST,
  daysBetween,
  isDayKey,
  isQuestId,
  questMonthOf,
  type CoverKind,
  type DayKey,
  type QuestId,
  type StreakCover,
} from '@luvani/core';

import { stableStringify } from '../sync/envelope.ts';

/** The inner schema version this build writes. `sync/policy.ts` imports it. */
export const GAME_VERSION = 1;

/** Where a finished sitting came from. */
export type SittingSource = 'convo' | 'lesson' | 'drill' | 'review' | 'phrase' | 'guest';
export const SITTING_SOURCES: readonly SittingSource[] = ['convo', 'lesson', 'drill', 'review', 'phrase', 'guest'];

/** Ages and bounds. Each one is a decision about what a learner may forget. */
export const SITTING_KEEP_DAYS = 60;
export const MAX_SITTINGS = 500;
export const MAX_COVERS = 2000;
export const MAX_GOAL_DAYS = 2000;
export const QUEST_DAYS_KEPT = 60;
export const CLAIM_KEEP_DAYS = 62;
export const BONUS_KEEP_DAYS = 62;
export const MAX_BONUS = 400;
export const MAX_MONTHS = 600;
export const MAX_BADGES = 500;
export const SEEN_KEEP_DAYS = 60;
export const MAX_SEEN = 800;

const DAY_MS = 86_400_000;

/** A finished sitting the activity log does not hold (one that earned no XP). */
export interface GameSitting {
  at: number;
  source: SittingSource;
  /** Measured active time, absent when not measured. Never filled with zero. */
  activeMs?: number;
}

/** The three quests one day was dealt, frozen the first time they were computed. */
export interface QuestDayRow {
  day: DayKey;
  ids: [QuestId, QuestId, QuestId];
  at: number;
}

/** A quest (or the day's chest) claimed, and the XP it was worth. */
export interface QuestClaimRow {
  day: DayKey;
  questId: QuestId | typeof CHEST;
  xp: number;
  at: number;
}

/** Quests claimed in a calendar month (chest excluded) and all quest XP that month. */
export interface QuestMonth {
  month: string;
  count: number;
  xp: number;
}

/** XP for one calendar month: capped activity XP, or fixed "for practising" XP. */
export interface XpMonth {
  month: string;
  xp: number;
}

/**
 * The fixed +5 "for practising" XP for a win nothing grades. The key says what
 * it was for and when, `<kind>:<YYYY-MM-DD>` or `<kind>:<epoch ms>` (`phrase:2026-10-05`,
 * `review:1759658400000`), so one win
 * is credited once however many devices see it.
 */
export interface BonusRow {
  key: string;
  xp: number;
  at: number;
}

/** A badge, dated when the moment it was earned is known, null when it was counted from older practice. */
export interface BadgeAward {
  id: string;
  at: number | null;
}

/** A celebration already played, anywhere, so it never plays twice. */
export interface SeenMark {
  key: string;
  at: number;
}

export interface StoredGame {
  version: typeof GAME_VERSION;
  sittings: GameSitting[];
  covers: StreakCover[];
  goalDays: DayKey[];
  questDays: QuestDayRow[];
  claims: QuestClaimRow[];
  questMonths: QuestMonth[];
  xpMonths: XpMonth[];
  bonus: BonusRow[];
  bonusMonths: XpMonth[];
  badges: BadgeAward[];
  seen: SeenMark[];
}

/** The rows of a game blob without its version, so a write can name only what it adds. */
export type GameRows = Omit<StoredGame, 'version'>;

const FIELDS = [
  'sittings',
  'covers',
  'goalDays',
  'questDays',
  'claims',
  'questMonths',
  'xpMonths',
  'bonus',
  'bonusMonths',
  'badges',
  'seen',
] as const satisfies readonly (keyof GameRows)[];

/** Ties between two covers for one day: the first named wins, as `core/streak` reads them. */
const COVER_ORDER: readonly CoverKind[] = ['travel', 'repair', 'freeze'];

export function emptyGame(): StoredGame {
  return {
    version: GAME_VERSION,
    sittings: [],
    covers: [],
    goalDays: [],
    questDays: [],
    claims: [],
    questMonths: [],
    xpMonths: [],
    bonus: [],
    bonusMonths: [],
    badges: [],
    seen: [],
  };
}

// ─────────────────────────────────────────────────────────────── validation

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnly(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const own = Object.keys(value);
  return required.every((key) => own.includes(key)) && own.every((key) => required.includes(key) || optional.includes(key));
}

/** The last moment a JavaScript date can hold. */
const MAX_DATE_MS = 8_640_000_000_000_000;

/** An epoch millisecond this app could have written, and one a date can hold. */
function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MAX_DATE_MS;
}

/** A measured duration: finite and at or above zero, as `progress/activity.ts` reads one. */
function isDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isCount(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const BADGE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEEN_KEY = /^[a-z][a-z0-9-]*(?::[a-z0-9-]+){0,4}$/;
const BONUS_KEY = /^([a-z][a-z0-9-]{0,23}):(\d{4}-\d{2}-\d{2}|\d{1,13})$/;
export const MAX_BADGE_ID = 32;
export const MAX_SEEN_KEY = 48;

/** XP one claim or one bonus row may carry. Far above anything core awards. */
export const MAX_ROW_XP = 1_000;
/** A month's rollup bounds: every quest every day, and far more XP than a month holds. */
export const MAX_MONTH_COUNT = 1_000;
export const MAX_MONTH_XP = 10_000_000;

export function isMonth(value: unknown): value is string {
  return typeof value === 'string' && MONTH.test(value);
}

export function isSittingSource(value: unknown): value is SittingSource {
  return SITTING_SOURCES.includes(value as SittingSource);
}

export function isCoverKind(value: unknown): value is CoverKind {
  return COVER_ORDER.includes(value as CoverKind);
}

export function isBadgeId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_BADGE_ID && BADGE_ID.test(value);
}

export function isSeenKey(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_SEEN_KEY && SEEN_KEY.test(value);
}

/** The calendar day a bonus key names, or null for a key this build would not write. */
export function bonusDay(key: string): DayKey | null {
  const match = BONUS_KEY.exec(key);
  if (!match) return null;
  const stamp = match[2]!;
  if (stamp.includes('-')) return isDayKey(stamp) ? stamp : null;
  const at = Number(stamp);
  // The UTC date, not the device's, so every device prunes the same row on the same day.
  return Number.isSafeInteger(at) && at > 0 && at <= MAX_DATE_MS ? new Date(at).toISOString().slice(0, 10) : null;
}

export function isBonusKey(value: unknown): value is string {
  return typeof value === 'string' && bonusDay(value) !== null;
}

/**
 * The calendar day a celebration key is about, when its second segment is one
 * (`streak:2026-10-05`, `quest:2026-10-05:xp`). Such a key is kept for
 * `SEEN_KEEP_DAYS` after the newest one; a key with no day (`level:5`,
 * `badge:streak-7`) is kept for good. A key that must outlive the window must
 * therefore not put a day second.
 */
export function seenDay(key: string): DayKey | null {
  const second = key.split(':')[1];
  return second !== undefined && isDayKey(second) ? second : null;
}

export function isSitting(value: unknown): value is GameSitting {
  return (
    isRecord(value) &&
    hasOnly(value, ['at', 'source'], ['activeMs']) &&
    isTime(value.at) &&
    isSittingSource(value.source) &&
    (value.activeMs === undefined || isDuration(value.activeMs))
  );
}

export function isCover(value: unknown): value is StreakCover {
  return isRecord(value) && hasOnly(value, ['day', 'kind', 'at']) && isDayKey(value.day) && isCoverKind(value.kind) && isTime(value.at);
}

export function isQuestDay(value: unknown): value is QuestDayRow {
  return (
    isRecord(value) &&
    hasOnly(value, ['day', 'ids', 'at']) &&
    isDayKey(value.day) &&
    isTime(value.at) &&
    Array.isArray(value.ids) &&
    value.ids.length === 3 &&
    value.ids.every(isQuestId) &&
    new Set(value.ids).size === 3
  );
}

export function isClaim(value: unknown): value is QuestClaimRow {
  return (
    isRecord(value) &&
    hasOnly(value, ['day', 'questId', 'xp', 'at']) &&
    isDayKey(value.day) &&
    (value.questId === CHEST || isQuestId(value.questId)) &&
    isCount(value.xp, MAX_ROW_XP) &&
    isTime(value.at)
  );
}

export function isQuestMonth(value: unknown): value is QuestMonth {
  return (
    isRecord(value) &&
    hasOnly(value, ['month', 'count', 'xp']) &&
    isMonth(value.month) &&
    isCount(value.count, MAX_MONTH_COUNT) &&
    isCount(value.xp, MAX_MONTH_XP)
  );
}

export function isXpMonth(value: unknown): value is XpMonth {
  return isRecord(value) && hasOnly(value, ['month', 'xp']) && isMonth(value.month) && isCount(value.xp, MAX_MONTH_XP);
}

export function isBonus(value: unknown): value is BonusRow {
  return isRecord(value) && hasOnly(value, ['key', 'xp', 'at']) && isBonusKey(value.key) && isCount(value.xp, MAX_ROW_XP) && isTime(value.at);
}

export function isBadgeAward(value: unknown): value is BadgeAward {
  return isRecord(value) && hasOnly(value, ['id', 'at']) && isBadgeId(value.id) && (value.at === null || isTime(value.at));
}

export function isSeenMark(value: unknown): value is SeenMark {
  return isRecord(value) && hasOnly(value, ['key', 'at']) && isSeenKey(value.key) && isTime(value.at);
}

const ROW_CHECKS: { [F in (typeof FIELDS)[number]]: (value: unknown) => value is GameRows[F][number] } = {
  sittings: isSitting,
  covers: isCover,
  goalDays: (value: unknown): value is DayKey => isDayKey(value),
  questDays: isQuestDay,
  claims: isClaim,
  questMonths: isQuestMonth,
  xpMonths: isXpMonth,
  bonus: isBonus,
  bonusMonths: isXpMonth,
  badges: isBadgeAward,
  seen: isSeenMark,
};

// ──────────────────────────────────────────────────────────────────── merge

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The larger of two values under the canonical rendering: the last tiebreak everywhere. */
function canonicalMax<T>(x: T, y: T): T {
  return compareText(stableStringify(x), stableStringify(y)) >= 0 ? x : y;
}

/** The earlier of two records; equal moments fall through to the canonical rendering. */
function earliest<T extends { at: number }>(x: T, y: T): T {
  if (x.at !== y.at) return x.at < y.at ? x : y;
  return canonicalMax(x, y);
}

/** Union on an identity, collisions settled by `pick`, which must be a max over a total order. */
function unionBy<T>(rows: readonly T[], identity: (row: T) => string, pick: (x: T, y: T) => T): Map<string, T> {
  const held = new Map<string, T>();
  for (const row of rows) {
    const id = identity(row);
    const seen = held.get(id);
    held.set(id, seen === undefined ? row : pick(seen, row));
  }
  return held;
}

/** Of two copies of one sitting, the one that measured its active time. */
function measured(x: GameSitting, y: GameSitting): GameSitting {
  const xHas = x.activeMs === undefined ? 0 : 1;
  const yHas = y.activeMs === undefined ? 0 : 1;
  if (xHas !== yHas) return xHas > yHas ? x : y;
  return canonicalMax(x, y);
}

/** Of two covers for one day, the earliest written, then the order core reads them in. */
function firstCover(x: StreakCover, y: StreakCover): StreakCover {
  if (x.at !== y.at) return x.at < y.at ? x : y;
  const order = COVER_ORDER.indexOf(x.kind) - COVER_ORDER.indexOf(y.kind);
  if (order !== 0) return order < 0 ? x : y;
  return canonicalMax(x, y);
}

/** A dated award beats one counted from older practice, then the earliest date. */
function firstAward(x: BadgeAward, y: BadgeAward): BadgeAward {
  if (x.at === null && y.at !== null) return y;
  if (y.at === null && x.at !== null) return x;
  if (x.at !== null && y.at !== null && x.at !== y.at) return x.at < y.at ? x : y;
  return canonicalMax(x, y);
}

/** The newest `limit` of a list already sorted oldest first. */
function newest<T>(rows: readonly T[], limit: number): T[] {
  return rows.length > limit ? rows.slice(rows.length - limit) : [...rows];
}

// Each row rebuilt with its keys in one order, so a rebuilt row is the same bytes.
const sittingOf = (s: GameSitting): GameSitting =>
  s.activeMs === undefined ? { at: s.at, source: s.source } : { at: s.at, source: s.source, activeMs: s.activeMs };
const coverOf = (c: StreakCover): StreakCover => ({ day: c.day, kind: c.kind, at: c.at });
const questDayOf = (q: QuestDayRow): QuestDayRow => ({ day: q.day, ids: [q.ids[0], q.ids[1], q.ids[2]], at: q.at });
const claimOf = (c: QuestClaimRow): QuestClaimRow => ({ day: c.day, questId: c.questId, xp: c.xp, at: c.at });
const bonusOf = (b: BonusRow): BonusRow => ({ key: b.key, xp: b.xp, at: b.at });
const badgeOf = (b: BadgeAward): BadgeAward => ({ id: b.id, at: b.at });
const seenOf = (s: SeenMark): SeenMark => ({ key: s.key, at: s.at });

function boundSittings(rows: readonly GameSitting[]): GameSitting[] {
  const held = [...unionBy(rows, (s) => `${s.at}|${s.source}`, measured).values()].sort(
    (x, y) => x.at - y.at || compareText(x.source, y.source),
  );
  const last = held[held.length - 1];
  if (last === undefined) return [];
  // Against the newest sitting in the union, never a clock, so two devices
  // whose clocks disagree still cut the same rows.
  const cutoff = last.at - SITTING_KEEP_DAYS * DAY_MS;
  return newest(held.filter((s) => s.at >= cutoff), MAX_SITTINGS).map(sittingOf);
}

function boundCovers(rows: readonly StreakCover[]): StreakCover[] {
  const held = [...unionBy(rows, (c) => c.day, firstCover).values()].sort((x, y) => compareText(x.day, y.day));
  return newest(held, MAX_COVERS).map(coverOf);
}

function boundGoalDays(rows: readonly DayKey[]): DayKey[] {
  return newest([...new Set(rows)].sort(compareText), MAX_GOAL_DAYS);
}

function boundQuestDays(rows: readonly QuestDayRow[]): QuestDayRow[] {
  const held = [...unionBy(rows, (q) => q.day, earliest).values()].sort((x, y) => compareText(x.day, y.day));
  return newest(held, QUEST_DAYS_KEPT).map(questDayOf);
}

function boundClaims(rows: readonly QuestClaimRow[]): QuestClaimRow[] {
  const held = [...unionBy(rows, (c) => `${c.day}|${c.questId}`, earliest).values()].sort(
    (x, y) => compareText(x.day, y.day) || compareText(x.questId, y.questId),
  );
  const last = held[held.length - 1];
  if (last === undefined) return [];
  return held.filter((c) => daysBetween(c.day, last.day) < CLAIM_KEEP_DAYS).map(claimOf);
}

function boundQuestMonths(rows: readonly QuestMonth[]): QuestMonth[] {
  // Each field is its own maximum, so neither the count nor the XP a learner
  // was shown can fall when two devices meet.
  const held = unionBy(rows, (m) => m.month, (x, y) => ({ month: x.month, count: Math.max(x.count, y.count), xp: Math.max(x.xp, y.xp) }));
  const sorted = [...held.values()].sort((x, y) => compareText(x.month, y.month));
  return newest(sorted, MAX_MONTHS).map((m) => ({ month: m.month, count: m.count, xp: m.xp }));
}

function boundXpMonths(rows: readonly XpMonth[]): XpMonth[] {
  const held = unionBy(rows, (m) => m.month, (x, y) => ({ month: x.month, xp: Math.max(x.xp, y.xp) }));
  const sorted = [...held.values()].sort((x, y) => compareText(x.month, y.month));
  return newest(sorted, MAX_MONTHS).map((m) => ({ month: m.month, xp: m.xp }));
}

function boundBonus(rows: readonly BonusRow[]): BonusRow[] {
  // Aged and ranked by the day the key names, never by `at`: `at` is a copy's
  // own detail and two devices hold different ones, so a window over it would
  // let a pruned key come back from a third device.
  const held = [...unionBy(rows, (b) => b.key, earliest).values()]
    .map((row) => ({ row, day: bonusDay(row.key) ?? '' }))
    .sort((x, y) => compareText(x.day, y.day) || compareText(x.row.key, y.row.key));
  const last = held[held.length - 1];
  if (last === undefined) return [];
  const kept = held.filter((b) => daysBetween(b.day, last.day) < BONUS_KEEP_DAYS);
  return newest(kept, MAX_BONUS).map((b) => bonusOf(b.row));
}

function boundBadges(rows: readonly BadgeAward[]): BadgeAward[] {
  // Never aged. The bound is one no learner reaches (sixteen fixed badges and
  // one a month); it exists so a forged payload cannot grow the blob.
  const held = [...unionBy(rows, (b) => b.id, firstAward).values()].sort((x, y) => compareText(x.id, y.id));
  return held.slice(0, MAX_BADGES).map(badgeOf);
}

/** Day-scoped keys rank by their day; a key with no day ranks above every day and is kept first. */
const NO_DAY = '~';

function boundSeen(rows: readonly SeenMark[]): SeenMark[] {
  const held = [...unionBy(rows, (s) => s.key, earliest).values()]
    .map((mark) => ({ mark, day: seenDay(mark.key) }))
    .sort((x, y) => compareText(x.day ?? NO_DAY, y.day ?? NO_DAY) || compareText(x.mark.key, y.mark.key));
  let newestDay: DayKey | null = null;
  for (const { day } of held) if (day !== null && (newestDay === null || day > newestDay)) newestDay = day;
  const kept =
    newestDay === null
      ? held
      : held.filter(({ day }) => day === null || daysBetween(day, newestDay as DayKey) < SEEN_KEEP_DAYS);
  return newest(kept, MAX_SEEN).map(({ mark }) => seenOf(mark));
}

/** Every readable row of one side, field by field. A side that is not a record has none. */
function rowsOf(side: unknown): GameRows {
  const record = isRecord(side) ? side : {};
  const out = {} as Record<string, unknown[]>;
  for (const field of FIELDS) {
    const list = record[field];
    const check = ROW_CHECKS[field] as (value: unknown) => boolean;
    out[field] = Array.isArray(list) ? list.filter((row) => check(row)) : [];
  }
  return out as unknown as GameRows;
}

/** Concatenate the rows of several sides, field by field. */
function joined(sides: readonly GameRows[]): GameRows {
  const out = {} as Record<string, unknown[]>;
  for (const field of FIELDS) out[field] = sides.flatMap((side) => side[field] as unknown[]);
  return out as unknown as GameRows;
}

/** Union, settle, age and bound every field. A pure function of the union of rows. */
function bound(rows: GameRows): StoredGame {
  return {
    version: GAME_VERSION,
    sittings: boundSittings(rows.sittings),
    covers: boundCovers(rows.covers),
    goalDays: boundGoalDays(rows.goalDays),
    questDays: boundQuestDays(rows.questDays),
    claims: boundClaims(rows.claims),
    questMonths: boundQuestMonths(rows.questMonths),
    xpMonths: boundXpMonths(rows.xpMonths),
    bonus: boundBonus(rows.bonus),
    bonusMonths: boundXpMonths(rows.bonusMonths),
    badges: boundBadges(rows.badges),
    seen: boundSeen(rows.seen),
  };
}

/** The sync policy's merge: two stored blobs, either possibly absent, corrupt or partial. */
export function mergeGame(local: unknown, remote: unknown): StoredGame {
  return bound(joined([rowsOf(local), rowsOf(remote)]));
}

/**
 * Fold the quests and fixed XP still held into their months, before anything
 * can age out.
 *
 * Run by the store on every local write and never by the merge: a rollup the
 * merge derived would depend on which rows each grouping had already aged out,
 * and the merge would stop being associative. Each month only ever rises.
 */
function rolledUp(rows: GameRows): GameRows {
  const claims = [...unionBy(rows.claims, (c) => `${c.day}|${c.questId}`, earliest).values()];
  const quests = new Map<string, QuestMonth>();
  for (const claim of claims) {
    const month = questMonthOf(claim.day);
    const held = quests.get(month) ?? { month, count: 0, xp: 0 };
    quests.set(month, {
      month,
      count: held.count + (claim.questId === CHEST ? 0 : 1),
      xp: Math.min(MAX_MONTH_XP, held.xp + claim.xp),
    });
  }
  const bonuses = new Map<string, XpMonth>();
  for (const row of unionBy(rows.bonus, (b) => b.key, earliest).values()) {
    const day = bonusDay(row.key);
    if (day === null) continue;
    const month = day.slice(0, 7);
    bonuses.set(month, { month, xp: Math.min(MAX_MONTH_XP, (bonuses.get(month)?.xp ?? 0) + row.xp) });
  }
  return {
    ...rows,
    questMonths: [...rows.questMonths, ...[...quests.values()].map((m) => ({ ...m, count: Math.min(MAX_MONTH_COUNT, m.count) }))],
    bonusMonths: [...rows.bonusMonths, ...bonuses.values()],
  };
}

/**
 * A local write: the rows on disk plus the rows added, rolled up and bounded.
 * Only the store calls this; adoption writes the merge exactly as it came.
 */
export function withGameRows(stored: StoredGame, added: Partial<GameRows>): StoredGame {
  // Both sides filtered as the merge filters them, so a row this build would
  // not write is dropped here rather than reaching a bound that cannot read it.
  return bound(rolledUp(joined([rowsOf(stored), rowsOf(added)])));
}

/**
 * A stored blob, read strictly: exactly this version's keys, every row valid.
 * `newer` for a version this build does not write; null for anything else it
 * cannot vouch for. Nothing is repaired here, because a blob a newer or broken
 * build wrote and this one "repaired" would be pushed back over the account.
 */
export function readGame(value: unknown): StoredGame | 'newer' | null {
  if (!isRecord(value)) return null;
  if (typeof value.version === 'number' && Number.isFinite(value.version) && value.version > GAME_VERSION) return 'newer';
  if (value.version !== GAME_VERSION || !hasOnly(value, ['version', ...FIELDS])) return null;
  for (const field of FIELDS) {
    const list = value[field];
    const check = ROW_CHECKS[field] as (row: unknown) => boolean;
    if (!Array.isArray(list) || !list.every((row) => check(row))) return null;
  }
  return bound(value as unknown as GameRows);
}

/** True when every row offered is one this build would write. An empty offer is not a write. */
export function isGameRowsPatch(added: Partial<GameRows>): boolean {
  let rows = 0;
  for (const field of FIELDS) {
    const list = added[field] as unknown;
    if (list === undefined) continue;
    const check = ROW_CHECKS[field] as (row: unknown) => boolean;
    if (!Array.isArray(list) || !list.every((row) => check(row))) return false;
    rows += list.length;
  }
  return rows > 0;
}

/**
 * True when every row offered is held by `game`, by its identity: a cover by
 * its day, a claim by its day and quest, a badge by its id, a month by its
 * month. A row the age window or a bound cut the moment it was added has not
 * landed, and the store says so rather than claiming a write it did not make.
 */
export function landedIn(game: StoredGame, added: Partial<GameRows>): boolean {
  const has = <T,>(list: readonly T[], probe: (row: T) => boolean): boolean => list.some(probe);
  return (
    (added.sittings ?? []).every((s) => has(game.sittings, (h) => h.at === s.at && h.source === s.source)) &&
    (added.covers ?? []).every((c) => has(game.covers, (h) => h.day === c.day)) &&
    (added.goalDays ?? []).every((d) => game.goalDays.includes(d)) &&
    (added.questDays ?? []).every((q) => has(game.questDays, (h) => h.day === q.day)) &&
    (added.claims ?? []).every((c) => has(game.claims, (h) => h.day === c.day && h.questId === c.questId)) &&
    (added.questMonths ?? []).every((m) => has(game.questMonths, (h) => h.month === m.month)) &&
    (added.xpMonths ?? []).every((m) => has(game.xpMonths, (h) => h.month === m.month)) &&
    (added.bonus ?? []).every((b) => has(game.bonus, (h) => h.key === b.key)) &&
    (added.bonusMonths ?? []).every((m) => has(game.bonusMonths, (h) => h.month === m.month)) &&
    (added.badges ?? []).every((b) => has(game.badges, (h) => h.id === b.id)) &&
    (added.seen ?? []).every((s) => has(game.seen, (h) => h.key === s.key))
  );
}

/** True when `game` holds this celebration key. */
export function seenIn(game: StoredGame, key: string): boolean {
  return game.seen.some((mark) => mark.key === key);
}
