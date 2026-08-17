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

/** Did the learner produce an acceptable reply for this turn? */
export function isAcceptable(turn: LessonTurn, spoken: string): boolean {
  const said = normalise(spoken);
  if (said.length === 0) return false;
  const candidates = [turn.target, ...turn.accepts, ...turn.options.filter((o) => o.acceptable).map((o) => o.text)];
  return candidates.some((c) => normalise(c) === said);
}
