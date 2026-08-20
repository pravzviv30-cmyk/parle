/**
 * The post-session curation call — the practice editor.
 *
 * A conversation used to dump every phrase it touched into the review deck: a
 * dozen cards, all due at once, which is homework nobody assigned. This module
 * is the editor between the session and Practice: the model proposes which few
 * phrases were worth keeping and which topic each belongs to, and CODE
 * disposes — caps, matching against what the session actually recorded, and a
 * deterministic fallback when the call fails. The app receives topics, not a
 * card flood.
 *
 * Same shape as extraction: runs once, post-session, off every critical path.
 * Kept separate from extraction because the two answer different questions on
 * different budgets — memory is about the person, curation is about the
 * practice — and merging them degrades both prompts.
 */

import { z } from 'zod/v4';

import type { NewPhrase } from '../contract/types.ts';

/** Structured-output rules: every field required, nullable never optional. */
export const CurationSchema = z.object({
  topics: z.array(
    z.object({
      /** Short noun phrase naming the topic, in English. */
      titleEn: z.string(),
      /** The same topic in simple French. */
      titleFr: z.string(),
      /** Kept phrases, exactly as written in the phrase list, best first. */
      phraseFr: z.array(z.string()),
    }),
  ),
});

export type Curation = z.infer<typeof CurationSchema>;

/** A topic card's worth of practice, phrases resolved back to full objects. */
export interface CuratedTopic {
  title: { fr: string; en: string };
  phrases: NewPhrase[];
}

export interface CurationInput {
  /** What the conversation was about, in order: the scene first, then steers. */
  topics: readonly { en: string; fr: string }[];
  /** Everything the session recorded as worth possibly keeping. */
  phrases: readonly NewPhrase[];
}

/** Never more phrases than a learner would genuinely revisit tomorrow. */
export const MAX_KEPT_PHRASES = 5;
/** Never more topic cards than a twelve-turn conversation can honestly earn. */
export const MAX_CURATED_TOPICS = 3;

const INSTRUCTION = [
  `The session below has ended. You are choosing what becomes practice. Answer two questions: which of the session's phrases are worth keeping, and which topic does each belong to?`,
  ``,
  `Rules:`,
  `- Keep at most five phrases, the ones this learner would genuinely reach for again. Prefer what they struggled toward or asked for over pleasantries and filler.`,
  `- Group the kept phrases under the topics you actually talked about, listed below. Use those names verbatim when they fit; write a better short name only when none fits.`,
  `- titleEn and titleFr are short noun phrases naming the topic. phraseFr lists each kept phrase EXACTLY as written in the phrase list below, best first.`,
  `- At most three topics. A topic with nothing worth keeping is left out entirely.`,
].join('\n');

export function buildCurationRequest(input: CurationInput): string {
  const lines: string[] = [INSTRUCTION, ``, `TOPICS TALKED ABOUT, IN ORDER`];
  for (const topic of input.topics) lines.push(`- ${topic.en} (${topic.fr})`);
  lines.push(``, `PHRASES THE SESSION RECORDED`);
  for (const phrase of input.phrases) lines.push(`- "${phrase.fr}" = ${phrase.en} [${phrase.register}]`);
  return lines.join('\n');
}

function keyOf(fr: string): string {
  return fr.trim().toLowerCase();
}

/**
 * Code disposes. Resolve the model's proposal against what the session really
 * recorded: unknown phrases are dropped, duplicates keep their first home,
 * the caps hold whatever the model said, and a failed or empty proposal falls
 * back to one topic (the session's first, which is the scene itself) carrying
 * the first few phrases in the order they were met. The result is
 * deterministic for a given input, so the app can trust exactly one practice
 * message per session.
 */
export function applyCuration(
  raw: Curation | null,
  sessionPhrases: readonly NewPhrase[],
  sessionTopics: readonly { en: string; fr: string }[],
): CuratedTopic[] {
  const byKey = new Map<string, NewPhrase>();
  for (const phrase of sessionPhrases) {
    const key = keyOf(phrase.fr);
    if (key.length > 0 && !byKey.has(key)) byKey.set(key, phrase);
  }

  const topics: CuratedTopic[] = [];
  const claimed = new Set<string>();
  let kept = 0;

  if (raw !== null) {
    for (const proposal of raw.topics) {
      if (topics.length >= MAX_CURATED_TOPICS || kept >= MAX_KEPT_PHRASES) break;
      const titleEn = proposal.titleEn.trim();
      const titleFr = proposal.titleFr.trim();
      if (titleEn.length === 0) continue;

      const phrases: NewPhrase[] = [];
      for (const fr of proposal.phraseFr) {
        if (kept >= MAX_KEPT_PHRASES) break;
        const key = keyOf(fr);
        const match = byKey.get(key);
        if (match === undefined || claimed.has(key)) continue;
        claimed.add(key);
        phrases.push(match);
        kept += 1;
      }
      // A topic with nothing worth keeping is not a card.
      if (phrases.length > 0) topics.push({ title: { en: titleEn, fr: titleFr.length > 0 ? titleFr : titleEn }, phrases });
    }
  }

  if (topics.length > 0) return topics;

  // The fallback: the scene's own topic, the first few phrases as met.
  const home = sessionTopics[0];
  const phrases = [...byKey.values()].slice(0, MAX_KEPT_PHRASES);
  if (home === undefined || phrases.length === 0) return [];
  return [{ title: { en: home.en, fr: home.fr }, phrases }];
}
