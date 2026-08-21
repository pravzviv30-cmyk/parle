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
import { userKey } from '../storage/scope.ts';

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

/** Long enough that no real learner loses anything to pruning. */
const KEEP_DAYS = 400;
const DAY_MS = 86_400_000;

function empty(): Stored {
  return { version: 1, entries: [] };
}

async function read(): Promise<Stored> {
  try {
    const raw = await AsyncStorage.getItem(userKey('activity'));
    if (!raw) return empty();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return empty();
    if ((parsed as { version?: unknown }).version !== 1) return empty();
    const entries = (parsed as Stored).entries;
    return Array.isArray(entries) ? (parsed as Stored) : empty();
  } catch {
    return empty();
  }
}

// Writes are serialised through one chain, the same shape the drill bank uses,
// so two sittings finishing at once cannot clobber each other.
let chain: Promise<void> = Promise.resolve();

function mutate(change: (stored: Stored) => Stored | null): Promise<void> {
  chain = chain.then(async () => {
    const next = change(await read());
    if (next === null) return;
    try {
      await AsyncStorage.setItem(userKey('activity'), JSON.stringify(next));
    } catch {
      // Storage unavailable. The sitting still happened; the ladder catches up
      // next time rather than blocking anyone.
    }
  });
  return chain;
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
  return (await read()).entries;
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
