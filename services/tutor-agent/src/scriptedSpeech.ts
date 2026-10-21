/**
 * What the scripted tutor says out loud, built from the lesson rather than
 * written by a model.
 *
 * A scripted lesson already holds every word the tutor needs: its line, the
 * line the learner is aiming for, the options and the hint. Asking a model to
 * "say this" added three to five seconds to every turn and could only ever
 * paraphrase the script, which also cost the TTS cache its exact match. So the
 * expected paths (a good or partial answer, a rescue, a skip) are spoken from
 * here, at once and from the cache. The model is kept for the turn where the
 * learner said something the script did not expect; see `tutor.ts`.
 *
 * The ladder decides how much is said, exactly as it decides what is shown:
 *
 *   rescued  the target line, said for them to repeat (the card shows the gloss);
 *            when the rescue moved the lesson on, the new turn's question first
 *   rung 1   the tutor's line, then the target to repeat
 *   rung 2   the tutor's line, then the options to choose from
 *   rung 3   the tutor's line, then the English hint
 *   rung 4   the tutor's line alone
 *
 * Nothing here comments on a pause or grades anything aloud.
 */

import type { LadderDirective, LessonTurn } from '@luvani/core';

/**
 * One part of a spoken turn, closed with terminal punctuation.
 *
 * The TTS cache keys on sentences, and a part that ran into the next one would
 * make a new sentence and a new key for a line already on disk. Closing every
 * part the same way here and in the warm list keeps the two in step.
 */
export function sayable(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return '';
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** The parts of one scripted turn, in the order they are said. */
export function scriptedSpeechParts(turn: LessonTurn, directive: LadderDirective, options: { newTurn?: boolean } = {}): string[] {
  const parts = directive.rescued
    ? options.newTurn ? [turn.tutor, turn.target] : [turn.target]
    : directive.rung === 1
      ? [turn.tutor, turn.target]
      : directive.rung === 2
        ? [turn.tutor, ...turn.options.slice(0, 3).map((option) => option.text)]
        : directive.rung === 3
          ? [turn.tutor, turn.hint]
          : [turn.tutor];
  return parts.map(sayable).filter((part) => part.length > 0);
}

/** The whole scripted turn as one utterance. */
export function scriptedSpeech(turn: LessonTurn, directive: LadderDirective, options: { newTurn?: boolean } = {}): string {
  return scriptedSpeechParts(turn, directive, options).join(' ');
}
