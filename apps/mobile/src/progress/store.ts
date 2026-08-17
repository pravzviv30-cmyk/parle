/**
 * Session history on the device.
 *
 * AsyncStorage is enough for now. The history is one small JSON array, the report
 * math lives in @parle/core, and nothing here needs a backend. When accounts
 * arrive this file is the only thing that changes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildProgressReport, type ProgressReport, type SessionSummary, type StoredSession } from '@parle/core';
import { userKey } from '../storage/scope.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('history');
/** Plenty for trends, small enough to parse on every launch without noticing. */
const MAX_SESSIONS = 50;

export async function loadHistory(): Promise<StoredSession[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY());
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredSession[]) : [];
  } catch {
    // A corrupt history is not worth crashing over. Start fresh.
    return [];
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
export async function recordSession(summary: SessionSummary, now = Date.now()): Promise<ProgressReport> {
  const history = await loadHistory();
  history.push({ endedAt: now, summary });
  const trimmed = history.slice(-MAX_SESSIONS);
  try {
    await AsyncStorage.setItem(KEY(), JSON.stringify(trimmed));
  } catch {
    // Storage full or unavailable. The session still counts for this launch.
  }
  return buildProgressReport(trimmed);
}
