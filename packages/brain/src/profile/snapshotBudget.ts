/**
 * The learner snapshot rides the `/session/start` body and then the signed
 * join credential, and the body has a size ceiling. Counts were already capped
 * (`MAX_PHRASES`, `MAX_ERROR_PATTERNS`, `MAX_MEMORY_FACTS`), but text was not,
 * so a heavy learner could in principle be refused at session start (LEARN-014).
 *
 * "Cap and keep": `fitSnapshot` shortens long text and, only if still over
 * budget, leaves out the entries the tutor needs least. `keepUnsent` runs on
 * the phone after the recap and puts back everything that was left out or
 * shortened, so nothing the learner earned is lost by fitting.
 */

import { isMastered } from '@luvani/core';
import { evictOverflowPhrases, evictStalePatterns, patternStatus, type LearnerProfile } from './profile.ts';

/**
 * 48 KB. Measured (snapshotBudget.test.ts): a heavy learner at realistic French
 * lengths (200 phrases, 40 patterns, 12 facts, review focus, previous
 * correction) is about 58 KB, already within 5 KB of the 64 KB body limit;
 * every count and text field at its cap is about 370 KB. Because `keepUnsent`
 * makes trimming lossless, the budget can sit well under the limit: the
 * signed token carries the snapshot again, base64-encoded (about 4/3 larger),
 * and 48 KB keeps that token near 64 KB. A heavy learner sends their newest
 * phrases and every recurring pattern; the oldest mastered phrases wait on
 * the phone.
 */
export const SNAPSHOT_MAX_BYTES = 48 * 1024;
/** The same ceiling the other profile writer keeps for a pattern's example. */
export const SNAPSHOT_MAX_EXAMPLE_CHARS = 160;
/**
 * A phrase is a sayable line. The longest real phrase in the fixtures is under
 * 60 characters; 200 is three times that and still clips a runaway string.
 */
export const SNAPSHOT_MAX_PHRASE_CHARS = 200;

const encoder = new TextEncoder();
const byteLength = (text: string): number => encoder.encode(text).length;

/** UTF-8 bytes of the snapshot as it goes on the wire. */
export function snapshotBytes(snapshot: unknown): number {
  return byteLength(JSON.stringify(snapshot) ?? '');
}

/** Clamp by code points so a cut never splits a surrogate pair. */
function clampText(value: unknown, cap: number): unknown {
  if (typeof value !== 'string') return value;
  const chars = Array.from(value);
  return chars.length <= cap ? value : chars.slice(0, cap).join('');
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Bytes an entry adds inside its object: `"key":value,`. */
const entryBytes = (key: string, value: unknown): number => byteLength(JSON.stringify(key)) + byteLength(JSON.stringify(value) ?? 'null') + 2;

/**
 * Fit a snapshot under `SNAPSHOT_MAX_BYTES`. Pure and deterministic; never
 * mutates its input. Tolerant of shapes it does not expect, because the token
 * server runs it on whatever an older app build sent.
 *
 * Drop order, only when clamping text was not enough: mastered phrases, oldest
 * `introducedAt` first; then unmastered phrases, oldest first; then suspected
 * error patterns, least recent `lastSeen` first. Memory, cefr, stats,
 * preferences, recurring patterns and any extra field are never dropped, so
 * the result can still be over budget; callers check with `snapshotBytes`.
 */
export function fitSnapshot<T>(snapshot: T): T {
  if (!isRecord(snapshot)) return snapshot;
  const source = snapshot as unknown as Record<string, unknown>;
  const phrases: Record<string, unknown> = {};
  if (isRecord(source.phrases)) {
    for (const [key, entry] of Object.entries(source.phrases)) {
      phrases[key] = isRecord(entry)
        ? { ...entry, fr: clampText(entry.fr, SNAPSHOT_MAX_PHRASE_CHARS), frWritten: clampText(entry.frWritten, SNAPSHOT_MAX_PHRASE_CHARS), en: clampText(entry.en, SNAPSHOT_MAX_PHRASE_CHARS) }
        : entry;
    }
  }
  const patterns: Record<string, unknown> = {};
  if (isRecord(source.errorPatterns)) {
    for (const [tag, entry] of Object.entries(source.errorPatterns)) {
      patterns[tag] = isRecord(entry) ? { ...entry, example: clampText(entry.example, SNAPSHOT_MAX_EXAMPLE_CHARS) } : entry;
    }
  }
  const out: Record<string, unknown> = {
    ...source,
    ...(isRecord(source.phrases) ? { phrases } : {}),
    ...(isRecord(source.errorPatterns) ? { errorPatterns: patterns } : {}),
  };
  let bytes = snapshotBytes(out);
  if (bytes <= SNAPSHOT_MAX_BYTES) return out as unknown as T;

  const byAge = (field: string) => (a: [string, unknown], b: [string, unknown]): number => {
    const order = text(isRecord(a[1]) ? a[1][field] : '').localeCompare(text(isRecord(b[1]) ? b[1][field] : ''));
    return order !== 0 ? order : a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  };
  const mastered = (entry: unknown): boolean => isRecord(entry) && entry.mastered === true;
  const phraseEntries = Object.entries(phrases);
  const queue: Array<{ map: Record<string, unknown>; key: string }> = [
    ...phraseEntries.filter(([, e]) => mastered(e)).sort(byAge('introducedAt')).map(([key]) => ({ map: phrases, key })),
    ...phraseEntries.filter(([, e]) => !mastered(e)).sort(byAge('introducedAt')).map(([key]) => ({ map: phrases, key })),
    ...Object.entries(patterns)
      .filter(([, e]) => isRecord(e) && patternStatus(e as { sessions?: number }) === 'suspected')
      .sort(byAge('lastSeen'))
      .map(([key]) => ({ map: patterns, key })),
  ];
  // Each removal subtracts the entry's own bytes, which is exact for every
  // entry but the last one in a map (it has no trailing comma); the final
  // stringify below settles any difference by dropping on.
  for (const { map, key } of queue) {
    if (bytes <= SNAPSHOT_MAX_BYTES) {
      bytes = snapshotBytes(out);
      if (bytes <= SNAPSHOT_MAX_BYTES) break;
    }
    bytes -= entryBytes(key, map[key]);
    delete map[key];
  }
  return out as unknown as T;
}

/** Put back the full text when the recap only carries the fitted copy of it. */
function unclamped(current: unknown, recapped: unknown, cap: number): unknown {
  return typeof current === 'string' && current !== recapped && clampText(current, cap) === recapped ? current : recapped;
}

/**
 * After a session, the recap's brain replaces the phone's. The recap only saw
 * the fitted snapshot, so put back every phrase and error pattern the phone
 * holds that the recap does not, and the full text of anything fitting
 * shortened. An entry in both keeps the recap's version (its counts are newer),
 * unless the entry was left out of the snapshot and the session made a fresh
 * one under the same key. That is told from the entries themselves:
 *
 * - A phrase is fresh when its `introducedAt` differs, because a sent phrase
 *   carries it through untouched. The two combine: the phone's introduction
 *   and text, uses and assisted uses summed, `mastered` projected again.
 * - A pattern is fresh when its `lastSession` moved but its `sessions` did not
 *   pass the phone's (a sent pattern seen again would have `sessions + 1`).
 *   The two combine: counts and sessions summed, the recap's sighting.
 *
 * Then the usual eviction rules re-apply, so the 200 and 40 caps hold exactly
 * as they always have. Only `phrases` and `errorPatterns` are touched: memory
 * and everything else are the recap's, as decided before this runs.
 */
export function keepUnsent(current: LearnerProfile, recapped: LearnerProfile): LearnerProfile {
  const phrases = { ...recapped.phrases };
  for (const [key, entry] of Object.entries(current.phrases ?? {})) {
    const back = phrases[key];
    if (!back) { phrases[key] = entry; continue; }
    if (back.introducedAt !== entry.introducedAt) {
      const timesUsedWell = entry.timesUsedWell + back.timesUsedWell;
      phrases[key] = {
        ...back,
        fr: entry.fr, frWritten: entry.frWritten, en: entry.en, introducedAt: entry.introducedAt,
        timesUsedWell, timesAssisted: entry.timesAssisted + back.timesAssisted, mastered: isMastered(timesUsedWell),
      };
      continue;
    }
    phrases[key] = {
      ...back,
      fr: unclamped(entry.fr, back.fr, SNAPSHOT_MAX_PHRASE_CHARS) as string,
      frWritten: unclamped(entry.frWritten, back.frWritten, SNAPSHOT_MAX_PHRASE_CHARS) as string | null,
      en: unclamped(entry.en, back.en, SNAPSHOT_MAX_PHRASE_CHARS) as string,
    };
  }
  const errorPatterns = { ...recapped.errorPatterns };
  for (const [tag, entry] of Object.entries(current.errorPatterns ?? {})) {
    const back = errorPatterns[tag];
    if (!back) { errorPatterns[tag] = entry; continue; }
    if (back.lastSession !== entry.lastSession && back.sessions <= entry.sessions) {
      errorPatterns[tag] = { ...back, count: entry.count + back.count, sessions: entry.sessions + back.sessions };
      continue;
    }
    // The recap may have a newer example; only undo the fitting cut.
    errorPatterns[tag] = { ...back, example: unclamped(entry.example, back.example, SNAPSHOT_MAX_EXAMPLE_CHARS) as string };
  }
  const merged: LearnerProfile = { ...recapped, phrases, errorPatterns };
  evictOverflowPhrases(merged);
  evictStalePatterns(merged);
  return merged;
}
