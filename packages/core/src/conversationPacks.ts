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
  keyPhrases: ConversationPackPhrase[];
  wins: string[];
  corrections: ConversationPackCorrection[];
  pronunciationFocus: string | null;
  exercises: DrillExercise[];
  continuationSeed: ConversationPackSeed;
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
  keyPhrases: readonly ConversationPackPhrase[];
  wins?: readonly string[];
  corrections?: readonly ConversationPackCorrection[];
  pronunciationFocus?: string | null;
  exercises?: readonly DrillExercise[];
}

const PACK_STATES: readonly ConversationPackState[] = ['generating', 'ready', 'failed', 'archived'];
const FORBIDDEN_KEYS = new Set(['audio', 'rawaudio', 'recording', 'recordings', 'transcript', 'history']);

function text(value: string): string {
  return value.trim();
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

export function buildConversationPack(input: BuildConversationPackInput): ConversationPack {
  const title = { fr: text(input.title.fr), en: text(input.title.en) };
  const keyPhrases = input.keyPhrases.map(phraseOf).filter((phrase): phrase is ConversationPackPhrase => phrase !== null).slice(0, 12);
  const corrections = (input.corrections ?? [])
    .map(correctionOf)
    .filter((correction): correction is ConversationPackCorrection => correction !== null)
    .slice(0, 3);
  const correctionFocus = corrections[0]?.better ?? null;
  const state = input.state ?? 'ready';

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
    keyPhrases,
    wins: [...new Set((input.wins ?? []).map(text).filter(Boolean))].slice(0, 6),
    corrections,
    pronunciationFocus: input.pronunciationFocus ? text(input.pronunciationFocus) || null : null,
    exercises: ensureTranslationExercises(text(input.id), keyPhrases, input.exercises ?? []),
    continuationSeed: { titleFr: title.fr, titleEn: title.en, correctionFocus },
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
  return value.exercises.every((exercise) => validateExercise(exercise as DrillExercise).ok);
}
