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
import { totalXp, type DatedXp } from '@parle/core';
import { onUserScopeReset, userKey } from '../storage/scope.ts';
import { markDirty, registerSyncAdopter, type SyncAdoption, type SyncFold } from '../sync/registry.ts';

export type ActivityKind = 'lesson' | 'convo' | 'drill' | 'review';

export interface ActivityEntry {
  /** Epoch milliseconds. */
  at: number;
  kind: ActivityKind;
  xp: number;
}

interface Stored {
  version: 1;
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
  return { version: 1, entries: [] };
}

function isEntry(value: unknown): value is ActivityEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.at === 'number' &&
    Number.isFinite(entry.at) &&
    typeof entry.xp === 'number' &&
    Number.isFinite(entry.xp) &&
    (entry.kind === 'lesson' || entry.kind === 'convo' || entry.kind === 'drill' || entry.kind === 'review')
  );
}

function isStored(value: unknown): value is Stored {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { version?: unknown }).version === 1 &&
    Array.isArray((value as { entries?: unknown }).entries)
  );
}

async function read(key: string): Promise<Stored> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return empty();
    const parsed: unknown = JSON.parse(raw);
    if (!isStored(parsed)) return empty();
    return parsed;
  } catch {
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
function serialized<T>(mutation: (key: string) => Promise<T>): Promise<T> {
  const key = KEY();
  const run = () => mutation(key);
  const next = chain.then(run, run);
  chain = next.catch(() => {});
  return next;
}

function mutate(change: (stored: Stored) => Stored | null, origin: WriteOrigin = 'local'): Promise<void> {
  return serialized(async (key) => {
    const next = change(await read(key));
    if (next === null) return;
    try {
      await AsyncStorage.setItem(key, JSON.stringify(next));
      if (origin === 'local') markDirty('activity');
    } catch {
      // Storage unavailable. The sitting still happened; the ladder catches up
      // next time rather than blocking anyone.
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
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function prune(entries: readonly ActivityEntry[], now: number): ActivityEntry[] {
  const cutoff = now - KEEP_DAYS * DAY_MS;
  return entries.filter((e) => e.at >= cutoff);
}

/** Record one finished sitting. Fire and forget; nothing waits on it. */
export async function recordActivity(kind: ActivityKind, xp: number, now = Date.now()): Promise<void> {
  if (xp <= 0) return;
  await mutate((stored) => ({ ...stored, entries: prune([...stored.entries, { at: now, kind, xp }], now) }));
}

export async function loadActivity(): Promise<ActivityEntry[]> {
  return (await read(KEY())).entries;
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
 * Validated as if it came off a stranger's disk, because in effect it did: it
 * was merged from a payload another device wrote. `backfilled` is still ORed
 * with what this device knew — the fold ORs it too, so this is belt and braces
 * on a one-time guard, and letting it fall back to false would credit this
 * learner's whole pre-log history a second time.
 */
function adoptActivity(fold: SyncFold): Promise<SyncAdoption> {
  return serialized(async (key) => {
    const current = await persisted(key);
    const wasBackfilled = isStored(current) && current.backfilled === true;
    const folded = fold(current);
    if (!isStored(folded)) return 'declined';
    const next: Stored = {
      version: 1,
      entries: folded.entries.filter(isEntry),
      backfilled: wasBackfilled || folded.backfilled === true,
    };
    try {
      await AsyncStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage unavailable. The next cycle hands the same fold back.
    }
    return 'adopted';
  });
}

function registerAdopter(): void {
  registerSyncAdopter('activity', adoptActivity);
}

// Registered at load, and again whenever the account scope changes: the sync
// registry is cleared on an account switch, and a module only evaluates once.
registerAdopter();
onUserScopeReset(registerAdopter);
