/**
 * The game facts that belong to this phone and to no other (Come alive,
 * Phase 0, F729).
 *
 * Excluded from sync on purpose, with the reason written in
 * `sync/policy.ts`: the OS schedule, the time zone and the plan this phone
 * last observed are facts about this phone, and syncing them would nudge one
 * learner twice and let one device's billing read decide another's. So this
 * store raises no dirty flag and registers no adopter, and it is cleared with
 * every other per-account key on a reset.
 *
 * - `lastPracticeOffsetMin`: the UTC offset of the last finished practice, in
 *   minutes, so a travel cover can tell a flight from a missed day.
 * - `paidSince`: the local day this phone first saw a paid plan, reset to null
 *   when it sees a plan that is not.
 * - `nudges`: the streak reminders planned or fired, one per day, the last 30.
 * - `nudgesPausedAt`: when reminders paused themselves, or null.
 * - `introducedAt`: when the one-time "Your streak and level" sheet was settled.
 * - `pending`: celebrations queued and not yet shown, so a crash replays them.
 *
 * The read is strict, as `game/store.ts`'s is: bytes this build would not
 * write are refused, never repaired, and every write answers `failed`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDayKey, type DayKey } from '@luvani/core';

import type { PersistAck } from '../storage/ack.ts';
import { scopeGeneration, userKey, writeInUserScope } from '../storage/scope.ts';
import { sameData } from '../sync/envelope.ts';

export const GAME_LOCAL_VERSION = 1;

/** Nudge log rows kept, newest days. */
export const MAX_NUDGES = 30;
/** Celebrations waiting to be shown. A sitting queues a handful; this is a ceiling, not a target. */
export const MAX_PENDING = 32;

export type NudgeVariant = 'streak' | 'milestone-eve' | 'routine';

export interface NudgeLogRow {
  day: DayKey;
  /** Epoch ms the notification is planned to fire. */
  fireAt: number;
  variant: NudgeVariant;
  /** True once the learner opened it. Absent until then. */
  opened?: boolean;
}

export interface PendingCelebration {
  /** The celebration key, the same key `game.seen` records once it has played. */
  key: string;
  at: number;
}

export interface GameLocal {
  version: typeof GAME_LOCAL_VERSION;
  lastPracticeOffsetMin: number | null;
  paidSince: DayKey | null;
  nudges: NudgeLogRow[];
  nudgesPausedAt: number | null;
  introducedAt: number | null;
  pending: PendingCelebration[];
}

const KEYS = ['version', 'lastPracticeOffsetMin', 'paidSince', 'nudges', 'nudgesPausedAt', 'introducedAt', 'pending'] as const;
const VARIANTS: readonly NudgeVariant[] = ['streak', 'milestone-eve', 'routine'];
const PENDING_KEY = /^[a-z][a-z0-9-]*(?::[a-z0-9-]+){0,4}$/;
/** Every UTC offset in use, from -12:00 to +14:00. */
const MAX_OFFSET_MIN = 14 * 60;

const KEY = () => userKey('gameLocal');

export function emptyGameLocal(): GameLocal {
  return { version: GAME_LOCAL_VERSION, lastPracticeOffsetMin: null, paidSince: null, nudges: [], nudgesPausedAt: null, introducedAt: null, pending: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isOffset(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(value) <= MAX_OFFSET_MIN;
}

function isNudge(value: unknown): value is NudgeLogRow {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (!['day', 'fireAt', 'variant'].every((key) => keys.includes(key))) return false;
  if (!keys.every((key) => ['day', 'fireAt', 'variant', 'opened'].includes(key))) return false;
  return isDayKey(value.day) && isTime(value.fireAt) && VARIANTS.includes(value.variant as NudgeVariant) && (value.opened === undefined || typeof value.opened === 'boolean');
}

function isPending(value: unknown): value is PendingCelebration {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return keys.length === 2 && keys.includes('key') && keys.includes('at') && typeof value.key === 'string' && value.key.length <= 48 && PENDING_KEY.test(value.key) && isTime(value.at);
}

const nullable = <T,>(check: (value: unknown) => value is T) => (value: unknown): value is T | null => value === null || check(value);

/** One row per day, the newest plan for it, an opening never forgotten, the last 30 days. */
function boundNudges(rows: readonly NudgeLogRow[]): NudgeLogRow[] {
  const byDay = new Map<DayKey, NudgeLogRow>();
  for (const row of rows) {
    const held = byDay.get(row.day);
    const opened = row.opened === true || held?.opened === true;
    byDay.set(row.day, { day: row.day, fireAt: row.fireAt, variant: row.variant, ...(opened ? { opened: true } : {}) });
  }
  const sorted = [...byDay.values()].sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : 0));
  return sorted.slice(Math.max(0, sorted.length - MAX_NUDGES));
}

/** One entry per key, the earliest kept, oldest first, the newest 32. */
function boundPending(rows: readonly PendingCelebration[]): PendingCelebration[] {
  const byKey = new Map<string, PendingCelebration>();
  for (const row of rows) {
    const held = byKey.get(row.key);
    if (held === undefined || row.at < held.at) byKey.set(row.key, { key: row.key, at: row.at });
  }
  const sorted = [...byKey.values()].sort((x, y) => x.at - y.at || (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
  return sorted.slice(Math.max(0, sorted.length - MAX_PENDING));
}

function bound(value: GameLocal): GameLocal {
  return {
    version: GAME_LOCAL_VERSION,
    lastPracticeOffsetMin: value.lastPracticeOffsetMin,
    paidSince: value.paidSince,
    nudges: boundNudges(value.nudges),
    nudgesPausedAt: value.nudgesPausedAt,
    introducedAt: value.introducedAt,
    pending: boundPending(value.pending),
  };
}

/**
 * A stored record, read strictly: exactly this version's keys and types. Null
 * for anything else, including a newer version, which this phone cannot vouch
 * for and must not write over.
 */
export function readGameLocal(value: unknown): GameLocal | null {
  if (!isRecord(value) || value.version !== GAME_LOCAL_VERSION) return null;
  const keys = Object.keys(value);
  if (keys.length !== KEYS.length || !KEYS.every((key) => keys.includes(key))) return null;
  if (!nullable(isOffset)(value.lastPracticeOffsetMin)) return null;
  if (!nullable(isDayKey)(value.paidSince)) return null;
  if (!nullable(isTime)(value.nudgesPausedAt) || !nullable(isTime)(value.introducedAt)) return null;
  if (!Array.isArray(value.nudges) || !value.nudges.every(isNudge)) return null;
  if (!Array.isArray(value.pending) || !value.pending.every(isPending)) return null;
  return bound(value as unknown as GameLocal);
}

let chain: Promise<unknown> = Promise.resolve();

function serialized<T>(mutation: (key: string, owner: number) => Promise<T>): Promise<T> {
  const key = KEY();
  const owner = scopeGeneration();
  const run = () => mutation(key, owner);
  const next = chain.then(run, run);
  chain = next.catch(() => {});
  return next;
}

async function readStored(key: string): Promise<GameLocal | null> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return emptyGameLocal();
  try {
    return readGameLocal(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

/** This phone's game facts. Rejects when the disk cannot be read, so absence and failure stay distinct. */
export async function loadGameLocal(): Promise<GameLocal> {
  const stored = await readStored(KEY());
  if (stored === null) throw new Error('Game settings on this phone are unreadable');
  return stored;
}

/**
 * Change this phone's game facts, alone on the chain, and say whether the
 * change is on disk. The edit's answer is read as strictly as the disk, so an
 * edit cannot write what a read would refuse. No dirty flag: this never syncs.
 */
export function updateGameLocal(edit: (current: GameLocal) => GameLocal): Promise<PersistAck> {
  return serialized(async (key, owner) => {
    const current = await readStored(key);
    if (current === null) return 'failed';
    let next: GameLocal | null;
    try {
      next = readGameLocal(edit(current));
    } catch {
      return 'failed';
    }
    if (next === null || owner !== scopeGeneration()) return 'failed';
    if (sameData(next, current)) return 'durable';
    try {
      return (await writeInUserScope(owner, () => AsyncStorage.setItem(key, JSON.stringify(next)))) ? 'durable' : 'failed';
    } catch {
      return 'failed';
    }
  });
}

export function setLastPracticeOffset(minutes: number): Promise<PersistAck> {
  return updateGameLocal((g) => ({ ...g, lastPracticeOffsetMin: minutes }));
}

export function setPaidSince(day: DayKey | null): Promise<PersistAck> {
  return updateGameLocal((g) => ({ ...g, paidSince: day }));
}

export function logNudges(rows: readonly NudgeLogRow[]): Promise<PersistAck> {
  return updateGameLocal((g) => ({ ...g, nudges: [...g.nudges, ...rows] }));
}

export function markNudgeOpened(day: DayKey): Promise<PersistAck> {
  return updateGameLocal((g) => ({ ...g, nudges: g.nudges.map((row) => (row.day === day ? { ...row, opened: true } : row)) }));
}

export function setNudgesPausedAt(at: number | null): Promise<PersistAck> {
  return updateGameLocal((g) => ({ ...g, nudgesPausedAt: at }));
}

export function markIntroduced(at: number): Promise<PersistAck> {
  return updateGameLocal((g) => ({ ...g, introducedAt: g.introducedAt ?? at }));
}

export function enqueueCelebrations(items: readonly PendingCelebration[]): Promise<PersistAck> {
  return updateGameLocal((g) => ({ ...g, pending: [...g.pending, ...items] }));
}

export function dropCelebrations(keys: readonly string[]): Promise<PersistAck> {
  return updateGameLocal((g) => ({ ...g, pending: g.pending.filter((row) => !keys.includes(row.key)) }));
}
