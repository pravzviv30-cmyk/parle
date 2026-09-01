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
 *
 * Two things the editor refuses, both in code and neither in the prompt. An
 * **extension** is the one item in a batch the session never produced, so it
 * passes `extensionViolations` before it can become a card — the drills built
 * from the same keep-list already pass core's linter, and the model-authored
 * phrase was the only string in the path with nothing between it and the deck.
 * And a phrase the evidence record already calls used spends no keep slot:
 * `knownPhrases` arrives on the input, the request lists it as evidence, and
 * `applyCuration` skips it whatever the model proposed.
 *
 * The five-phrase cap here is also the app's recovery cap. `MAX_RECOVERED_PHRASES`
 * in apps/mobile/src/live/journalRules.ts is deliberately the same number, so a
 * session rescued from a crash cannot deliver the card flood this file exists to
 * prevent. There is no shared constant on purpose: reaching it would pull zod
 * and this module's whole schema into the phone's bundle for one integer.
 */

import { z } from 'zod/v4';

import type { NewPhrase } from '../contract/types.ts';
import { NewPhraseZ } from '../contract/schemas.ts';
import { copyViolations } from '../copy.ts';
import { carriesFrench } from '../frenchLeak.ts';

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
      /** Closely related language that creates a small transfer challenge. */
      extensions: z.array(NewPhraseZ),
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
  learner: { cefr: string; errorTags: readonly string[] };
  /**
   * French lines the evidence record already calls `used` or better.
   *
   * A keep slot spent on one of these re-teaches something the learner has
   * already produced unprompted, which is the one thing curation has fewest of
   * and the learner needs least. Supplied by the caller because only the agent
   * side can read the evidence record; enforced by `applyCuration`, which drops
   * them whatever the model proposes. Absent means "nobody told us", and
   * curation behaves exactly as it did before this field existed.
   */
  knownPhrases?: readonly string[];
}

/** Never more phrases than a learner would genuinely revisit tomorrow. */
export const MAX_KEPT_PHRASES = 5;
/** Enough novelty to create transfer, never enough to bury today's learning. */
export const MAX_EXTENSION_PHRASES = 2;
/** Never more topic cards than a twelve-turn conversation can honestly earn. */
export const MAX_CURATED_TOPICS = 3;

const INSTRUCTION = [
  `The session below has ended. Build tomorrow's practice from what happened, then add a very small amount of useful transfer.`,
  ``,
  `Rules:`,
  `- Keep at most five phrases, the ones this learner would genuinely reach for again. Prefer what they struggled toward or asked for over pleasantries and filler.`,
  `- Group the kept phrases under the topics you actually talked about, listed below. Use those names verbatim when they fit; write a better short name only when none fits.`,
  `- titleEn and titleFr are short noun phrases naming the topic. phraseFr lists each kept phrase EXACTLY as written in the phrase list below, best first.`,
  `- Across the whole response, add at most two extensions: natural phrases closely related to a discussed topic that did not appear verbatim. Keep them one small step beyond the learner's level and useful in a variation of the same situation.`,
  `- Each extension uses real spoken French, a natural English meaning, an honest register, and a short usage note only when needed. It must not duplicate a listed phrase.`,
  `- If the session recorded no keepable phrase, an extension-only topic is allowed. The learner still gets practice grounded in what they discussed.`,
  `- At most three topics. A topic with nothing worth keeping is left out entirely.`,
].join('\n');

export function buildCurationRequest(input: CurationInput): string {
  const errors = input.learner.errorTags.length > 0 ? ` Recurring trouble: ${input.learner.errorTags.join(', ')}.` : '';
  const lines: string[] = [
    INSTRUCTION,
    ``,
    `LEARNER: ${input.learner.cefr}.${errors}`,
    ``,
    `TOPICS TALKED ABOUT, IN ORDER`,
  ];
  for (const topic of input.topics) lines.push(`- ${topic.en} (${topic.fr})`);
  lines.push(``, `PHRASES THE SESSION RECORDED`);
  for (const phrase of input.phrases) lines.push(`- "${phrase.fr}" = ${phrase.en} [${phrase.register}]`);
  // Evidence, not a rule. The list says what this learner already reaches for
  // unprompted, and nothing in INSTRUCTION tells the model what to do about it,
  // because a keep slot spent here is refused by `applyCuration` whatever the
  // model decides. The model simply stops being asked blind.
  const known = (input.knownPhrases ?? []).map((fr) => fr.trim()).filter((fr) => fr !== '');
  if (known.length > 0) {
    lines.push(``, `PHRASES THIS LEARNER ALREADY USES`);
    for (const fr of known) lines.push(`- "${fr}"`);
  }
  return lines.join('\n');
}

/**
 * The gate an authored extension passes before it can become a review card.
 *
 * An extension is the one item in the batch the session never produced and the
 * learner never heard: everything else was matched back to a line the recap
 * recorded, while this is language the model wrote just now. Drills from the
 * same keep-list already pass `validateExercise`, so the phrase that goes
 * straight onto a card was the only model-authored string in the whole
 * post-session path with nothing between it and the deck.
 *
 * Both checkers are the ones already in this package rather than a third
 * opinion: `copyViolations` for house style, `carriesFrench` for an English
 * gloss that is quietly French. Empty means clean, and the reasons are returned
 * rather than logged so a rejection is a debuggable artefact — the same shape
 * core's drill linter returns.
 *
 * Digits are allowed in the French and refused in the English, which is
 * copy.ts's own carve-out: "Ça fait 2 euros" is speech, "level 2 phrasing" is a
 * score. The known limit that comes with it is `carriesFrench`: it reads
 * accents, so an English gloss carrying an unaccented French word gets through,
 * and a proper name with an accent in it does not. A tripwire, not a proof.
 */
export function extensionViolations(extension: NewPhrase): string[] {
  const reasons: string[] = [];
  const fr = extension.fr.trim();
  const en = extension.en.trim();
  if (fr === '') reasons.push('fr is empty');
  if (en === '') reasons.push('en is empty');

  for (const [label, text] of [['fr', fr], ['frWritten', extension.frWritten ?? '']] as const) {
    if (text === '') continue;
    for (const rule of copyViolations(text, { allowDigits: true })) reasons.push(`${label} breaks the ${rule} copy rule`);
  }
  for (const [label, text] of [['en', en], ['enLiteral', extension.enLiteral ?? ''], ['note', extension.note ?? '']] as const) {
    if (text === '') continue;
    for (const rule of copyViolations(text)) reasons.push(`${label} breaks the ${rule} copy rule`);
    if (carriesFrench(text)) reasons.push(`${label} looks French, not English: "${text}"`);
  }
  return reasons;
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
 *
 * `knownPhrases` is what the evidence record already calls used, and it is
 * spent nowhere: a proposal naming one is skipped WITHOUT consuming a keep
 * slot, so the next phrase down gets it and the learner still gets five. The
 * prompt is shown the same list, but nothing here depends on the model having
 * read it — this is the code deciding, not a rule the model was asked to keep.
 */
export function applyCuration(
  raw: Curation | null,
  sessionPhrases: readonly NewPhrase[],
  sessionTopics: readonly { en: string; fr: string }[],
  knownPhrases: readonly string[] = [],
): CuratedTopic[] {
  const byKey = new Map<string, NewPhrase>();
  for (const phrase of sessionPhrases) {
    const key = keyOf(phrase.fr);
    if (key.length > 0 && !byKey.has(key)) byKey.set(key, phrase);
  }
  const known = new Set(knownPhrases.map(keyOf).filter((key) => key.length > 0));

  const topics: CuratedTopic[] = [];
  const claimed = new Set<string>();
  let kept = 0;
  let extended = 0;
  let checked = 0;
  let rejected = 0;

  if (raw !== null) {
    for (const proposal of raw.topics) {
      if (topics.length >= MAX_CURATED_TOPICS) break;
      const titleEn = proposal.titleEn.trim();
      const titleFr = proposal.titleFr.trim();
      if (titleEn.length === 0) continue;

      const phrases: NewPhrase[] = [];
      for (const fr of proposal.phraseFr) {
        if (kept >= MAX_KEPT_PHRASES) break;
        const key = keyOf(fr);
        const match = byKey.get(key);
        // A phrase the learner already uses costs no slot on its way out: the
        // `continue` is before `kept` climbs, so the next proposal takes it.
        if (match === undefined || claimed.has(key) || known.has(key)) continue;
        claimed.add(key);
        phrases.push(match);
        kept += 1;
      }
      for (const extension of proposal.extensions) {
        if (extended >= MAX_EXTENSION_PHRASES) break;
        const fr = extension.fr.trim();
        const en = extension.en.trim();
        const key = keyOf(fr);
        if (fr.length === 0 || en.length === 0 || claimed.has(key) || byKey.has(key) || known.has(key)) continue;
        // The content check, and the only place a model-authored phrase is told
        // no. Counted rather than silently dropped, the way the drill linter's
        // rejections are counted at the call site that runs it.
        checked += 1;
        const reasons = extensionViolations(extension);
        if (reasons.length > 0) {
          rejected += 1;
          console.warn(`[luvani] curation rejected the extension "${fr}": ${reasons.join('; ')}`);
          continue;
        }
        claimed.add(key);
        phrases.push({ ...extension, fr, en });
        extended += 1;
      }
      // A topic with nothing worth keeping is not a card.
      if (phrases.length > 0) topics.push({ title: { en: titleEn, fr: titleFr.length > 0 ? titleFr : titleEn }, phrases });
    }
  }

  if (rejected > 0) console.warn(`[luvani] curation rejected ${rejected} of ${checked} extensions`);
  if (topics.length > 0) return topics;

  // The fallback: the scene's own topic, the first few phrases as met, minus
  // anything the learner already uses — the fallback spends its slots on the
  // same terms the model's proposal does.
  const home = sessionTopics[0];
  const phrases = [...byKey.entries()].filter(([key]) => !known.has(key)).map(([, phrase]) => phrase).slice(0, MAX_KEPT_PHRASES);
  if (home === undefined || phrases.length === 0) return [];
  return [{ title: { en: home.en, fr: home.fr }, phrases }];
}
