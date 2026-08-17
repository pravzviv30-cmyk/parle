/**
 * Turning a finished session into review cards.
 *
 * The rule for every card here: quote the learner back to themselves. Issen's
 * most-loved feature is flashcards made from words you actually said, shown in
 * the sentence you said them in. A deck of dictionary entries is homework; a
 * deck of your own sentences is a diary you can pronounce.
 *
 * Three kinds of card come out of a session:
 *
 *   vocab   — each distinct word said correctly, backed by the phrase it lives in
 *   phoneme — the single pronunciation focus, when the session produced one
 *   turn    — lines the learner needed a rescue or retry on (the mistakes queue)
 *
 * Nothing here is generated text. Fronts and backs are lifted verbatim from
 * lesson content and the phoneme inventory, which is already copy-tested, so a
 * card can never scold and never surprise.
 */

import type { Lesson } from '../lessons/types.ts';
import { buildEntries } from '../progress/export.ts';
import type { SessionSummary } from '../session/session.ts';
import { newCard, type ReviewCard } from './scheduler.ts';

/**
 * Build the cards a session has earned.
 *
 * Pure and forgiving: a word we cannot source a phrase for, or a turn id that
 * no longer exists in the lesson, is silently dropped rather than guessed at.
 * A card with fabricated context would break the one promise this deck makes.
 */
export function buildCardsFromSummary(summary: SessionSummary, lessons: readonly Lesson[], now: number): ReviewCard[] {
  const cards: ReviewCard[] = [];

  // Vocab: one card per word they said correctly, in the sentence they said.
  // An empty gloss means we do not know where the word came from; skipping it
  // beats showing a card with a blank back.
  for (const entry of buildEntries(summary.wordsProduced, lessons)) {
    if (!entry.gloss) continue;
    cards.push(
      newCard(
        {
          id: `vocab:${entry.word}`,
          kind: 'vocab',
          front: entry.word,
          back: entry.gloss,
          context: entry.gloss,
          ipa: entry.ipa,
        },
        now,
      ),
    );
  }

  // Phoneme: at most one, mirroring the end-of-session report. The report
  // already refuses to name more than one problem; the deck must not either.
  const focus = summary.pronunciation.focus;
  if (focus) {
    const { phoneme } = focus;
    cards.push(
      newCard(
        {
          id: `phoneme:${phoneme.ipa}`,
          kind: 'phoneme',
          front: `/${phoneme.ipa}/`,
          back: phoneme.trick ? `${phoneme.cue} ${phoneme.trick}` : phoneme.cue,
          // The word where it went worst — the concrete example we can quote.
          context: focus.stat.worstWord,
          ipa: phoneme.ipa,
        },
        now,
      ),
    );
  }

  // Turns: the mistakes queue. Every line that needed a rescue or a retry comes
  // back as "say it in French" — the same quiet re-ask a human tutor does the
  // next day, instead of a red X in the moment.
  const lesson = lessons.find((l) => l.id === summary.lessonId);
  if (lesson) {
    for (const turnId of summary.struggledTurnIds) {
      const turn = lesson.turns.find((t) => t.id === turnId);
      if (!turn) continue;
      cards.push(
        newCard(
          {
            id: `turn:${lesson.id}:${turn.id}`,
            kind: 'turn',
            front: turn.targetEn,
            back: turn.target,
            // The tutor line they were answering — the situation, not a definition.
            context: `${turn.tutor} = ${turn.tutorEn}`,
            ipa: turn.targetIpa ?? '',
          },
          now,
        ),
      );
    }
  }

  return cards;
}
