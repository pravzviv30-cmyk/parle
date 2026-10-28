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

import { isLearnerGoal, isMastered, normalise, type LearnerGoal, type Rung } from '@luvani/core';

import type { MemoryExtraction, MemoryFact, TutorTurn } from '../contract/types.ts';
import { CEFR_BANDS, type CefrBand, type Pace, type RegisterId, type Strictness } from '../types.ts';
import type { ConversationState, LearnerSnapshot } from '../engine/conversation.ts';
import { normalizeErrorTag } from './errorTag.ts';
import { sensitiveMemoryCategory } from './memoryScreen.ts';

export { sensitiveMemoryCategory, type SensitiveMemoryCategory } from './memoryScreen.ts';

/** Who wrote a remembered fact: the learner by hand, or the extraction after a conversation. */
export type FactSource = 'learner' | 'conversation';
/**
 * A remembered fact plus when it was noted (the eviction order), who wrote it
 * and when it last changed. `source` is set by code only: `MemoryFactZ` has no
 * such field, so the model can never claim a fact as the learner's own.
 */
export type RememberedFact = MemoryFact & { notedAt: string; source: FactSource; updatedAt: string };

/** A stored source, read sceptically: anything but 'learner' is a conversation fact. */
export function validFactSource(value: unknown): FactSource {
  return value === 'learner' ? 'learner' : 'conversation';
}
/** Compatibility marker for the prompt that authored an opener, not a
 * sensitivity classification or proof that learner-writable data is trusted. */
export const PERSONAL_MEMORY_POLICY_VERSION = 1 as const;
export interface MemoryControl { paused: boolean; changedAt: number }

export function validMemoryControl(value: unknown): MemoryControl | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const control = value as Record<string, unknown>;
  return typeof control.paused === 'boolean' && typeof control.changedAt === 'number'
    && Number.isSafeInteger(control.changedAt) && control.changedAt >= 0
    ? { paused: control.paused, changedAt: control.changedAt } : undefined;
}
export const memoryPaused = (profile: LearnerProfile): boolean => validMemoryControl(profile.memory.control)?.paused === true;
export function withoutForgottenMemory(profile: LearnerProfile, forgotten: readonly string[]): LearnerProfile {
  if (forgotten.length === 0) return profile;
  const keys = new Set(forgotten.map(normalise));
  return { ...profile, memory: { ...profile.memory, opener: null, facts: profile.memory.facts.filter((fact) => !keys.has(normalise(fact.en))) } };
}

export interface LearnerProfile {
  version: 2;
  cefr: {
    estimate: CefrBand;
    confidence: 'low' | 'medium' | 'high';
    /** The last readings, newest last. The estimate is derived, never stored raw. */
    evidence: CefrBand[];
  };
  /**
   * `sessions` is how many distinct sessions the tag was seen in, and
   * `lastSession` the `stats.sessions` ordinal of the latest sighting, which is
   * how a second sighting in the same session is told apart from a new one.
   * See `patternStatus`.
   */
  errorPatterns: Record<string, { count: number; lastSeen: string; example: string; sessions: number; lastSession: number }>;
  phrases: Record<
    string,
    {
      fr: string;
      frWritten: string | null;
      en: string;
      register: RegisterId;
      introducedAt: string;
      timesUsedWell: number;
      /**
       * Uses the model credited on an exchange where the app had already shown
       * a hint or the full line. Kept apart from `timesUsedWell` because help
       * earns no independent use: it never projects `mastered` and never
       * counts as `convoUses`.
       */
      timesAssisted: number;
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
    /** Learner-authored pause state; never changed by extraction or a recap. */
    control?: MemoryControl;
    facts: RememberedFact[];
    /** Next session's spoken opener, referencing something real, or null. */
    opener: { fr: string; en: string; policyVersion?: typeof PERSONAL_MEMORY_POLICY_VERSION } | null;
    /**
     * What they asked to be called at onboarding, or null.
     *
     * It lives here rather than on the wire because this is already what the
     * tutor knows about the learner as a person, and `memory` already rides the
     * session snapshot — so a name costs no new field on the token, no new
     * endpoint shape, and no third place to keep the same fact.
     */
    name: string | null;
    /**
     * Why they are learning, from onboarding, or absent. Like `name`, an
     * onboarding answer and not a remembered fact, so it rides even when
     * memory is paused. Optional so profiles stored before it stay valid.
     */
    goal?: LearnerGoal | null;
    /**
     * The learner's own typed goals (at most three), wire-only. The app's
     * session snapshot composes them from `StoredProfile.learnerGoals`; the app
     * never stores them back from a recap. They are not facts and do not count
     * towards `MAX_MEMORY_FACTS`.
     */
    learnerGoals?: string[];
  };
  /**
   * `pace` is optional because it arrived after the shape shipped: a profile
   * without it is a learner who never asked, and reads as 'normal'. Set from
   * Profile, read by the agent when a scene opens; never written by a session.
   */
  preferences: { strictness: Strictness; lastScenarios: string[]; pace?: Pace };
  stats: { sessions: number; totalTurns: number; rescues: number; lastRung: Rung | null };
}

/** How many CEFR readings the estimate looks back over. */
export const EVIDENCE_WINDOW = 12;
/**
 * Correct natural uses before a phrase counts as mastered.
 *
 * The number lives in `packages/core/src/review/evidence.ts` now, beside the
 * rest of the phrase-evidence record, because the deck and the app project
 * their own verdicts from the same count and a second copy here would be a
 * second opinion about what a learner knows. Re-exported so every existing
 * importer of this module keeps working.
 */
export { MASTERY_USES } from '@luvani/core';
/**
 * Distinct sessions a tag must be seen in before it counts as recurring. One
 * session's slips can be a single bad day; two sessions is a pattern.
 */
export const RECURRING_SESSIONS = 2;
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
    memory: { facts: [], opener: null, name: null },
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
 * Validation is loose about learning history, because a tampered count only
 * affects pedagogy and never minutes. It is strict about two other things.
 *
 * The first is the fields the engine dereferences the moment a session opens:
 * those must exist, or a stranger's malformed blob takes the worker down
 * instead of quietly degrading to a fresh profile.
 *
 * The second is every string in `memory`, because none of them stays in the
 * learner model. `memory.opener` *is* the sentence the tutor speaks first
 * (`convo.ts` reads it before any model call), and `memory.facts` ride into the
 * scene prompt. A profile arrives off the join credential, so those three
 * fields are the only place a stored blob gets to choose words that reach a
 * synthesiser or a system prompt — which is exactly the treatment the name
 * already had, and they now get it too.
 *
 * `memory` is also the field that bites on shape. It arrived after version 2
 * was already on devices, so `migrateProfile` — which only fills it in for
 * version 1 — hands a version-2 profile without it straight back, and the first
 * thing that reads `profile.memory.facts` throws. Repairing just that field
 * keeps the learner's error patterns, phrases and CEFR evidence, which is the
 * whole point of not simply starting over.
 */
/** Wire goals read sceptically: strings, collapsed, trimmed, at most 120 chars, deduped, the last three; else none. */
function validWireLearnerGoals(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const goals: string[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const text = raw.replace(/\s+/g, ' ').trim().slice(0, 120).trim();
    if (text.length === 0 || goals.some((goal) => normalise(goal) === normalise(text))) continue;
    goals.push(text);
  }
  return goals.length === 0 ? null : goals.slice(-3);
}

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

  const migrated = repairLearningHistory(migrateProfile(stored as unknown as LearnerProfile));
  const memory = migrated.memory;
  if (isRecord(memory) && Array.isArray(memory.facts)) {
    const { control: rawControl, goal: rawGoal, learnerGoals: rawLearnerGoals, ...memoryFields } = memory;
    const learnerGoals = validWireLearnerGoals(rawLearnerGoals);
    const control = validMemoryControl(rawControl);
    // `opener` and `name` both arrived after version 2 shipped, so neither can
    // be assumed present. Filling them in beats bumping the version: the
    // learner keeps their error patterns, phrases and CEFR evidence, which is
    // the whole reason this function exists rather than createProfile().
    //
    // Unknown keys are carried through untouched: a newer build may keep more
    // here, and an older one repairing a profile must not be how that is lost.
    return {
      ...migrated,
      memory: {
        ...memoryFields,
        facts: validRememberedFacts(memory.facts),
        opener: validOpener(memory.opener),
        name: validLearnerName(memory.name),
        // Kept only as a known tag; anything else is dropped, key and all.
        ...(isLearnerGoal(rawGoal) ? { goal: rawGoal } : {}),
        ...(control ? { control } : {}),
        ...(learnerGoals ? { learnerGoals } : {}),
      },
    } as LearnerProfile;
  }
  return { ...migrated, memory: { facts: [], opener: null, name: null } };
}

function countOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Fill in the per-entry counts that arrived after version 2 shipped. A phrase
 * without `timesAssisted` was never credited under help, so it reads 0. A
 * pattern without `sessions` gets 1 and the current session ordinal: we know
 * it was seen, but not in how many sessions, and inventing recurrence would
 * move it ahead of everything the learner really keeps getting wrong.
 * Everything else on each entry is carried through untouched.
 */
function repairLearningHistory(profile: LearnerProfile): LearnerProfile {
  const stats = profile.stats as unknown as Record<string, unknown>;
  const ordinal = countOr(stats.sessions, 0);
  const phrases: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(profile.phrases as Record<string, unknown>)) {
    phrases[key] = isRecord(raw) ? { ...raw, timesAssisted: countOr(raw.timesAssisted, 0) } : raw;
  }
  const errorPatterns: Record<string, unknown> = {};
  for (const [tag, raw] of Object.entries(profile.errorPatterns as Record<string, unknown>)) {
    errorPatterns[tag] = isRecord(raw)
      ? {
          ...raw,
          ...(typeof raw.example === 'string' ? { example: clampPatternExample(raw.example) } : {}),
          sessions: countOr(raw.sessions, 1),
          lastSession: countOr(raw.lastSession, ordinal),
        }
      : raw;
  }
  return {
    ...profile,
    phrases: phrases as LearnerProfile['phrases'],
    errorPatterns: errorPatterns as LearnerProfile['errorPatterns'],
  };
}

/**
 * Bring a stored profile up to the current shape. Version 1 predates memory;
 * everything else it carried is still exactly right, so the upgrade is purely
 * additive and never touches learning history.
 */
export function migrateProfile(stored: LearnerProfile | (Omit<LearnerProfile, 'version' | 'memory'> & { version: 1 })): LearnerProfile {
  if (stored.version === 2) return stored;
  return { ...stored, version: 2, memory: { facts: [], opener: null, name: null } };
}

/** A name is short, and a name is not a number. */
const MAX_LEARNER_NAME_CHARS = 24;
/**
 * A remembered sentence is a sentence. The seed topic's cap in `convo.ts`,
 * restated for the same reason it exists there: the string is spoken or put in
 * front of a model, and a stored blob does not get to choose how much of the
 * prompt it owns.
 */
const MAX_MEMORY_TEXT_CHARS = 120;

/**
 * The shared core of every stored string this module lets through to a
 * synthesiser or a system prompt: it is a string, it has something in it once
 * trimmed, it is short enough to be what it claims to be, and it carries no
 * control character.
 *
 * One function rather than one per field, because three copies of "is it sane"
 * are three chances to disagree about it — and the fields differ only in how
 * long they are allowed to be, plus the digit rule that belongs to names alone.
 */
function sayableText(value: unknown, maxChars: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxChars) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return null;
  return trimmed;
}

/**
 * The learner's name, kept only when it really is one.
 *
 * The same doctrine as the seed topic in the tutor agent: this string is
 * spoken aloud and interpolated into a coach line, so it is checked where it
 * is used and not only where it was typed. Digits are refused outright because
 * `copyViolations` reads a digit outside quotes as a score, and a name that
 * silently voided every hand-back would be a very quiet bug.
 *
 * Dropped, never refused. A learner whose stored name fails this gets the
 * ordinary unnamed session, which is exactly the session they had before.
 */
export function validLearnerName(value: unknown): string | null {
  const trimmed = sayableText(value, MAX_LEARNER_NAME_CHARS);
  if (trimmed === null) return null;
  if (/\d/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Next session's opener, kept only when both halves of it survive.
 *
 * This is the one stored string the tutor speaks before any model call, so it
 * gets the name's treatment: type, length, no control characters. Digits are
 * *not* refused here. The name rule exists because `copyViolations` reads a
 * bare digit as a score in coach copy, and an opener that mentions a date the
 * learner really told the tutor is the whole point of having one.
 *
 * Half an opener is no opener, the same rule `applyExtractionToProfile` already
 * applies to the model's own version: a missing gloss would put the learner in
 * front of French the screen cannot explain.
 *
 * Dropped, never refused. A profile whose opener fails this gets the ordinary
 * greeting, which is exactly the session a first-time learner gets.
 */
function validOpener(value: unknown): LearnerProfile['memory']['opener'] {
  if (!isRecord(value)) return null;
  const fr = sayableText(value.fr, MAX_MEMORY_TEXT_CHARS);
  const en = sayableText(value.en, MAX_MEMORY_TEXT_CHARS);
  if (fr === null || en === null) return null;
  return { fr, en, ...(value.policyVersion === PERSONAL_MEMORY_POLICY_VERSION ? { policyVersion: PERSONAL_MEMORY_POLICY_VERSION } : {}) };
}

/** Older stored greetings predate the approved memory rule. Keep their data,
 * but speak the ordinary greeting until a current extraction authors a new one. */
export function currentPolicyOpener(profile: LearnerProfile): { fr: string; en: string } | null {
  return !memoryPaused(profile) && profile.memory.opener?.policyVersion === PERSONAL_MEMORY_POLICY_VERSION
    ? { fr: profile.memory.opener.fr, en: profile.memory.opener.en } : null;
}

const FACT_KINDS: ReadonlySet<string> = new Set(['interest', 'life-event', 'goal', 'preference']);

/**
 * What the tutor is told it knows about this person, kept only where each
 * remembered sentence really is one.
 *
 * These reach the scene prompt verbatim, which makes the array the widest
 * channel a stored profile has into the model. A fact that fails is dropped
 * rather than emptied, because an empty sentence in that list is a hole the
 * tutor would try to fill. `fr` and `happensAround` may fail on their own and
 * fall back to null, since the fact still says something without them. The
 * count is capped by the same rule the extraction uses, so a blob carrying ten
 * thousand facts cannot outgrow the join credential either.
 */
function validRememberedFacts(value: readonly unknown[]): RememberedFact[] {
  const kept: RememberedFact[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    if (typeof raw.kind !== 'string' || !FACT_KINDS.has(raw.kind)) continue;
    const en = sayableText(raw.en, MAX_MEMORY_TEXT_CHARS);
    if (en === null) continue;
    const notedAt = sayableText(raw.notedAt, MAX_MEMORY_TEXT_CHARS) ?? '';
    kept.push({
      kind: raw.kind as MemoryFact['kind'],
      fr: sayableText(raw.fr, MAX_MEMORY_TEXT_CHARS),
      en,
      happensAround: sayableText(raw.happensAround, MAX_MEMORY_TEXT_CHARS),
      notedAt,
      source: validFactSource(raw.source),
      updatedAt: sayableText(raw.updatedAt, MAX_MEMORY_TEXT_CHARS) ?? notedAt,
    });
  }
  return kept.slice(-MAX_MEMORY_FACTS);
}

/**
 * Fold the device's stored name into the profile the session rides on. Pure.
 * The app keeps the name beside the brain profile rather than inside it, so
 * this is the one place the two are joined before the snapshot leaves.
 */
export function withLearnerName(profile: LearnerProfile, name: unknown): LearnerProfile {
  return { ...profile, memory: { ...profile.memory, name: validLearnerName(name) } };
}

/** True when any of the texts touches a sensitive memory category. */
function isSensitiveMemory(...texts: Array<string | null>): boolean {
  return texts.some((text) => sensitiveMemoryCategory(text) !== null);
}

/**
 * Merge one extraction into the profile. The model proposes, code disposes:
 * facts are deduped on their English sentence, capped oldest-out, and the
 * opener only lands when both languages arrived. Tutor-noted facts and
 * openers that touch a sensitive topic are dropped (memoryScreen.ts). Pure.
 */
export function applyExtractionToProfile(
  profile: LearnerProfile,
  extraction: MemoryExtraction,
  now: string,
): LearnerProfile {
  if (memoryPaused(profile)) return profile;
  const next = structuredClone(profile);

  const seen = new Set(next.memory.facts.map((f) => normalise(f.en)));
  for (const fact of extraction.facts) {
    const key = normalise(fact.en);
    if (key.length === 0 || seen.has(key)) continue;
    // Code check behind the prompt's memory boundary (LEARN-008): a tutor-noted
    // fact touching a sensitive topic in any field is dropped whole, unlogged.
    if (isSensitiveMemory(fact.en, fact.fr, fact.happensAround)) continue;
    seen.add(key);
    // Built field by field: a model object carrying `source` cannot smuggle it in.
    next.memory.facts.push({
      kind: fact.kind,
      fr: fact.fr,
      en: fact.en,
      happensAround: fact.happensAround,
      notedAt: now,
      source: 'conversation',
      updatedAt: now,
    });
  }
  if (next.memory.facts.length > MAX_MEMORY_FACTS) {
    next.memory.facts.sort((a, b) => a.notedAt.localeCompare(b.notedAt));
    next.memory.facts = next.memory.facts.slice(next.memory.facts.length - MAX_MEMORY_FACTS);
  }

  if (extraction.openerFr !== null && extraction.openerEn !== null && !isSensitiveMemory(extraction.openerFr, extraction.openerEn)) {
    next.memory.opener = { fr: extraction.openerFr, en: extraction.openerEn, policyVersion: PERSONAL_MEMORY_POLICY_VERSION };
  } else {
    // A session that surfaced nothing real clears the opener rather than
    // letting a stale one greet the learner twice.
    next.memory.opener = null;
  }

  return next;
}

/** The slice of the profile the conversation engine needs. */
export function learnerSnapshotFrom(profile: LearnerProfile): LearnerSnapshot {
  // Recurring patterns first, then suspected ones fill what is left. A
  // learner with nothing recurring gets exactly the old top-three-by-count.
  const byCount = Object.entries(profile.errorPatterns).sort((a, b) => b[1].count - a[1].count);
  const watchFor = [
    ...byCount.filter(([, p]) => patternStatus(p) === 'recurring'),
    ...byCount.filter(([, p]) => patternStatus(p) === 'suspected'),
  ]
    .slice(0, 3)
    .map(([tag]) => tag);
  return {
    cefr: profile.cefr.estimate,
    confidence: profile.cefr.confidence,
    watchFor,
    lastRung: profile.stats.lastRung,
    sessions: profile.stats.sessions,
    name: validLearnerName(profile.memory.name),
    goal: isLearnerGoal(profile.memory.goal) ? profile.memory.goal : null,
  };
}

/**
 * Whether an error pattern is a one-session suspicion or something the learner
 * keeps doing. A projection of `sessions`, never stored.
 */
export function patternStatus(pattern: { sessions?: number }): 'suspected' | 'recurring' {
  return (pattern.sessions ?? 1) >= RECURRING_SESSIONS ? 'recurring' : 'suspected';
}

/**
 * Conversations a recurring pattern must stay quiet for before the learner is
 * told they are getting better at it. Three, so one lucky scene is not praise.
 */
export const IMPROVING_AFTER_SESSIONS = 3;

/**
 * Patterns the learner has stopped making: recurring (seen in at least
 * `RECURRING_SESSIONS` sessions), and not seen in the last
 * `IMPROVING_AFTER_SESSIONS` completed sessions.
 *
 * During a session every sighting writes `lastSession = stats.sessions`, and
 * `finishSession` increments `stats.sessions` afterwards. A pattern last seen in
 * ordinal k followed by three clean sessions therefore leaves
 * `stats.sessions === k + 4`, hence the `- 1`.
 *
 * Never returns counts: this is evidence of a quiet pattern, not a score.
 * Legacy patterns repaired to `sessions: 1` are suspected and never qualify.
 * Most recent `lastSession` first, ties by tag. Pure.
 */
export function improvingPatterns(
  profile: Pick<LearnerProfile, 'errorPatterns' | 'stats'>,
): Array<{ tag: string; lastSession: number }> {
  const completed = profile.stats.sessions;
  const out: Array<{ tag: string; lastSession: number }> = [];
  for (const [tag, pattern] of Object.entries(profile.errorPatterns)) {
    if (patternStatus(pattern) !== 'recurring') continue;
    if (!Number.isFinite(pattern.lastSession)) continue;
    if (completed - 1 - pattern.lastSession < IMPROVING_AFTER_SESSIONS) continue;
    out.push({ tag, lastSession: pattern.lastSession });
  }
  return out.sort((a, b) => b.lastSession - a.lastSession || (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
}

/**
 * Longest stored pattern example, in characters. The whole profile rides the
 * session join credential, so a model-written example must not grow unbounded.
 */
export const MAX_PATTERN_EXAMPLE = 160;

/** Clamp by code points, so a surrogate pair is never split. */
function clampPatternExample(example: string): string {
  const chars = Array.from(example);
  return chars.length <= MAX_PATTERN_EXAMPLE ? example : chars.slice(0, MAX_PATTERN_EXAMPLE).join('');
}

function phraseKey(fr: string, frWritten: string | null): string {
  return normalise(frWritten ?? fr);
}

/**
 * What this turn's coaching named, normalised once.
 *
 * `quoted` is what the model says the learner got wrong — the verbatim
 * fragment handed back to them. `named` is that plus the form offered instead,
 * which the *tutor* produced, not the learner.
 *
 * Both matter, for different reasons, and the difference is why this returns
 * two lists rather than one. See `applyTurnToProfile`.
 */
function coachedThisTurn(turn: TutorTurn): { quoted: string[]; named: string[] } {
  const quoted: string[] = [];
  const named: string[] = [];
  for (const item of turn.coach) {
    const quote = normalise(item.quote);
    if (quote.length > 0) {
      quoted.push(quote);
      named.push(quote);
    }
    for (const offered of [item.better, item.betterWritten]) {
      if (offered === null) continue;
      const key = normalise(offered);
      if (key.length > 0) named.push(key);
    }
  }
  return { quoted, named };
}

/**
 * Was any of these forms named in that coaching?
 *
 * Matched on whole normalised words rather than equality, because a coach item
 * quotes a *fragment* of what the learner said: an exact comparison would miss
 * the phrase sitting inside a quote of the whole sentence, which is the common
 * case. Padding both sides with a space keeps "on" from matching inside
 * "bonjour" — normalise() has already reduced everything to space-separated
 * words, so a word boundary is a space.
 *
 * Over-matching costs one turn's credit; under-matching mints mastery nobody
 * earned. The doubt goes this way on purpose.
 */
function namedInCoaching(coached: readonly string[], ...forms: readonly (string | null)[]): boolean {
  for (const form of forms) {
    if (form === null) continue;
    const needle = normalise(form);
    if (needle.length === 0) continue;
    if (coached.some((text) => ` ${text} `.includes(` ${needle} `))) return true;
  }
  return false;
}

/**
 * Fold one turn's proposals into the profile. Pure — returns a new profile.
 *
 * `assisted` means the app had revealed a hint or the full line on the
 * exchange this turn answers. A use the model credits then lands on
 * `timesAssisted` instead of `timesUsedWell`: help earns no independent use.
 */
export function applyTurnToProfile(
  profile: LearnerProfile,
  turn: TutorTurn,
  now: string,
  options: { assisted?: boolean; correctedEarlier?: readonly string[] } = {},
): LearnerProfile {
  const assisted = options.assisted === true;
  // Forms the coach quoted earlier this session (`state.correctedForms` read
  // before this turn). Normalised again defensively; they already are.
  const correctedEarlier = (options.correctedEarlier ?? []).map(normalise).filter((f) => f.length > 0);
  const next: LearnerProfile = {
    ...profile,
    cefr: { ...profile.cefr, evidence: [...profile.cefr.evidence] },
    errorPatterns: { ...profile.errorPatterns },
    phrases: Object.fromEntries(Object.entries(profile.phrases).map(([k, v]) => [k, { ...v }])),
    preferences: { ...profile.preferences, lastScenarios: [...profile.preferences.lastScenarios] },
    stats: { ...profile.stats },
  };

  next.stats.totalTurns += 1;

  // The turn's own verdict on the learner's French, read once. The engine
  // already picks the verdict the tutor *speaks* (`lead` in conversation.ts);
  // this is that same call made about the record, at the one place credit is
  // minted, so the mouth and the phrase book cannot disagree about a turn.
  const { quoted, named } = coachedThisTurn(turn);

  const reading = turn.assessment.cefrEvidence;
  if (reading !== null) {
    next.cefr.evidence.push(reading);
    next.cefr.evidence = next.cefr.evidence.slice(-EVIDENCE_WINDOW);
  }

  for (const pattern of turn.profileSignals.errorPatterns) {
    const tag = normalizeErrorTag(pattern.tag);
    if (tag.length === 0) continue;
    const existing = next.errorPatterns[tag];
    // Every turn of one live session shares `stats.sessions`, because only
    // `finishSession` increments it, so a second sighting this session leaves
    // `sessions` where it was and the next session's sighting raises it.
    const ordinal = next.stats.sessions;
    const newSession = existing === undefined || existing.lastSession !== ordinal;
    next.errorPatterns[tag] = {
      count: (existing?.count ?? 0) + 1,
      lastSeen: now,
      example: clampPatternExample(pattern.example || existing?.example || ''),
      sessions: (existing?.sessions ?? 0) + (newSession ? 1 : 0),
      lastSession: ordinal,
    };
  }
  evictStalePatterns(next);

  for (const phrase of turn.newPhrases) {
    const key = phraseKey(phrase.fr, phrase.frWritten);
    if (key.length === 0 || next.phrases[key]) continue;
    // A fragment the coach just quoted back is, by the model's own account,
    // what the learner got wrong. It never enters the phrase book, because
    // once it is in there it can collect credit and be projected as mastered —
    // an error the learner would then be handed back to review as French.
    //
    // Only `quoted`, deliberately, not `named`: the corrected form IS the
    // phrase worth keeping, and introducing it costs nothing, since a new entry
    // starts at zero uses and the credit loop below refuses it this turn.
    if (namedInCoaching(quoted, phrase.fr, phrase.frWritten)) continue;
    next.phrases[key] = {
      fr: phrase.fr,
      frWritten: phrase.frWritten,
      en: phrase.en,
      register: phrase.register,
      introducedAt: now,
      timesUsedWell: 0,
      timesAssisted: 0,
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
        // One turn, one verdict. A single model call can hand back a correction
        // and claim the same phrase was used well, and nothing downstream can
        // tell the two apart afterwards: this count is the brain's half of the
        // canonical phrase-evidence record, so three such turns write `mastered`
        // onto French the tutor spent those same three turns fixing.
        //
        // The quote is excluded because crediting it would have code agreeing
        // with two opposite verdicts about one utterance. The offered form is
        // excluded because the tutor said it, not the learner — repeating a line
        // that was just modelled is not the natural, unprompted production that
        // `convoUses` is the only counter allowed to claim.
        //
        // Checked against the stored entry's own spellings as well as the string
        // the model sent, since the two often disagree (the coach quotes the
        // written form, `usedWell` names the spoken one) and an exclusion that
        // missed on spelling would be no exclusion at all.
        //
        // The profile and the end card share one rule (LEARN-012): a form
        // quoted in coaching on an earlier turn of this session earns nothing
        // for the rest of it, here or on the card (`integrateTurn`). Only the
        // quote is remembered, never the offered form, so adopting the better
        // line on a later turn still counts in both.
        if (namedInCoaching(named, used, entry.fr, entry.frWritten)) continue;
        if (namedInCoaching(correctedEarlier, used, entry.fr, entry.frWritten)) continue;
        if (assisted) {
          // Said with the hint or the line on screen. Recorded, so the help is
          // visible, but it is not natural production and moves no mastery.
          entry.timesAssisted = (entry.timesAssisted ?? 0) + 1;
          continue;
        }
        entry.timesUsedWell += 1;
        // Mastery is a projection of the count, recomputed here rather than
        // decided here. `merge.ts` carries the flag across devices without
        // recomputing it, so this is the one line that may ever set it.
        entry.mastered = isMastered(entry.timesUsedWell);
      }
    }
  }

  return next;
}

/**
 * Exported for `merge.ts` alone. Two devices' error patterns union to more
 * than one device ever holds, so the merge has to re-apply this cap — and a
 * second copy of the eviction rule would be a second opinion about what the
 * learner is allowed to forget.
 */
export function evictStalePatterns(profile: LearnerProfile): void {
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
 *
 * Exported for `merge.ts` for the same reason as `evictStalePatterns`: the
 * merge has to re-apply the cap, and it must be this rule, not a copy of it.
 */
export function evictOverflowPhrases(profile: LearnerProfile): void {
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
  // `preferences.strictness` is deliberately not written here. It is the
  // learner's choice, and a session runs on whatever the agent decided this
  // time — a rescue-heavy scene, a default, later a dial. Copying the session's
  // value back made the stored preference a log of the last session instead of
  // a setting, so the one field a dial needs erased itself every time a session
  // ended. Sessions read this; only the learner writes it.
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
