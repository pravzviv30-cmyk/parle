/**
 * What "a saved phrase" is, in one place (F918): a deck card that is not a
 * sound, has words on its front, and is counted once per phrase key however
 * many cards carry it. Practice's "8 saved" and Journey's "8 phrases saved"
 * both count with this, so the two can never disagree.
 */
import { phraseKeyOf, type ReviewCard } from '@luvani/core';

/** One card per saved phrase, the first the deck holds for each key. */
export function savedPhraseCards(deck: readonly ReviewCard[]): ReviewCard[] {
  const seen = new Set<string>();
  const out: ReviewCard[] = [];
  for (const card of deck) {
    if (card.kind === 'phoneme' || card.front.trim() === '') continue;
    const key = phraseKeyOf(card.front);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(card);
  }
  return out;
}

export function savedPhraseCount(deck: readonly ReviewCard[]): number {
  return savedPhraseCards(deck).length;
}
