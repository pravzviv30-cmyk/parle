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

import type { DrillExercise } from '@parle/core';

import type { NewPhrase } from '../contract/types.ts';

const BASE = {
  /** 'gen:<phraseKey>:<kind>' — stable, so a regenerated exercise replaces its elder. */
  id: z.string(),
  /** EXACTLY the review deck's identity: 'phrase:' + the French line, trimmed, lowercased. */
  phraseKey: z.string(),
  difficulty: z.enum(['recognition', 'production']),
};

const FillBlankZ = z.object({
  kind: z.literal('fill-blank'),
  ...BASE,
  sentence: z.string(),
  options: z.array(z.string()).nullable(),
  accepted: z.array(z.string()),
  en: z.string(),
});

const BestSentenceZ = z.object({
  kind: z.literal('best-sentence'),
  ...BASE,
  prompt: z.string(),
  candidates: z.array(z.object({ fr: z.string(), en: z.string() })),
  correctIndex: z.number(),
});

const AppropriateReplyZ = z.object({
  kind: z.literal('appropriate-reply'),
  ...BASE,
  line: z.object({ speaker: z.string(), fr: z.string(), en: z.string() }),
  options: z.array(z.object({ fr: z.string(), en: z.string() })),
  acceptableIndexes: z.array(z.number()),
});

const TapTranslateZ = z.object({
  kind: z.literal('tap-translate'),
  ...BASE,
  en: z.string(),
  tokens: z.array(z.string()),
  accepted: z.array(z.string()),
});

const ListenTypeZ = z.object({
  kind: z.literal('listen-type'),
  ...BASE,
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
const _shapeCheck: DrillExercise[] = [] as z.infer<typeof DrillBatchSchema>['exercises'];
void _shapeCheck;

export interface DrillGenerationInput {
  /** Phrases this session taught — the freshest material, drilled first. */
  sessionPhrases: readonly NewPhrase[];
  /** Unmastered phrases already on file, capped by the caller. */
  profilePhrases: readonly { fr: string; frWritten: string | null; en: string }[];
  /** The learner's top recurring error tags, most frequent first. */
  errorTags: readonly string[];
}

const INSTRUCTION = [
  `Author drill exercises from the material below — the learner's own phrases from today's conversation, plus older ones they have not yet mastered.`,
  ``,
  `Rules:`,
  `- 6 to 14 exercises. For each phrase, author the formats it genuinely suits, easiest first: options before typing, typing before speaking. The same phrase may appear in several formats; that is the ramp working.`,
  `- id: 'gen:<phraseKey>:<kind>'. phraseKey: EXACTLY 'phrase:' followed by the phrase's French line, trimmed and lowercased. This links the exercise to the learner's review card; a wrong key orphans it.`,
  `- difficulty: 'recognition' for options and token assembly, 'production' for typed and spoken.`,
  `- accepted: four to eight genuinely-said spoken variants (the ne dropped, on for nous, contractions). Never two entries that differ by one letter. The learner's answer is compared accent-insensitively.`,
  `- fill-blank sentences carry ___ where the answer goes; blank the part the learner gets wrong. Use their recurring errors below to aim these.`,
  `- tap-translate tokens must assemble at least one accepted answer, with two or three plausible extra tokens.`,
  `- best-sentence and appropriate-reply distractors are correct-sounding French that fails the situation, never gibberish.`,
  `- every repeat-this carries noMicTwin: a listen-type or typed fill-blank of the SAME phrase, same phraseKey, its own id.`,
  `- English text is English only. No em dash anywhere. No digits. Never "wrong", "incorrect", "bad" or "failed" in any string.`,
].join('\n');

function phraseLine(phrase: { fr: string; frWritten: string | null; en: string }): string {
  const written = phrase.frWritten === null ? '' : ` (written: ${phrase.frWritten})`;
  return `- "${phrase.fr}"${written} = ${phrase.en}`;
}

export function buildDrillGenerationRequest(input: DrillGenerationInput): string {
  const lines: string[] = [INSTRUCTION, ``];
  if (input.sessionPhrases.length > 0) {
    lines.push(`Today's phrases:`, ...input.sessionPhrases.map(phraseLine), ``);
  }
  if (input.profilePhrases.length > 0) {
    lines.push(`Still unmastered from before:`, ...input.profilePhrases.map(phraseLine), ``);
  }
  if (input.errorTags.length > 0) {
    lines.push(`Recurring errors to aim fill-blanks at: ${input.errorTags.join(', ')}`);
  }
  return lines.join('\n');
}
