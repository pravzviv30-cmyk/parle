/**
 * Lesson shape.
 *
 * A turn carries the material for *every* rung of the ladder simultaneously —
 * the full line, the multiple-choice options, and the English-only hint — because
 * the ladder can move up or down between any two turns and the tutor must never
 * be caught without the scaffolding it suddenly needs.
 *
 * `reference` is what the pronunciation assessor scores against. This is the
 * hard constraint from the plan: accuracy scoring needs a known target. It is
 * why beginners are the right first audience — most of their turns are scripted,
 * so the pronunciation feedback is trustworthy rather than guessed.
 */

import type { Rung } from '../ladder/ladder.ts';
import { sameWord } from '../text/distance.ts';

export type CefrLevel = 'A0' | 'A1' | 'A2';

export interface TurnOption {
  text: string;
  en: string;
  /** Several options can be acceptable — this is a conversation, not a quiz. */
  acceptable: boolean;
}

export interface LessonTurn {
  id: string;
  /** What the tutor says, in French. */
  tutor: string;
  tutorEn: string;
  /** The line we are aiming for the learner to produce. */
  target: string;
  targetEn: string;
  /** Broad IPA for the target line. Shown on request; used for drill linking. */
  targetIpa: string;
  /**
   * Text the assessor scores the learner's audio against.
   * Normally identical to `target`.
   */
  reference: string;
  /** Hard-for-anglophone phonemes this turn exercises. Drives curriculum coverage. */
  focusPhonemes: string[];
  /** Rung 2 material. */
  options: TurnOption[];
  /** Rung 3 material — English only, never contains French. */
  hint: string;
  /** Other replies that should be accepted as correct. Lowercased, unpunctuated. */
  accepts: string[];
  /** Optional aside surfaced after the turn — the depth a 50-language app skips. */
  note?: string;
}

export interface Lesson {
  id: string;
  /** French title, shown as the session name. */
  title: string;
  titleEn: string;
  cefr: CefrLevel;
  /** Scene-setting handed to the tutor LLM. */
  scenario: string;
  /** Which persona the tutor plays. */
  tutorRole: string;
  /** Rung the lesson opens on for a brand-new learner. */
  openingRung: Rung;
  /** Sounds this lesson is designed to exercise. */
  targetPhonemes: string[];
  /** Shown before the session starts. Sets expectations in one line. */
  premise: string;
  culturalNotes: string[];
  turns: LessonTurn[];
}

/** Every distinct hard phoneme a lesson actually exercises across its turns. */
export function phonemeCoverage(lesson: Lesson): string[] {
  return [...new Set(lesson.turns.flatMap((t) => t.focusPhonemes))];
}

/**
 * Normalise a spoken transcript for comparison against `accepts`.
 *
 * Accents are stripped deliberately. This layer answers "did they say the right
 * words", and transcribers are inconsistent about diacritics on learner audio.
 * Whether the vowel was actually *pronounced* correctly is a separate question,
 * answered by the pronunciation assessor against `reference` — so nothing is
 * lost by being generous here, and a learner is never told they said the wrong
 * thing because a transcriber dropped an acute accent.
 */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining accents
    .replace(/['’]/g, '') //   s'il -> sil
    .replace(/[.,!?;:«»"()\-]/g, ' ') //   excusez-moi -> excusez moi
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * How a spoken line was accepted — or how close it came.
 *
 * Recorded rather than collapsed into a boolean because the difference between
 * "said it exactly" and "said it with a hesitation in front" is worth nothing to
 * the learner, while the difference between "nearly said it" and "said something
 * else entirely" decides whether they get encouragement or a rung of support.
 */
export type AcceptanceRoute =
  /** Word for word, once case, accents and punctuation are set aside. */
  | 'exact'
  /** The line, with an "euh" in it. */
  | 'filler'
  /** The line, one edit away — a swallowed syllable or a transcriber's slip. */
  | 'typo'
  /** Every word that carries meaning is there, in some order, with the small words loose. */
  | 'content'
  /** Recognisably part of the line, but not enough of it. Not accepted; not wrong either. */
  | 'near'
  | 'none';

export interface AcceptanceMatch {
  accepted: boolean;
  via: AcceptanceRoute;
}

/**
 * Noises a learner makes while thinking, which a transcriber writes down
 * faithfully. Stripped only when the candidate line does not itself contain the
 * word — "alors" is hesitation in front of "bonjour" and vocabulary inside
 * "alors on y va".
 */
const FILLERS = new Set(['euh', 'heu', 'eh', 'ben', 'bah', 'bon', 'alors', 'donc', 'hmm', 'hm', 'mmm', 'um', 'uh', 'er', 'erm']);

/**
 * The small words French drops, swallows and liaises, and that STT loses first.
 * Never the difference between one answer and another, so they are not required
 * for a content match.
 */
const FUNCTION_WORDS = new Set(['le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de', 'd', 'et', 'a', 'au', 'aux', 'en']);

/**
 * How many words beyond the line the learner may add and still be saying it.
 *
 * Without a cap, containment accepts anything: "oui" is inside "non, oui, je ne
 * sais pas". Two is a greeting or a hesitation that survived the filter, not a
 * different sentence.
 */
const EXTRA_WORD_ALLOWANCE = 2;

/** Fraction of the line's meaning-bearing words that makes a miss a near miss. */
const NEAR_MISS_SHARE = 0.5;

function words(text: string): string[] {
  const said = normalise(text);
  return said.length === 0 ? [] : said.split(' ');
}

function contentWords(list: readonly string[]): string[] {
  const content = list.filter((w) => !FUNCTION_WORDS.has(w));
  // A line made entirely of small words ("de rien") still has to be sayable.
  return content.length > 0 ? content : [...list];
}

function withoutFillers(said: readonly string[], candidate: ReadonlySet<string>): string[] {
  return said.filter((w) => !FILLERS.has(w) || candidate.has(w));
}

/** Every line this turn will take, in matching form. */
function candidatesFor(turn: LessonTurn): string[][] {
  return [turn.target, ...turn.accepts, ...turn.options.filter((o) => o.acceptable).map((o) => o.text)].map(words);
}

/** How many of the line's meaning-bearing words the learner actually produced. */
function contentHits(said: readonly string[], candidate: readonly string[]): { hits: number; wanted: number } {
  const wanted = contentWords(candidate);
  const hits = wanted.filter((w) => said.some((s) => sameWord(s, w))).length;
  return { hits, wanted: wanted.length };
}

/**
 * Did the learner produce this turn's line?
 *
 * Four routes, tried in order, each one looser than the last. The order matters:
 * the first three are the same line by any reasonable reading, and only the
 * fourth trades strictness for generosity.
 *
 * The pressure here runs both ways. Too strict and a beginner who said the right
 * thing with an "euh" in front of it is told "Not quite" and dropped a rung —
 * which is the failure this product exists to fix, in its purest form. Too loose
 * and the pronunciation claim goes with it, because a learner who said something
 * else entirely gets told they said the line. So: hesitation, small words and one
 * slip are forgiven; a different sentence is not, and the extra-word allowance is
 * what keeps containment from accepting anything that happens to contain a word.
 */
export function matchAcceptable(turn: LessonTurn, spoken: string): AcceptanceMatch {
  const said = words(spoken);
  if (said.length === 0) return { accepted: false, via: 'none' };

  const candidates = candidatesFor(turn);
  const line = said.join(' ');

  for (const candidate of candidates) {
    if (candidate.join(' ') === line) return { accepted: true, via: 'exact' };
  }

  let best = 0;
  for (const candidate of candidates) {
    if (candidate.length === 0) continue;
    const heard = withoutFillers(said, new Set(candidate));
    const target = candidate.join(' ');

    if (heard.join(' ') === target) return { accepted: true, via: 'filler' };
    if (sameWord(heard.join(' '), target)) return { accepted: true, via: 'typo' };

    const { hits, wanted } = contentHits(heard, candidate);
    if (hits === wanted && contentWords(heard).length <= wanted + EXTRA_WORD_ALLOWANCE) {
      return { accepted: true, via: 'content' };
    }
    if (wanted > 0) best = Math.max(best, hits / wanted);
  }

  // Half the line is not the line — but it is not "je voudrais un éléphant"
  // either, and grading it the same way as one is how a learner who was almost
  // right learns to stop trying.
  return { accepted: false, via: best >= NEAR_MISS_SHARE ? 'near' : 'none' };
}

/** Did the learner produce an acceptable reply for this turn? */
export function isAcceptable(turn: LessonTurn, spoken: string): boolean {
  return matchAcceptable(turn, spoken).accepted;
}
