/**
 * Session history on the device.
 *
 * AsyncStorage is enough for now. The history is one small JSON array, the report
 * math lives in @luvani/core, and nothing here needs a backend. When accounts
 * arrive this file is the only thing that changes.
 *
 * Writes go through one chain with the key bound at enqueue, the same shape
 * review/store.ts uses. Two writers is no longer hypothetical: a finished
 * session appends here, and the sync engine hands merged history back through
 * `adoptHistory`, and a read-modify-write shared by two callers with no chain
 * loses one of them.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildProgressReport, type ProgressReport, type SessionSummary, type StoredSession } from '@luvani/core';
import { onUserScopeReset, userKey, scopeGeneration, setItemInUserScope } from '../storage/scope.ts';
import { markDirty, registerSyncAdopter, type SyncAdoption, type SyncFold } from '../sync/registry.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('history');
/** Plenty for trends, small enough to parse on every launch without noticing. */
const MAX_SESSIONS = 50;

/** See progress/activity.ts for why an adopted write does not raise the flag. */
type WriteOrigin = 'local' | 'adopted';

let writeChain: Promise<unknown> = Promise.resolve();

function serialized<T>(mutation: (key: string, owner: number) => Promise<T>): Promise<T> {
  // Bind the account when the work is requested. A sign-out while a background
  // write is queued must never redirect that write into the next account.
  const key = KEY();
  const owner = scopeGeneration();
  const run = () => mutation(key, owner);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => {});
  return next;
}

async function readHistory(key: string): Promise<StoredSession[]> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(isSession)) throw new Error('session history could not be read');
  return parsed;
}

/**
 * The history exactly as the sync engine reads it: the parsed key, or null when
 * this account has never written one.
 *
 * Not `readHistory`, which answers a missing key with an empty array. The merge
 * has to be able to tell a device that has never recorded a session from one
 * whose history is genuinely empty.
 */
async function persistedHistory(key: string): Promise<unknown> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(isSession)) throw new Error('session history could not be read');
  return parsed;
}

/** The least a stored session must be to be carried through a merge. */
function isSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Partial<StoredSession>;
  const summary = row.summary as Partial<SessionSummary> | undefined;
  const pronunciation = summary?.pronunciation;
  return typeof row.endedAt === 'number' && Number.isFinite(row.endedAt) &&
    typeof summary?.lessonId === 'string' && summary.lessonId.length > 0 &&
    typeof summary.longestTurnSec === 'number' && Number.isFinite(summary.longestTurnSec) &&
    Array.isArray(summary.wordsProduced) && summary.wordsProduced.every((word) => typeof word === 'string') &&
    typeof pronunciation === 'object' && pronunciation !== null && Array.isArray(pronunciation.stats) &&
    pronunciation.stats.every((stat) => typeof stat?.ipa === 'string' &&
      typeof stat.sampleCount === 'number' && Number.isFinite(stat.sampleCount) &&
      typeof stat.meanScore === 'number' && Number.isFinite(stat.meanScore));
}

export function loadHistory(): Promise<StoredSession[]> {
  return readHistory(KEY());
}

async function saveHistory(key: string, history: readonly StoredSession[], origin: WriteOrigin, owner: number): Promise<boolean> {
  try {
    await setItemInUserScope(owner, key, JSON.stringify(history));
    if (origin === 'local') markDirty('history');
    return true;
  } catch {
    // Storage full, unavailable or stale. No durable adoption is claimed.
    return false;
  }
}

/**
 * The most recent finished session for a lesson, or null when there is none.
 * This is where cross-session continuity starts: the summary's `nextStartRung`
 * says where the next sitting of that lesson should open.
 */
export async function lastSummaryFor(lessonId: string): Promise<SessionSummary | null> {
  const history = await loadHistory();
  // Sessions are appended in order, so the match nearest the end is the newest.
  for (let i = history.length - 1; i >= 0; i--) {
    const stored = history[i];
    if (stored?.summary?.lessonId === lessonId) return stored.summary;
  }
  return null;
}

/** Append a finished session and return the updated report. */
export function recordSession(summary: SessionSummary, now = Date.now()): Promise<ProgressReport> {
  return serialized(async (key, owner) => {
    const history = await readHistory(key);
    const trimmed = [...history, { endedAt: now, summary }].slice(-MAX_SESSIONS);
    if (!(await saveHistory(key, trimmed, 'local', owner))) throw new Error('session history could not be saved');
    return buildProgressReport(trimmed);
  });
}

/**
 * Fold the account's history into this device's, on this store's own chain.
 *
 * The engine hands over a fold rather than a finished history, because it read
 * this key before the pull: a session banked during the round trip was written
 * over by a history computed before that session existed, and then pushed, so
 * the sitting was gone on every device. The fold is called here, inside the
 * chain, between the read and the write, with the history this store holds at
 * that instant. The union is a set union by session identity, so folding twice
 * is the same as folding once.
 *
 * The cap is re-applied rather than trusted from the wire: a merged history is
 * the union of two devices' logs and can be longer than either. Sorting by
 * `endedAt` before the trim means the fifty kept are the fifty most recent, not
 * whichever fifty happened to come last in the array — and it is the same order
 * sync/policy.ts sorts into, so the disk and the account agree byte for byte.
 */
function adoptHistory(fold: SyncFold): Promise<SyncAdoption> {
  return serialized(async (key, owner) => {
    let current: unknown;
    try { current = await persistedHistory(key); } catch { return 'declined'; }
    const folded = fold(current);
    if (!Array.isArray(folded)) return 'declined';
    const sessions = folded.filter(isSession).sort((a, b) => a.endedAt - b.endedAt).slice(-MAX_SESSIONS);
    if (!(await saveHistory(key, sessions, 'adopted', owner))) return 'declined';
    return 'adopted';
  });
}

function registerAdopter(): void {
  registerSyncAdopter('history', adoptHistory);
}

// Registered at load, and again whenever the account scope changes: the sync
// registry is cleared on an account switch, and a module only evaluates once.
registerAdopter();
onUserScopeReset(registerAdopter);
