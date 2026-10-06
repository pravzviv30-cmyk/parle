/**
 * A dated log of everything the learner actually did.
 *
 * This exists because, before it, only completed café lessons were dated. Free
 * conversations wrote the tutor's memory of the learner and nothing else;
 * drills wrote scheduler grades; reviews wrote card grades. So three of the
 * four ways a learner spends their time left no trace with a timestamp on it,
 * and any progression built on `history` alone would have quietly ignored them
 * — and would also have been truncated, since history keeps only the last
 * fifty sessions.
 *
 * Append-only, small, and pruned by age rather than by count so that a heavy
 * week cannot push a lighter one out.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeActiveDays } from './activeDays.ts';
import { localDayKey, totalXp, type DatedXp } from '@luvani/core';
import type { PersistAck } from '../storage/ack.ts';
import { onUserScopeReset, scopeGeneration, writeInUserScope, userKey } from '../storage/scope.ts';
import { markDirty, registerSyncAdopter, type SyncAdoption, type SyncFold } from '../sync/registry.ts';

export type ActivityKind = 'lesson' | 'convo' | 'drill' | 'review';

export interface ActivityEntry {
  /** Epoch milliseconds. */
  at: number;
  kind: ActivityKind;
  xp: number;
  /**
   * How long the sitting took, in wall-clock milliseconds on the device that
   * ran it.
   *
   * Optional, and absent on every entry written before this field existed —
   * which is most of the log on any phone that has been used. A reader that
   * needs minutes must treat absence as "not measured" and say so, never as
   * zero: a sitting that took ten minutes and did not record it is not a
   * ten-minute claim of nothing.
   *
   * It is device wall clock, not metered minutes, so it is never the balance.
   */
  durationMs?: number;
  /**
   * Active learning time, in milliseconds: only the stretches between real
   * learner events that were close enough together to be one stretch of work,
   * with idle, background and paused gaps left out (see `activeTime.ts`).
   * Typed work counts. It is what Home's Practice time sums.
   *
   * Optional and absent on every entry written before Phase 1B. Absent means
   * not measured, and it is never filled from `durationMs`, which measured
   * something else. Never metered minutes either.
   */
  activeMs?: number;
}

/**
 * What the screen measured about the sitting, beyond the XP.
 *
 * An options bag rather than a fifth positional argument, because everything
 * that arrives here later is another measurement of the same sitting and a
 * caller must never have to pass a placeholder to reach the one it has.
 */
export interface ActivityDetail {
  /** Wall-clock milliseconds from the screen opening to the sitting banking. */
  readonly durationMs?: number;
  /** Active learning milliseconds from the screen's `ActiveClock`. Absent when not measured. */
  readonly activeMs?: number;
  /**
   * True only when the caller knows the sitting reached its end: a drill set
   * worked to its last item, a conversation that ran its course, a lesson that
   * reached its summary. It is what lets a sitting that earned no XP still be a
   * practice day (founder decision D3, F731).
   *
   * Opt-in, and absent means "not known to be finished", on purpose. Some
   * callers bank on the way out whatever happened, and a drill opened and left
   * from the header with nothing answered earns 0 XP on exactly the path a
   * finished set with nothing right takes. Only the caller can tell those apart,
   * so a zero-XP call that does not say `finished` writes nothing at all.
   */
  readonly finished?: boolean;
}

/**
 * The log row for one sitting, carrying each measurement only when it is a
 * value this store holds. A malformed measurement is dropped on its own; the
 * sitting and the other measurement still land.
 */
function entryOf(at: number, kind: ActivityKind, xp: number, detail: ActivityDetail): ActivityEntry {
  const entry: ActivityEntry = { at, kind, xp };
  if (detail.durationMs !== undefined && isDuration(detail.durationMs)) entry.durationMs = detail.durationMs;
  if (detail.activeMs !== undefined && isDuration(detail.activeMs)) entry.activeMs = detail.activeMs;
  return entry;
}

/**
 * A duration this store is willing to hold: finite and at or above zero.
 *
 * Absent is a legitimate answer and always has been. A present value that is
 * not a number, or is negative, or is an infinity, is a measurement that went
 * wrong somewhere, and a log is a worse place to discover that than the screen
 * that produced it.
 */
function isDuration(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

interface Stored {
  version: 1 | 2;
  activeDays?: string[];
  entries: ActivityEntry[];
  /** Set once history has been read in, so it is never counted twice. */
  backfilled?: boolean;
}

/**
 * Who asked for this write.
 *
 * A learner's own sitting is news the account has not heard, so it raises the
 * dirty flag. A write the sync engine handed back is this device catching up
 * with the account, and flagging it would make every adoption look like a fresh
 * local change and cost a pointless extra push cycle. See sync/registry.ts.
 */
type WriteOrigin = 'local' | 'adopted';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('activity');

/** Long enough that no real learner loses anything to pruning. */
const KEEP_DAYS = 400;
const DAY_MS = 86_400_000;

function empty(): Stored {
  return { version: 2, entries: [], activeDays: [] };
}

function isEntry(value: unknown): value is ActivityEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.at === 'number' &&
    Number.isFinite(entry.at) &&
    typeof entry.xp === 'number' &&
    Number.isFinite(entry.xp) &&
    (entry.kind === 'lesson' || entry.kind === 'convo' || entry.kind === 'drill' || entry.kind === 'review') &&
    isDuration(entry.durationMs) &&
    isDuration(entry.activeMs)
  );
}

function isStored(value: unknown): value is Stored {
  return (
    typeof value === 'object' &&
    value !== null &&
    [1, 2].includes((value as { version?: number }).version ?? 0) &&
    Array.isArray((value as { entries?: unknown }).entries)
  );
}

function validActiveDays(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every(day =>
    typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day));
}

async function read(key: string, strict = false): Promise<Stored> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return empty();
    const parsed: unknown = JSON.parse(raw);
    if (!isStored(parsed)) {
      if (strict) throw new Error('Activity history is unreadable');
      return empty();
    }
    if (strict && (!parsed.entries.every(isEntry) || !validActiveDays(parsed.activeDays))) throw new Error('Activity history is unreadable');
    return { ...parsed, entries: parsed.entries.filter(isEntry) };
  } catch (error) {
    if (strict) throw error;
    return empty();
  }
}

// Writes are serialised through one chain, the same shape the drill bank uses,
// so two sittings finishing at once cannot clobber each other.
let chain: Promise<unknown> = Promise.resolve();

/**
 * Run a mutation alone on the chain, with the account bound at enqueue.
 *
 * Bind the account when the work is requested. A sign-out while a background
 * write is queued must never redirect that write into the next account — and
 * this store is the worst place for it, because it re-reads the key it lands on
 * and folds the queued entry into whatever it finds there.
 *
 * It returns the mutation's own answer rather than void, because the sync
 * adopter has to tell the engine whether it took the fold or declined it.
 */
function serialized<T>(mutation: (key: string, owner: number) => Promise<T>): Promise<T> {
  const key = KEY();
  const owner = scopeGeneration();
  const run = () => mutation(key, owner);
  const next = chain.then(run, run);
  chain = next.catch(() => {});
  return next;
}

/**
 * Read, change and write on the chain, and say whether the change is on disk.
 *
 * `durable` when the write landed, or when there was nothing to write; `failed`
 * when the disk could not be read (an unreadable log is never replaced by a
 * fresh one), refused the write, or the account changed since the call. A
 * caller that does not care still gets the old fire-and-forget behaviour by
 * not awaiting the answer: the sitting happened either way, and the ladder
 * catches up next time rather than blocking anyone.
 */
function mutate(change: (stored: Stored) => Stored | null, origin: WriteOrigin = 'local'): Promise<PersistAck> {
  return serialized(async (key, owner) => {
    let current: Stored;
    try { current = await read(key, true); } catch { return 'failed'; }
    const next = change(current);
    if (next === null) return 'durable';
    try {
      const saved = await writeInUserScope(owner, () => AsyncStorage.setItem(key, JSON.stringify(next)));
      if (!saved) return 'failed';
      if (origin === 'local') markDirty('activity');
      return 'durable';
    } catch {
      return 'failed';
    }
  });
}

/**
 * The log exactly as the sync engine reads it: the parsed key, or null when this
 * account has never written one.
 *
 * Not `read`, which answers a missing or corrupt key with an empty log. The
 * merge has to be able to tell a device that has never logged a sitting from one
 * whose log is genuinely empty, and it must never be handed a repaired shape
 * standing in for bytes that are not there.
 */
async function persisted(key: string): Promise<unknown> {
  const raw = await AsyncStorage.getItem(key);
  return raw === null ? null : (JSON.parse(raw) as unknown);
}

function prune(entries: readonly ActivityEntry[], now: number): ActivityEntry[] {
  const cutoff = now - KEEP_DAYS * DAY_MS;
  return entries.filter((e) => e.at >= cutoff);
}

/**
 * Record one sitting, and say whether it is on disk. Callers that `void` it
 * still fire and forget; nothing has to wait on it.
 *
 * A sitting that earned XP writes an entry, and its day with it.
 *
 * A sitting that earned no XP never writes an entry, deliberately. An entry is
 * where XP and minutes live, and a log that carried the duration of a sitting
 * with nothing in it would let a "time spent" number climb while nothing was
 * learned, which is the one thing a minutes figure must never be able to do.
 *
 * Whether it is still a practice day depends on whether it finished, and only
 * the caller knows that. Not every caller reaches this for a finished sitting:
 * the bank drill records on the way out, so a drill opened and left from the
 * header with nothing answered arrives here with 0 XP too. So a zero-XP sitting
 * marked `detail.finished` records its day through `recordActiveDay` (the date
 * and nothing else: no entry, no XP, no minutes and no new activity kind),
 * because any finished practice is a streak day (founder decision D3, F731).
 * One that does not say it finished writes nothing and is honestly `durable`,
 * as `recordActivityOnce` has always answered, because a practice day the
 * learner did not earn is fake progress.
 *
 * A duration the validator would refuse is dropped rather than stored, so this
 * store can never hold a row its own reader throws away.
 */
export async function recordActivity(
  kind: ActivityKind,
  xp: number,
  now = Date.now(),
  detail: ActivityDetail = {},
): Promise<PersistAck> {
  if (!Number.isFinite(xp) || !Number.isFinite(now)) return 'failed';
  if (xp <= 0) return detail.finished === true ? recordActiveDay(now) : 'durable';
  const entry = entryOf(now, kind, xp, detail);
  return mutate((stored) => ({ ...stored, version: 2, activeDays: mergeActiveDays([...stored.entries, entry], stored.activeDays), entries: prune([...stored.entries, entry], now) }));
}

/**
 * A sitting's fixed log instant that no entry of the same `(kind, xp)` already
 * on DISK holds: `at` itself, or the next free millisecond after it.
 *
 * The log's identity is `(at, kind, xp)` and it has no id field, so this is how
 * a caller that must record a sitting at most once gets a stamp it can own.
 * The caller freezes the answer durably before recording, and a replay that
 * finds that exact entry knows it is its own. Only sound while the caller has
 * at most one such stamp outstanding per account (practice completion does).
 * Null when the disk cannot be read.
 */
export function claimActivityInstant(kind: ActivityKind, xp: number, at: number): Promise<number | null> {
  return serialized(async (key, owner) => {
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
    if (owner !== scopeGeneration()) return null;
    let parsed: Stored;
    try { parsed = raw === null ? empty() : parseStored(raw); } catch { return null; }
    const taken = new Set(parsed.entries.filter((e) => e.kind === kind && e.xp === xp).map((e) => e.at));
    let free = Math.floor(at);
    while (taken.has(free)) free += 1;
    return free;
  });
}

/**
 * Record one sitting exactly once at a stamp from `claimActivityInstant`, and
 * say whether it is on disk.
 *
 * `durable` when the entry `(at, kind, xp)` is already there (an earlier try
 * landed) or this write landed; `failed` when the disk refused, could not be
 * read, or the account changed or was reset since the call. A failed write
 * raises no dirty flag. `xp <= 0` records nothing and is honestly `durable`.
 * Ordinary `recordActivity` uses the same scoped native-write barrier.
 */
export function recordActivityOnce(
  kind: ActivityKind,
  xp: number,
  at: number,
  detail: ActivityDetail = {},
): Promise<PersistAck> {
  if (!Number.isFinite(xp) || !Number.isFinite(at)) return Promise.resolve('failed');
  if (xp <= 0) return Promise.resolve('durable');
  return serialized(async (key, owner) => {
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(key);
    } catch {
      return 'failed';
    }
    let stored: Stored;
    try { stored = raw === null ? empty() : parseStored(raw); } catch { return 'failed'; }
    if (owner !== scopeGeneration()) return 'failed';
    if (stored.entries.some((e) => e.at === at && e.kind === kind && e.xp === xp)) return 'durable';
    const entry = entryOf(at, kind, xp, detail);
    const entries = [...stored.entries, entry];
    const next: Stored = {
      ...stored,
      version: 2,
      activeDays: mergeActiveDays(entries, stored.activeDays),
      entries: prune(entries, Math.max(at, Date.now())),
    };
    try {
      const saved = await writeInUserScope(owner, () => AsyncStorage.setItem(key, JSON.stringify(next)));
      if (!saved) return 'failed';
    } catch {
      return 'failed';
    }
    markDirty('activity');
    return 'durable';
  });
}

function parseStored(raw: string): Stored {
  const parsed: unknown = JSON.parse(raw);
  if (!isStored(parsed) || !parsed.entries.every(isEntry) || !validActiveDays(parsed.activeDays)) throw new Error('Activity history is unreadable');
  return parsed;
}

export async function loadActivity(options?: { strict: boolean }): Promise<ActivityEntry[]> {
  return (await read(KEY(), options?.strict)).entries;
}

export async function loadActiveDays(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEY());
  if (raw === null) return [];
  const stored: unknown = JSON.parse(raw);
  if (!isStored(stored) || !validActiveDays(stored.activeDays)) throw new Error('Unreadable activity history');
  if (!stored.entries.every(isEntry)) throw new Error('Unreadable activity history');
  return mergeActiveDays(stored.entries, stored.activeDays);
}

/** A completed light practice adds its date, never XP or an assessment. */
export function recordActiveDay(at = Date.now()): Promise<PersistAck> {
  if (!Number.isFinite(new Date(at).getTime())) return Promise.resolve('failed');
  const day = localDayKey(at);
  return serialized(async (key, owner) => {
    try {
      const raw = await AsyncStorage.getItem(key);
      const parsed: unknown = raw === null ? empty() : JSON.parse(raw);
      if (!isStored(parsed) || !parsed.entries.every(isEntry) || !validActiveDays(parsed.activeDays)) return 'failed';
      const stored = parsed;
      const activeDays = mergeActiveDays(stored.entries, stored.activeDays, [day]);
      const saved = await writeInUserScope(owner, () => AsyncStorage.setItem(key, JSON.stringify({ ...stored, version: 2, activeDays })));
      if (!saved) return 'failed';
      markDirty('activity');
      return 'durable';
    } catch { return 'failed'; }
  });
}

/** All-time XP, with the daily cap applied by core. */
export async function earnedXp(): Promise<number> {
  const entries = await loadActivity();
  return totalXp(entries as DatedXp[]);
}

/**
 * Count sessions that predate this log, once.
 *
 * Without it, everyone already using the app is told they are a Beginner with
 * nothing to their name on the day the ladder ships, which is both false and
 * the exact opposite of what a progression screen is for. Their real XP cannot
 * be reconstructed — the evidence was never stored — so each past session is
 * credited at the base lesson rate and no more.
 */
export async function backfillFrom(sessions: readonly { endedAt: number }[], baseXp: number): Promise<void> {
  const now = Date.now();
  const inherited: ActivityEntry[] = sessions.map((s) => ({ at: s.endedAt, kind: 'lesson' as const, xp: baseXp }));
  await mutate((stored) =>
    stored.backfilled
      ? null
      : {
          ...stored,
          backfilled: true,
          version: 2,
          activeDays: mergeActiveDays([...inherited, ...stored.entries], stored.activeDays),
          entries: prune([...inherited, ...stored.entries].sort((a, b) => a.at - b.at), now),
        },
  );
}

/**
 * Fold the account's log into this device's, on this store's own chain.
 *
 * This used to fold `backfilled` with what was on disk and then replace
 * `entries` wholesale, which is the worse half of the same bug: a sitting
 * recorded while the engine was on the network was written over by a list of
 * entries computed before it happened, and then pushed, so the XP was gone
 * everywhere. Both halves come from the fold now. It is called here, inside the
 * chain, between the read and the write, with the log this store holds at that
 * instant, and the union is by `(at, kind, xp)` so folding twice is the same as
 * folding once.
 *
 * The identity stayed `(at, kind, xp)` when `durationMs` arrived, on purpose:
 * widening it would make the same sitting two rows on a device that synced
 * before the field existed and one row after, and the XP would be counted
 * twice. Instead the policy's pick prefers the copy that carries an active
 * total, then a duration, so an older device folding its copy in cannot erase a
 * measurement a newer one made. `activeMs` joined on the same terms.
 *
 * Validated as if it came off a stranger's disk, because in effect it did: it
 * was merged from a payload another device wrote. `backfilled` is still ORed
 * with what this device knew — the fold ORs it too, so this is belt and braces
 * on a one-time guard, and letting it fall back to false would credit this
 * learner's whole pre-log history a second time.
 */
function adoptActivity(fold: SyncFold): Promise<SyncAdoption> {
  return serialized(async (key, owner) => {
    let current: unknown;
    try { current = await persisted(key); } catch { return 'declined'; }
    if (current !== null && (!isStored(current) || !current.entries.every(isEntry) || !validActiveDays(current.activeDays))) return 'declined';
    const wasBackfilled = isStored(current) && current.backfilled === true;
    const folded = fold(current);
    if (!isStored(folded)) return 'declined';
    const next: Stored = {
      version: 2,
      activeDays: mergeActiveDays(folded.entries.filter(isEntry), folded.activeDays, isStored(current) ? current.activeDays : []),
      entries: folded.entries.filter(isEntry),
      backfilled: wasBackfilled || folded.backfilled === true,
    };
    try {
      return await writeInUserScope(owner, () => AsyncStorage.setItem(key, JSON.stringify(next))) ? 'adopted' : 'declined';
    } catch { return 'declined'; }
  });
}

function registerAdopter(): void {
  registerSyncAdopter('activity', adoptActivity);
}

// Registered at load, and again whenever the account scope changes: the sync
// registry is cleared on an account switch, and a module only evaluates once.
registerAdopter();
onUserScopeReset(registerAdopter);
