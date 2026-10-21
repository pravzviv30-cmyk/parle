import { phraseKeyOf, type ConversationPack, type ReviewCard } from '@luvani/core';
/**
 * An exact saved fragment, never a regenerated transcript or a new judgement.
 * `title` is the conversation the phrase came out of, as its pack names it in
 * French: the card's "From {conversation}" (2026-10-21 UI-008, artboard B-Review).
 */
export function conversationContext(card: ReviewCard, packs: readonly ConversationPack[]): {quote:string;label:string;title:string}|null {
  if (card.kind !== 'turn' && card.kind !== 'vocab') return null;
  const french = card.kind === 'turn' ? card.back : card.front;
  const key = phraseKeyOf(french);
  for (const pack of [...packs].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))) {
    const fragment = pack.corrections.find(row => phraseKeyOf(row.better) === key && row.quote.trim() !== '' && phraseKeyOf(row.quote) !== key);
    if (fragment) return {quote:fragment.quote,label:pack.id === 'sample-cafe-morning' ? 'Earlier line in the sample conversation' : 'Your earlier line',title:pack.title.fr};
  }
  return null;
}

/** The card's provenance line, or null when no conversation is known. */
export function fromLine(context: { title: string } | null | undefined): string | null {
  const title = context?.title.trim() ?? '';
  return title === '' ? null : `From ${title}`;
}
