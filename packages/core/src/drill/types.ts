/**
 * Drill exercise shapes.
 *
 * Six kinds, one ladder. The kinds are ordered by how much French the learner
 * must produce unaided: choosing among options, assembling given tokens, typing
 * from memory, saying it out loud. The ramp in `session.ts` walks a phrase up
 * that order across sittings, so a drill is never a grab-bag of formats — it is
 * the same phrase asked with a little less scaffolding each time it comes back.
 *
 * `phraseKey` ties every exercise to the review card it drills. Drills and
 * flashcards are one memory system: an exercise answered here reschedules the
 * same card the flashcard deck shows, so a phrase can never be "known" in one
 * place and "due" in the other.
 *
 * `transfer` is the other half of that record. The ramp asks for less
 * scaffolding each sitting; a transfer exercise asks for the same phrase in a
 * different situation, which is the harder and more useful thing. Marking it
 * on the exercise is what lets a correct answer count as transfer evidence
 * without anyone guessing after the fact which exercises were which.
 *
 * `noMicTwin` exists because "I can't speak right now" is a situation, not a
 * preference to be argued with. Pre-authoring the silent equivalent makes the
 * swap a data lookup mid-session instead of a generator call we may not be able
 * to afford or trust at that moment.
 */

export type DrillDifficulty = 'recognition' | 'production';

interface DrillExerciseBase {
  id: string;
  /**
   * The review card this exercise drills — same identity scheme the deck uses:
   * 'phrase:<fr lowercased>' or 'vocab:<word>'. See review/cards.ts and the
   * mobile review store.
   */
  phraseKey: string;
  /** Recognition means choosing or assembling given French; production means recalling it. */
  difficulty: DrillDifficulty;
  /**
   * This exercise asks the same phrase in a changed situation: another speaker,
   * another intent, another moment. Getting it right is the one drill outcome
   * that says the language travelled beyond where it was learned, so it feeds
   * the phrase's evidence record rather than a score.
   *
   * Absent means false. Every hand-written fixture and every bank authored
   * before the mark existed predates it, and reading those as transfer would
   * be inventing evidence.
   */
  transfer?: boolean;
}

export interface FillBlankExercise extends DrillExerciseBase {
  kind: 'fill-blank';
  /** Contains ___ where the answer goes. */
  sentence: string;
  /** Choices to tap, or null when the learner types the blank themselves. */
  options: string[] | null;
  /** Every answer we take, compared after `normalise`. */
  accepted: string[];
  /** English gloss of the whole sentence. */
  en: string;
}

export interface BestSentenceExercise extends DrillExerciseBase {
  kind: 'best-sentence';
  /** The situation, in English. */
  prompt: string;
  /** Whole French sentences to choose between, each with its gloss. */
  candidates: { fr: string; en: string }[];
  correctIndex: number;
}

export interface AppropriateReplyExercise extends DrillExerciseBase {
  kind: 'appropriate-reply';
  /** The line being replied to — a character speaks, the learner answers. */
  line: { speaker: string; fr: string; en: string };
  options: { fr: string; en: string }[];
  /** Several replies can be right — this drills conversation, not a single key. */
  acceptableIndexes: number[];
}

export interface RepeatThisExercise extends DrillExerciseBase {
  kind: 'repeat-this';
  /** The line to say aloud; the transcript is graded against it. */
  reference: string;
  referenceEn: string;
  /** Broad IPA when we know it for certain, else null. Wrong IPA is worse than none. */
  ipa: string | null;
  /** The silent stand-in for this exact phrase. See the note at the top of the file. */
  noMicTwin: DrillExercise;
}

export interface TapTranslateExercise extends DrillExerciseBase {
  kind: 'tap-translate';
  /** The English to render in French. */
  en: string;
  /** Word tiles to assemble from, distractors included. */
  tokens: string[];
  /** Accepted assembled answers, compared after `normalise`. */
  accepted: string[];
}

export interface ListenTypeExercise extends DrillExerciseBase {
  kind: 'listen-type';
  /** What is played; also what the typed answer is shown against. */
  fr: string;
  /** Accepted typed answers, compared after `normalise`. */
  accepted: string[];
}

export type DrillExercise =
  | FillBlankExercise
  | BestSentenceExercise
  | AppropriateReplyExercise
  | RepeatThisExercise
  | TapTranslateExercise
  | ListenTypeExercise;
