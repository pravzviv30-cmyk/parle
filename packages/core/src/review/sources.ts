/**
 * Where a review card came from.
 *
 * Metadata only. Nothing here touches scheduling: a card's `due`, `interval`
 * and `ease` are the same whichever writer added it. What the tag is for is
 * the free tier (founder decision 2026-10-20, a follow-up to D24): spaced
 * review of phrases that came only out of conversations is part of the
 * trial, while the daily phrase, the café lesson, the free sample pack and
 * curated phrases stay reviewable for everyone.
 *
 * One phrase from two sources is one card (`phraseKeyOf`), so the tag is a
 * set: adding a phrase again from another writer unions it in. A phrase the
 * learner met in the daily practice and again in a conversation is not
 * conversation-only, and stays free.
 *
 * Fail open. A card written before this field existed carries no tag, and an
 * untagged card is reviewable for everyone. Holding back a phrase because we
 * do not know where it came from would take away practice the learner had.
 */

import type { ReviewCard } from './scheduler.ts';

export type ReviewSource = 'daily' | 'lesson' | 'sample' | 'conversation' | 'curated';

export const REVIEW_SOURCES: readonly ReviewSource[] = ['daily', 'lesson', 'sample', 'conversation', 'curated'];

function isReviewSource(value: unknown): value is ReviewSource {
  return typeof value === 'string' && (REVIEW_SOURCES as readonly string[]).includes(value);
}

/**
 * The card's sources, read defensively: junk entries are dropped, the rest
 * deduped and in one fixed order so two devices write the same bytes.
 */
export function sourcesOf(card: Pick<ReviewCard, 'sources'>): ReviewSource[] {
  const held: unknown = card.sources;
  if (!Array.isArray(held)) return [];
  return REVIEW_SOURCES.filter((source) => held.some((entry) => entry === source && isReviewSource(entry)));
}

/** The union of two source lists, in the fixed order. */
export function unionSources(a: readonly unknown[] | undefined, b: readonly unknown[] | undefined): ReviewSource[] {
  const all = [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])];
  return REVIEW_SOURCES.filter((source) => all.includes(source));
}

/** The card with this exact source list, or with no field when the list is empty. */
export function withSources(card: ReviewCard, sources: readonly ReviewSource[]): ReviewCard {
  if (sources.length > 0) return { ...card, sources: [...sources] };
  if (card.sources === undefined) return card;
  const { sources: _none, ...bare } = card;
  return bare;
}

/** True only when the card is tagged and every tag is 'conversation'. Untagged is false. */
export function conversationOnly(card: Pick<ReviewCard, 'sources'>): boolean {
  const sources = sourcesOf(card);
  return sources.length > 0 && sources.every((source) => source === 'conversation');
}

/** The cards a free learner reviews: everything that is not conversation-only. */
export function reviewableFree<T extends Pick<ReviewCard, 'sources'>>(cards: readonly T[]): T[] {
  return cards.filter((card) => !conversationOnly(card));
}
