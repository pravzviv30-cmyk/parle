/**
 * The learner model — what the brain remembers between sessions.
 *
 * The model proposes, code disposes: the LLM only ever suggests deltas
 * (error-pattern tags, phrases used well, one CEFR reading per turn), and this
 * module validates and merges them under hard rules. The estimate can never
 * jump more than one band per session, tags are normalized and capped, and
 * mastery is a count, not a vibe. That keeps a hallucinated signal from
 * rewriting a learner's history.
 *
 * Persistence is someone else's job (the playground writes JSON; the app will
 * have its own store). This module is pure.
 */

import { normalise, type Rung } from '@parle/core';

import type { MemoryExtraction, MemoryFact, TutorTurn } from '../contract/types.ts';
import { CEFR_BANDS, type CefrBand, type RegisterId, type Strictness } from '../types.ts';
import { normalizeErrorTag, type ConversationState, type LearnerSnapshot } from '../engine/conversation.ts';

/** A remembered fact plus when it was noted — the eviction order. */
export type RememberedFact = MemoryFact & { notedAt: string };

export interface LearnerProfile {
  version: 2;
  cefr: {
    estimate: CefrBand;
    confidence: 'low' | 'medium' | 'high';
    /** The last readings, newest last. The estimate is derived, never stored raw. */
    evidence: CefrBand[];
  };
  errorPatterns: Record<string, { count: number; lastSeen: string; example: string }>;
  phrases: Record<
    string,
    {
      fr: string;
      frWritten: string | null;
      en: string;
      register: RegisterId;
      introducedAt: string;
      timesUsedWell: number;
      mastered: boolean;
    }
  >;
  /**
   * What the tutor knows about the learner as a person — the thread that makes
   * a third session open "Alors, cet entretien ?" instead of cold. Written
   * only by the post-session extraction, capped hard because the profile
   * rides the session join credential.
   */
  memory: {
    facts: RememberedFact[];
    /** Next session's spoken opener, referencing something real, or null. */
    opener: { fr: string; en: string } | null;
  };
  preferences: { strictness: Strictness; lastScenarios: string[] };
  stats: { sessions: number; totalTurns: number; rescues: number; lastRung: Rung | null };
}

/** How many CEFR readings the estimate looks back over. */
export const EVIDENCE_WINDOW = 12;
/** Correct natural uses before a phrase counts as mastered. */
export const MASTERY_USES = 3;
/** Recurring-error patterns kept; beyond this the least recently seen goes. */
export const MAX_ERROR_PATTERNS = 40;
export const MAX_PHRASES = 200;
/** Remembered life facts kept; beyond this the oldest goes. */
export const MAX_MEMORY_FACTS = 12;
const MAX_SCENARIOS = 5;

export function createProfile(): LearnerProfile {
  return {
    version: 2,
    cefr: { estimate: 'A0', confidence: 'low', evidence: [] },
    errorPatterns: {},
    phrases: {},
    memory: { facts: [], opener: null },
    preferences: { strictness: 'balanced', lastScenarios: [] },
    stats: { sessions: 0, totalTurns: 0, rescues: 0, lastRung: null },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Take whatever came back off a device — or off the wire — and return a profile
 * the engine can actually run on.
 *
 * Validation is deliberately loose, because a tampered profile only affects
 * pedagogy and never minutes. What it is strict about is the fields the engine
 * dereferences the moment a session opens: those must exist, or a stranger's
 * malformed blob takes the worker down instead of quietly degrading to a fresh
 * profile.
 *
 * `memory` is the one that bites. It arrived after version 2 was already on
 * devices, so `migrateProfile` — which only fills it in for version 1 — hands a
 * version-2 profile without it straight back, and the first thing that reads
 * `profile.memory.facts` throws. Repairing just that field keeps the learner's
 * error patterns, phrases and CEFR evidence, which is the whole point of not
 * simply starting over.
 */
export function repairProfile(stored: unknown): LearnerProfile {
  if (
    !isRecord(stored) ||
    !isRecord(stored.cefr) ||
    !isRecord(stored.errorPatterns) ||
    !isRecord(stored.phrases) ||
    !isRecord(stored.preferences) ||
    !Array.isArray(stored.preferences.lastScenarios) ||
    !isRecord(stored.stats)
  ) {
    return createProfile();
  }

  const migrated = migrateProfile(stored as unknown as LearnerProfile);
  const memory = migrated.memory;
  if (isRecord(memory) && Array.isArray(memory.facts)) {
    return memory.opener === undefined ? { ...migrated, memory: { ...memory, opener: null } } : migrated;
  }
  return { ...migrated, memory: { facts: [], opener: null } };
}

/**
 * Bring a stored profile up to the current shape. Version 1 predates memory;
 * everything else it carried is still exactly right, so the upgrade is purely
 * additive and never touches learning history.
 */
export function migrateProfile(stored: LearnerProfile | (Omit<LearnerProfile, 'version' | 'memory'> & { version: 1 })): LearnerProfile {
  if (stored.version === 2) return stored;
  return { ...stored, version: 2, memory: { facts: [], opener: null } };
}

/**
 * Merge one extraction into the profile. The model proposes, code disposes:
 * facts are deduped on their English sentence, capped oldest-out, and the
 * opener only lands when both languages arrived. Pure.
 */
export function applyExtractionToProfile(
  profile: LearnerProfile,
  extraction: MemoryExtraction,
  now: string,
): LearnerProfile {
  const next = structuredClone(profile);

  const seen = new Set(next.memory.facts.map((f) => normalise(f.en)));
  for (const fact of extraction.facts) {
    const key = normalise(fact.en);
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    next.memory.facts.push({ ...fact, notedAt: now });
  }
  if (next.memory.facts.length > MAX_MEMORY_FACTS) {
    next.memory.facts.sort((a, b) => a.notedAt.localeCompare(b.notedAt));
    next.memory.facts = next.memory.facts.slice(next.memory.facts.length - MAX_MEMORY_FACTS);
  }

  if (extraction.openerFr !== null && extraction.openerEn !== null) {
    next.memory.opener = { fr: extraction.openerFr, en: extraction.openerEn };
  } else {
    // A session that surfaced nothing real clears the opener rather than
    // letting a stale one greet the learner twice.
    next.memory.opener = null;
  }

  return next;
}

/** The slice of the profile the conversation engine needs. */
export function learnerSnapshotFrom(profile: LearnerProfile): LearnerSnapshot {
  const watchFor = Object.entries(profile.errorPatterns)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([tag]) => tag);
  return {
    cefr: profile.cefr.estimate,
    confidence: profile.cefr.confidence,
    watchFor,
    lastRung: profile.stats.lastRung,
    sessions: profile.stats.sessions,
  };
}

function phraseKey(fr: string, frWritten: string | null): string {
  return normalise(frWritten ?? fr);
}

/**
 * Fold one turn's proposals into the profile. Pure — returns a new profile.
 */
export function applyTurnToProfile(profile: LearnerProfile, turn: TutorTurn, now: string): LearnerProfile {
  const next: LearnerProfile = {
    ...profile,
    cefr: { ...profile.cefr, evidence: [...profile.cefr.evidence] },
    errorPatterns: { ...profile.errorPatterns },
    phrases: Object.fromEntries(Object.entries(profile.phrases).map(([k, v]) => [k, { ...v }])),
    preferences: { ...profile.preferences, lastScenarios: [...profile.preferences.lastScenarios] },
    stats: { ...profile.stats },
  };

  next.stats.totalTurns += 1;

  const reading = turn.assessment.cefrEvidence;
  if (reading !== null) {
    next.cefr.evidence.push(reading);
    next.cefr.evidence = next.cefr.evidence.slice(-EVIDENCE_WINDOW);
  }

  for (const pattern of turn.profileSignals.errorPatterns) {
    const tag = normalizeErrorTag(pattern.tag);
    if (tag.length === 0) continue;
    const existing = next.errorPatterns[tag];
    next.errorPatterns[tag] = {
      count: (existing?.count ?? 0) + 1,
      lastSeen: now,
      example: pattern.example || existing?.example || '',
    };
  }
  evictStalePatterns(next);

  for (const phrase of turn.newPhrases) {
    const key = phraseKey(phrase.fr, phrase.frWritten);
    if (key.length === 0 || next.phrases[key]) continue;
    next.phrases[key] = {
      fr: phrase.fr,
      frWritten: phrase.frWritten,
      en: phrase.en,
      register: phrase.register,
      introducedAt: now,
      timesUsedWell: 0,
      mastered: false,
    };
  }
  evictOverflowPhrases(next);

  // Credit only lands on phrases the brain actually taught, matched forgivingly
  // (accents and apostrophes stripped) so a transcriber's spelling cannot rob
  // the learner of a use.
  for (const used of turn.profileSignals.usedWell) {
    const usedKey = normalise(used);
    if (usedKey.length === 0) continue;
    for (const entry of Object.values(next.phrases)) {
      if (normalise(entry.fr) === usedKey || (entry.frWritten !== null && normalise(entry.frWritten) === usedKey)) {
        entry.timesUsedWell += 1;
        entry.mastered = entry.timesUsedWell >= MASTERY_USES;
      }
    }
  }

  return next;
}

function evictStalePatterns(profile: LearnerProfile): void {
  const entries = Object.entries(profile.errorPatterns);
  if (entries.length <= MAX_ERROR_PATTERNS) return;
  entries
    .sort((a, b) => a[1].lastSeen.localeCompare(b[1].lastSeen))
    .slice(0, entries.length - MAX_ERROR_PATTERNS)
    .forEach(([tag]) => delete profile.errorPatterns[tag]);
}

/**
 * The phrase book is capped for the same reason the error patterns are — but
 * with a harder edge: the whole profile rides the session join credential,
 * which has a fixed size ceiling. Left unbounded, a devoted learner's own
 * progress would eventually lock them out of conversation entirely.
 *
 * Eviction prefers to forget what was never learned: unmastered before
 * mastered, oldest introduction first within each group.
 */
function evictOverflowPhrases(profile: LearnerProfile): void {
  const entries = Object.entries(profile.phrases);
  if (entries.length <= MAX_PHRASES) return;
  entries
    .sort((a, b) => {
      if (a[1].mastered !== b[1].mastered) return a[1].mastered ? 1 : -1;
      return a[1].introducedAt.localeCompare(b[1].introducedAt);
    })
    .slice(0, entries.length - MAX_PHRASES)
    .forEach(([key]) => delete profile.phrases[key]);
}

function bandIndex(band: CefrBand): number {
  return CEFR_BANDS.indexOf(band);
}

function modeOf(evidence: readonly CefrBand[]): { band: CefrBand; share: number } | null {
  if (evidence.length === 0) return null;
  const counts = new Map<CefrBand, number>();
  for (const band of evidence) counts.set(band, (counts.get(band) ?? 0) + 1);
  let best: CefrBand = evidence[0]!;
  let bestCount = 0;
  for (const [band, count] of counts) {
    if (count > bestCount) {
      best = band;
      bestCount = count;
    }
  }
  return { band: best, share: bestCount / evidence.length };
}

/**
 * Close out a session: fold the ladder's story in, remember the scene, and
 * re-derive the CEFR estimate — moving at most one band per session, because
 * twelve minutes of coffee-ordering is evidence, not an exam.
 */
export function finishSession(profile: LearnerProfile, state: ConversationState): LearnerProfile {
  const next = structuredClone(profile);

  next.stats.sessions += 1;
  next.stats.rescues += state.ladder.rescues;
  next.stats.lastRung = state.ladder.rung;
  next.preferences.strictness = state.strictness;
  next.preferences.lastScenarios = [
    state.frame.title,
    ...next.preferences.lastScenarios.filter((t) => t !== state.frame.title),
  ].slice(0, MAX_SCENARIOS);

  const mode = modeOf(next.cefr.evidence);
  if (mode !== null && next.cefr.evidence.length >= 4) {
    const current = bandIndex(next.cefr.estimate);
    const proposed = bandIndex(mode.band);
    const clamped = Math.max(current - 1, Math.min(current + 1, proposed));
    next.cefr.estimate = CEFR_BANDS[clamped]!;
    next.cefr.confidence = mode.share >= 0.75 ? 'high' : mode.share >= 0.5 ? 'medium' : 'low';
  } else {
    next.cefr.confidence = 'low';
  }

  return next;
}
