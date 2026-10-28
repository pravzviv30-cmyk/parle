/**
 * Conversation Packs are the durable learning unit a live Tutor session earns.
 *
 * This module is deliberately platform-free: the agent builds a pack, the
 * token server validates and stores it, and the app renders the same object.
 * It contains curated learning data only.  Raw microphone audio, a turn-by-
 * turn transcript, and private profile memory are intentionally not fields in
 * this contract.
 */

import { phraseKeyOf } from './topics/topics.ts';
import { validateExercise, type DrillExercise, type TranslationExercise } from './drill/index.ts';

export const CONVERSATION_PACK_VERSION = 1;

export type ConversationPackState = 'generating' | 'ready' | 'failed' | 'archived';

export interface ConversationPackPhrase {
  fr: string;
  /** Spoken spelling where it differs; null means the ordinary spelling. */
  frWritten: string | null;
  en: string;
}

export interface ConversationPackCorrection {
  quote: string;
  better: string;
  betterEn: string;
  why: string;
}

/** What the conversation was about, in both languages, for a Practice card. */
export interface ConversationPackTopic {
  fr: string;
  en: string;
}

export interface ConversationPackSeed {
  titleFr: string;
  titleEn: string;
  /** At most one high-value correction travels into the next conversation. */
  correctionFocus: string | null;
}

export interface ConversationPack {
  version: typeof CONVERSATION_PACK_VERSION;
  /** The completed LiveKit session id, reused as the idempotency key. */
  id: string;
  sessionId: string;
  learnerId: string;
  createdAt: string;
  lastPractisedAt: string | null;
  state: ConversationPackState;
  title: { fr: string; en: string };
  summary: string;
  learnerGoal: string | null;
  tutorGoal: string | null;
  cefr: string | null;
  /**
   * Seconds the conversation ran for, or null when the session was not timed.
   *
   * Null and never 0. `apps/mobile/src/progress/momentum.ts` settled this for
   * the goal bar: nothing measured is not zero minutes of speaking, and a card
   * reading a nought over a real conversation tells the learner it did not
   * happen. A pack stored before this field existed carries no key at all, so
   * read it as `pack.durationSec ?? null` rather than assuming a number.
   */
  durationSec: number | null;
  /**
   * The subjects the conversation opened.
   *
   * Absent, not empty, on any pack written before this field existed, which is
   * what `isConversationPack` allows and what `normaliseConversationPack` is
   * for. Read a pack that has been through that function and this is an array;
   * read one straight off the wire and it may not be there at all.
   */
  topics: ConversationPackTopic[];
  keyPhrases: ConversationPackPhrase[];
  wins: string[];
  corrections: ConversationPackCorrection[];
  pronunciationFocus: string | null;
  exercises: DrillExercise[];
  continuationSeed: ConversationPackSeed;
  /**
   * The saved conversation a tutor revisit was started from, as an identifier
   * only. Never a copy of the source pack, its summary or its phrases.
   *
   * Optional twice over, like `durationSec`: an ordinary conversation carries
   * no key at all, and a pack written before this field existed carries none
   * either. `normaliseConversationPack` turns a malformed or self-referencing
   * link into null rather than rejecting the pack, because a bad link must
   * cost the learner the link, never the practice. The token server attaches
   * it only after an owner check; see `withVerifiedRevisionSource`.
   */
  revisedFromPackId?: string | null;
}

export interface BuildConversationPackInput {
  id: string;
  sessionId: string;
  learnerId: string;
  createdAt: string;
  state?: ConversationPackState;
  title: { fr: string; en: string };
  summary: string;
  learnerGoal?: string | null;
  tutorGoal?: string | null;
  cefr?: string | null;
  /** Wall clock seconds, when the caller measured any. */
  durationSec?: number | null;
  topics?: readonly ConversationPackTopic[];
  keyPhrases: readonly ConversationPackPhrase[];
  wins?: readonly string[];
  corrections?: readonly ConversationPackCorrection[];
  pronunciationFocus?: string | null;
  exercises?: readonly DrillExercise[];
  /** The conversation this one revisited. Dropped unless it is a well-formed, different pack id. */
  revisedFromPackId?: string | null;
}

const PACK_STATES: readonly ConversationPackState[] = ['generating', 'ready', 'failed', 'archived'];
/**
 * How many topics a Practice card carries.
 *
 * Four for the same reason `wins` stops at six: a card is a glance, not a
 * report. A conversation that names more than a handful of subjects touched
 * them rather than covered them, and a row of ten chips under a title stops
 * summarising the conversation and starts hiding it.
 */
const MAX_TOPICS = 4;
const FORBIDDEN_KEYS = new Set(['audio', 'rawaudio', 'recording', 'recordings', 'transcript', 'history']);

function text(value: string): string {
  return value.trim();
}

/**
 * The shape a pack id may take when one pack refers to another.
 *
 * Live packs are keyed by a LiveKit session UUID, but fixtures, the design
 * preview and older tooling use short slugs, so this does not assume a UUID.
 * The bound matches `parseTutorRevision`'s packId (100), and the alphabet is
 * what both shapes actually use: no spaces, separators or control characters
 * that could turn an identifier into a path, a query or a prompt.
 */
const PACK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

/** A trimmed pack identifier, or null when the value cannot be one. */
export function conversationPackIdOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  return PACK_ID_PATTERN.test(id) ? id : null;
}

/** A usable revisit link for the pack `id`: well-formed and never itself. */
function revisionSourceFor(id: string, value: unknown): string | null {
  const source = conversationPackIdOf(value);
  return source !== null && source !== id ? source : null;
}

function phraseOf(value: ConversationPackPhrase): ConversationPackPhrase | null {
  const fr = text(value.fr);
  const en = text(value.en);
  if (!fr || !en) return null;
  const written = value.frWritten === null ? null : text(value.frWritten);
  return { fr, frWritten: written || null, en };
}

function correctionOf(value: ConversationPackCorrection): ConversationPackCorrection | null {
  const quote = text(value.quote);
  const better = text(value.better);
  const betterEn = text(value.betterEn);
  const why = text(value.why);
  return quote && better && betterEn && why ? { quote, better, betterEn, why } : null;
}

function topicOf(value: ConversationPackTopic): ConversationPackTopic | null {
  const fr = text(value.fr);
  const en = text(value.en);
  return fr && en ? { fr, en } : null;
}

/**
 * Seconds spoken, or null.
 *
 * Zero is rejected along with the impossible values, because zero is what a
 * missing measurement looks like once it has been rounded, and the one thing
 * this field must never say is that a conversation the learner remembers
 * having lasted no time at all.
 */
function durationOf(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const seconds = Math.round(value);
  return seconds > 0 ? seconds : null;
}

/**
 * Deterministic bilingual practice.  It is intentionally modest: when AI
 * authoring is slow or unavailable, a learner still receives both promised
 * translation directions rather than an empty or failed pack.
 */
export function translationExercisesFor(
  packId: string,
  phrases: readonly ConversationPackPhrase[],
): TranslationExercise[] {
  return phrases.slice(0, 6).flatMap((phrase, index) => {
    const phraseKey = phraseKeyOf(phrase.fr);
    const base = {
      phraseKey,
      difficulty: 'production' as const,
      fr: phrase.fr,
      en: phrase.en,
    };
    return [
      { ...base, id: `pack:${packId}:fr-en:${index}`, kind: 'translate' as const, direction: 'fr-en' as const, accepted: [phrase.en] },
      { ...base, id: `pack:${packId}:en-fr:${index}`, kind: 'translate' as const, direction: 'en-fr' as const, accepted: [phrase.fr] },
    ];
  });
}

/** Add the guaranteed directions without throwing away richer generated work. */
export function ensureTranslationExercises(
  packId: string,
  phrases: readonly ConversationPackPhrase[],
  exercises: readonly DrillExercise[],
): DrillExercise[] {
  const valid = exercises.filter((exercise) => validateExercise(exercise).ok);
  const existing = new Set(
    valid
      .filter((exercise): exercise is TranslationExercise => exercise.kind === 'translate')
      .map((exercise) => `${exercise.phraseKey}\u0000${exercise.direction}`),
  );
  const required = translationExercisesFor(packId, phrases).filter(
    (exercise) => !existing.has(`${exercise.phraseKey}\u0000${exercise.direction}`),
  );
  return [...valid, ...required];
}

/**
 * A stored pack, made safe to read.
 *
 * `durationSec` and `topics` were added after packs were already on disk and in
 * the server's table, so every pack written before them carries neither key.
 * `isConversationPack` accepts that deliberately: a whole conversation is not
 * worth discarding over a card decoration. The cost of that decision is that a
 * value typed as present can be absent at runtime, and a screen that trusted
 * the type went blank on the founder's phone rather than saying anything.
 *
 * So the compatibility is paid here, once, at the boundary where a pack enters
 * the app, rather than by every reader remembering a `?? []`. One reader who
 * forgets is one silent blank screen, and the next field added will have the
 * same shape as these two.
 *
 * Everything else is passed through untouched. This fills gaps; it does not
 * validate. `isConversationPack` is still what decides whether a pack is a pack.
 */
export function normaliseConversationPack(pack: ConversationPack): ConversationPack {
  const topics = Array.isArray(pack.topics) ? pack.topics : [];
  const durationSec = durationOf(pack.durationSec);
  // Absent stays absent: an ordinary conversation is not "revised from null".
  // A present link that is malformed or points at itself is cleared to null.
  const revisedFromPackId = pack.revisedFromPackId === undefined || pack.revisedFromPackId === null
    ? pack.revisedFromPackId
    : revisionSourceFor(pack.id, pack.revisedFromPackId);
  if (topics === pack.topics && durationSec === pack.durationSec && revisedFromPackId === pack.revisedFromPackId) return pack;
  return {
    ...pack,
    topics,
    durationSec,
    ...(revisedFromPackId !== undefined ? { revisedFromPackId } : {}),
  };
}

/**
 * Take an unverified revisit link off an incoming pack before anything trusts it.
 *
 * The pack itself is returned without the key, so validation and storage see
 * an ordinary pack; `claimedSource` is the well-formed id that was asked for,
 * or null. Garbage in the link is discarded here rather than rejecting the
 * whole pack, because the conversation is real even when its link is not.
 */
export function withoutRevisionSource(value: unknown): { pack: unknown; claimedSource: string | null } {
  if (!record(value) || !('revisedFromPackId' in value)) return { pack: value, claimedSource: null };
  const { revisedFromPackId, ...pack } = value;
  return { pack, claimedSource: conversationPackIdOf(revisedFromPackId) };
}

/**
 * Attach a revisit link only when the caller proves the learner owns it.
 *
 * `owns` is the storage-side owner check (the token server passes its
 * owner-scoped pack lookup). Anything short of a clear yes, including a
 * lookup that throws, a malformed id or a pack claiming to revise itself,
 * yields the pack with no link at all: never a foreign id, never a lost pack.
 * A link already sitting on `pack` is ignored; only `source` can link.
 */
export async function withVerifiedRevisionSource(
  pack: ConversationPack,
  source: string | null,
  owns: (sourceId: string) => Promise<boolean>,
): Promise<ConversationPack> {
  const { revisedFromPackId: _claimed, ...plain } = pack;
  const id = revisionSourceFor(pack.id, source);
  if (id === null) return plain;
  let verified = false;
  try {
    verified = (await owns(id)) === true;
  } catch {
    verified = false;
  }
  return verified ? { ...plain, revisedFromPackId: id } : plain;
}

/** Every pack in a stored or fetched list, made safe to read. */
export function normaliseConversationPacks(packs: readonly ConversationPack[]): ConversationPack[] {
  return packs.map(normaliseConversationPack);
}

/**
 * Every fix the recap holds (brain's MAX_FIXES, held equal by a brain test)
 * reaches the pack, and so "Your fixes" (F906).
 */
export const MAX_PACK_CORRECTIONS = 6;

export function buildConversationPack(input: BuildConversationPackInput): ConversationPack {
  const title = { fr: text(input.title.fr), en: text(input.title.en) };
  const keyPhrases = input.keyPhrases.map(phraseOf).filter((phrase): phrase is ConversationPackPhrase => phrase !== null).slice(0, 12);
  const corrections = (input.corrections ?? [])
    .map(correctionOf)
    .filter((correction): correction is ConversationPackCorrection => correction !== null)
    .slice(0, MAX_PACK_CORRECTIONS);
  const correctionFocus = corrections[0]?.better ?? null;
  const state = input.state ?? 'ready';
  const seen = new Set<string>();
  const topics = (input.topics ?? [])
    .map(topicOf)
    .filter((topic): topic is ConversationPackTopic => {
      if (topic === null) return false;
      const key = `${topic.fr}\u0000${topic.en}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_TOPICS);
  const revisedFrom = revisionSourceFor(text(input.id), input.revisedFromPackId);

  return {
    version: CONVERSATION_PACK_VERSION,
    id: text(input.id),
    sessionId: text(input.sessionId),
    learnerId: text(input.learnerId),
    createdAt: text(input.createdAt),
    lastPractisedAt: null,
    state: PACK_STATES.includes(state) ? state : 'failed',
    title,
    summary: text(input.summary),
    learnerGoal: input.learnerGoal ? text(input.learnerGoal) || null : null,
    tutorGoal: input.tutorGoal ? text(input.tutorGoal) || null : null,
    cefr: input.cefr ? text(input.cefr) || null : null,
    durationSec: durationOf(input.durationSec),
    topics,
    keyPhrases,
    wins: [...new Set((input.wins ?? []).map(text).filter(Boolean))].slice(0, 6),
    corrections,
    pronunciationFocus: input.pronunciationFocus ? text(input.pronunciationFocus) || null : null,
    exercises: ensureTranslationExercises(text(input.id), keyPhrases, input.exercises ?? []),
    continuationSeed: { titleFr: title.fr, titleEn: title.en, correctionFocus },
    ...(revisedFrom !== null ? { revisedFromPackId: revisedFrom } : {}),
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Guard against accidentally widening this contract into stored speech. */
export function containsForbiddenConversationData(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenConversationData);
  if (!record(value)) return false;
  return Object.entries(value).some(([key, child]) => FORBIDDEN_KEYS.has(key.toLowerCase()) || containsForbiddenConversationData(child));
}

/** Strict enough for the trust boundary; richer data is rebuilt, not guessed. */
export function isConversationPack(value: unknown): value is ConversationPack {
  if (!record(value) || containsForbiddenConversationData(value)) return false;
  const title = value.title;
  const seed = value.continuationSeed;
  if (
    value.version !== CONVERSATION_PACK_VERSION ||
    typeof value.id !== 'string' ||
    typeof value.sessionId !== 'string' ||
    typeof value.learnerId !== 'string' ||
    typeof value.createdAt !== 'string' ||
    !PACK_STATES.includes(value.state as ConversationPackState) ||
    !record(title) || typeof title.fr !== 'string' || typeof title.en !== 'string' ||
    typeof value.summary !== 'string' ||
    !Array.isArray(value.keyPhrases) || !Array.isArray(value.exercises) ||
    !record(seed) || typeof seed.titleFr !== 'string' || typeof seed.titleEn !== 'string'
  ) return false;
  if (!value.keyPhrases.every((phrase) => record(phrase) && typeof phrase.fr === 'string' && typeof phrase.en === 'string')) return false;
  if (!Array.isArray(value.corrections) || !value.corrections.every((c) => record(c) &&
    ['quote', 'better', 'betterEn', 'why'].every((key) => typeof c[key] === 'string'))) return false;
  if (!Array.isArray(value.wins) || !value.wins.every((win) => typeof win === 'string')) return false;
  // The whole compatibility story: packs written before these two fields
  // existed carry neither key, and a stored conversation is not worth
  // discarding over a card decoration. Absent is fine, present must be typed.
  if (value.durationSec !== undefined && value.durationSec !== null && typeof value.durationSec !== 'number') return false;
  if (value.topics !== undefined && (
    !Array.isArray(value.topics) ||
    !value.topics.every((topic) => record(topic) && typeof topic.fr === 'string' && typeof topic.en === 'string')
  )) return false;
  // The revisit link is the same kind of late field: absent or null is an
  // ordinary pack, a string is kept (and cleared by normalising if malformed),
  // anything else is not the contract.
  if (value.revisedFromPackId !== undefined && value.revisedFromPackId !== null &&
    typeof value.revisedFromPackId !== 'string') return false;
  // Runtime exercise data need not honour the TypeScript union. A bad nested
  // field must reject the pack, not throw out of an authenticated endpoint.
  try {
    return value.exercises.every((exercise) => validateExercise(exercise as DrillExercise).ok);
  } catch {
    return false;
  }
}
