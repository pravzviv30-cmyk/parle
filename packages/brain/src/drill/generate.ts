/**
 * Drill authoring — the post-session call that turns today's conversation
 * into tomorrow's exercises.
 *
 * "Tomorrow's drills are the sentences you spoke today" is the bridge between
 * the product's two modes: the conversation surfaces phrases and errors, this
 * call turns them into offline reps that cost nothing to sit. It runs on the
 * analyst route, after the recap has shipped, because accepted-answer sets
 * are load-bearing pedagogy — an answer set that rejects good French teaches
 * the learner their good French was bad.
 *
 * The schemas mirror core's DrillExercise shapes exactly (the type-level
 * check at the bottom pins that), written under structured-outputs rules:
 * every field required, nullable never optional, no refinements, and no
 * recursion — which is why a mic exercise's silent twin is the union of
 * every kind EXCEPT its own.
 */

import { z } from 'zod/v4';

import { normalise, phraseKeyOf, type DrillExercise } from '@luvani/core';

import type { NewPhrase } from '../contract/types.ts';

const BASE = {
  /** 'gen:<phraseKey>:<kind>' — stable, so a regenerated exercise replaces its elder. */
  id: z.string(),
  /** EXACTLY the review deck's identity: 'phrase:' + the French line, trimmed, lowercased. */
  phraseKey: z.string(),
  /**
   * Whether this exercise asks the phrase in a changed situation. Required
   * rather than optional, because structured outputs have no optional fields
   * and because "the model forgot to say" and "no, it does not" must not be
   * the same value on a mark that becomes evidence. The instruction has always
   * asked for a third of the set to test transfer; this is where the answer is
   * recorded instead of guessed at afterwards.
   */
  transfer: z.boolean(),
};

const FillBlankZ = z.object({
  kind: z.literal('fill-blank'),
  ...BASE,
  /** Options are recognition; a null option list is typed production. */
  difficulty: z.enum(['recognition', 'production']),
  sentence: z.string(),
  options: z.array(z.string()).nullable(),
  accepted: z.array(z.string()),
  en: z.string(),
});

const BestSentenceZ = z.object({
  kind: z.literal('best-sentence'),
  ...BASE,
  difficulty: z.literal('recognition'),
  prompt: z.string(),
  candidates: z.array(z.object({ fr: z.string(), en: z.string() })),
  correctIndex: z.number(),
});

const AppropriateReplyZ = z.object({
  kind: z.literal('appropriate-reply'),
  ...BASE,
  difficulty: z.literal('recognition'),
  line: z.object({ speaker: z.string(), fr: z.string(), en: z.string() }),
  options: z.array(z.object({ fr: z.string(), en: z.string() })),
  acceptableIndexes: z.array(z.number()),
});

const TapTranslateZ = z.object({
  kind: z.literal('tap-translate'),
  ...BASE,
  difficulty: z.literal('recognition'),
  en: z.string(),
  tokens: z.array(z.string()),
  accepted: z.array(z.string()),
});

const ListenTypeZ = z.object({
  kind: z.literal('listen-type'),
  ...BASE,
  difficulty: z.literal('production'),
  fr: z.string(),
  accepted: z.array(z.string()),
});

const NonMicExerciseZ = z.discriminatedUnion('kind', [
  FillBlankZ,
  BestSentenceZ,
  AppropriateReplyZ,
  TapTranslateZ,
  ListenTypeZ,
]);

const RepeatThisZ = z.object({
  kind: z.literal('repeat-this'),
  ...BASE,
  difficulty: z.literal('production'),
  reference: z.string(),
  referenceEn: z.string(),
  ipa: z.string().nullable(),
  noMicTwin: NonMicExerciseZ,
});

export const GeneratedExerciseZ = z.discriminatedUnion('kind', [
  FillBlankZ,
  BestSentenceZ,
  AppropriateReplyZ,
  TapTranslateZ,
  ListenTypeZ,
  RepeatThisZ,
]);

export const DrillBatchSchema = z.object({
  exercises: z.array(GeneratedExerciseZ),
});

export type DrillBatch = z.infer<typeof DrillBatchSchema>;

// The whole point of mirroring: a generated exercise IS a core exercise. If
// core's shapes drift, this line breaks the build instead of the learner.
//
// One core kind is deliberately absent from the union above: 'own-words' has no
// accepted answers and no key, so there is nothing for a generator to author
// and nothing for the schema to validate. It is built by core's own
// `ownWordsFrom` from a phrase the learner already met, and judged by a
// separate call. Adding it here would invite the authoring model to invent a
// right answer for the one exercise that must not have one.
const _shapeCheck: DrillExercise[] = [] as z.infer<typeof DrillBatchSchema>['exercises'];
void _shapeCheck;

export interface DrillGenerationInput {
  /** Phrases this session taught — the freshest material, drilled first. */
  sessionPhrases: readonly NewPhrase[];
  /** Unmastered phrases already on file, capped by the caller. */
  profilePhrases: readonly { fr: string; frWritten: string | null; en: string }[];
  /** The learner's top recurring error tags, most frequent first. */
  errorTags: readonly string[];
  /** Topic labels ground situational transfer without inventing a new course. */
  topics: readonly { en: string; fr: string }[];
  /**
   * What the learner used well, unaided, this session: each one earns exactly
   * one harder, changed-situation exercise. Capped at MAX_TRANSFER_PHRASES in
   * code. The caller must also count these among its grounded phrase keys, or
   * `groundedDrills` drops the very exercises this asks for.
   */
  transferPhrases?: readonly { fr: string; en: string }[];
}

/** Success leads to a harder task, but only a couple: the set stays a practice set. */
export const MAX_TRANSFER_PHRASES = 2;

/** The one code-owned instruction a non-empty transfer list adds. */
export const TRANSFER_INSTRUCTION = `For each phrase listed under "Used well today", write exactly one exercise marked transfer: true that needs that phrase in a changed situation (a different item, place, person or small problem), not the original scene. Keep it at the learner's level. Its phraseKey follows the same rule as every other exercise.`;

/**
 * Pick at most two transfer phrases from a session's wins.
 *
 * A win is already filtered of in-session corrections upstream, but this check
 * runs again against every corrected form the caller knows (the quote and the
 * better line): a phrase the tutor had to fix is not a success to build on,
 * even when the learner later adopted it. `prefer` floats phrases with prior
 * evidence (mastered, or used well before) to the front; `known` supplies an
 * English gloss when one is on file.
 */
export function transferPhrasesFrom(
  wins: readonly string[],
  options: {
    corrected?: readonly string[];
    known?: readonly { fr: string; frWritten?: string | null; en: string }[];
    prefer?: (fr: string) => boolean;
  } = {},
): { fr: string; en: string }[] {
  const corrected = new Set((options.corrected ?? []).map(normalise).filter((key) => key.length > 0));
  const seen = new Set<string>();
  const picked: { fr: string; en: string; preferred: boolean }[] = [];
  for (const raw of wins) {
    const fr = raw.trim();
    const key = normalise(fr);
    if (key.length === 0 || seen.has(key) || corrected.has(key)) continue;
    seen.add(key);
    const gloss = options.known?.find((p) => normalise(p.fr) === key || (p.frWritten != null && normalise(p.frWritten) === key));
    picked.push({ fr, en: gloss?.en ?? '', preferred: options.prefer?.(fr) ?? false });
  }
  return picked
    .map((p, index) => ({ ...p, index }))
    .sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.index - b.index)
    .slice(0, MAX_TRANSFER_PHRASES)
    .map(({ fr, en }) => ({ fr, en }));
}

/** The phrase keys a request's transfer list adds to the grounded set. */
export function transferPhraseKeys(phrases: readonly { fr: string }[]): string[] {
  return phrases.slice(0, MAX_TRANSFER_PHRASES).map((p) => phraseKeyOf(p.fr));
}

const INSTRUCTION = [
  `Author a varied practice set from today's conversation, its small extension phrases, and older language the learner has not mastered.`,
  ``,
  `Rules:`,
  `- 6 to 14 exercises. For each phrase, author the formats it genuinely suits, easiest first: options before typing, typing before speaking. The same phrase may appear in several formats; that is the ramp working.`,
  `- id: 'gen:<phraseKey>:<kind>'. phraseKey: EXACTLY 'phrase:' followed by the phrase's French line, trimmed and lowercased. This links the exercise to the learner's review card; a wrong key orphans it.`,
  `- difficulty: 'recognition' for options and token assembly, 'production' for typed and spoken.`,
  `- accepted: four to eight genuinely-said spoken variants (the ne dropped, on for nous, contractions). Never two entries that differ by one letter. The learner's answer is compared accent-insensitively.`,
  `- fill-blank sentences carry ___ where the answer goes; blank the part the learner gets wrong. Use their recurring errors below to aim these.`,
  `- tap-translate tokens must assemble at least one accepted answer, with two or three plausible extra tokens. Every token must contain a real word; attach punctuation to a word and never emit a standalone punctuation token.`,
  `- best-sentence and appropriate-reply distractors are correct-sounding French that fails the situation, never gibberish.`,
  `- Mix formats like a modern language app: meaning choice, dialogue reply, token assembly, typing, listening, and speaking whenever the phrase genuinely supports them. Never make the whole set fill-in-the-blank.`,
  `- At least one third of the exercises must test transfer: the same phrase or skill in a new but closely related situation. Change the surrounding context, speaker, or intent without changing phraseKey to unrelated language.`,
  `- transfer: true on exactly those exercises, false on the rest, noMicTwin included. This mark is what lets a correct answer count as evidence that the language travelled; guessing it later is not possible.`,
  `- every repeat-this carries noMicTwin: a listen-type or typed fill-blank of the SAME phrase, same phraseKey, its own id. listen-type and typed fill-blank are production, including when nested as noMicTwin.`,
  `- English text is English only. No em dash anywhere. No digits. Never "wrong", "incorrect", "bad" or "failed" in any string.`,
].join('\n');

function phraseLine(phrase: { fr: string; frWritten: string | null; en: string }): string {
  const written = phrase.frWritten === null ? '' : ` (written: ${phrase.frWritten})`;
  return `- "${phrase.fr}"${written} = ${phrase.en}`;
}

export function buildDrillGenerationRequest(input: DrillGenerationInput): string {
  const lines: string[] = [INSTRUCTION, ``];
  if (input.topics.length > 0) {
    lines.push(`Discussed topics:`, ...input.topics.map((topic) => `- ${topic.en} (${topic.fr})`), ``);
  }
  if (input.sessionPhrases.length > 0) {
    lines.push(`Today's phrases:`, ...input.sessionPhrases.map(phraseLine), ``);
  }
  if (input.profilePhrases.length > 0) {
    lines.push(`Still unmastered from before:`, ...input.profilePhrases.map(phraseLine), ``);
  }
  if (input.errorTags.length > 0) {
    lines.push(`Recurring errors to aim fill-blanks at: ${input.errorTags.join(', ')}`);
  }
  const transfer = (input.transferPhrases ?? []).filter((p) => p.fr.trim().length > 0).slice(0, MAX_TRANSFER_PHRASES);
  if (transfer.length > 0) {
    if (input.errorTags.length > 0) lines.push(``);
    lines.push(
      TRANSFER_INSTRUCTION,
      `Used well today:`,
      ...transfer.map((p) => (p.en.trim().length > 0 ? `- "${p.fr.trim()}" = ${p.en.trim()}` : `- "${p.fr.trim()}"`)),
    );
  }
  return lines.join('\n');
}
