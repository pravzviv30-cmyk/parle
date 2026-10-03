import { phraseKeyOf, type ConversationPack, type ReviewCard } from '@luvani/core';
/** An exact saved fragment, never a regenerated transcript or a new judgement. */
export function conversationContext(card: ReviewCard, packs: readonly ConversationPack[]): {quote:string;label:string}|null {
  if (card.kind !== 'turn' && card.kind !== 'vocab') return null;
  const french = card.kind === 'turn' ? card.back : card.front;
  const key = phraseKeyOf(french);
  for (const pack of [...packs].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))) {
    const fragment = pack.corrections.find(row => phraseKeyOf(row.better) === key && row.quote.trim() !== '' && phraseKeyOf(row.quote) !== key);
    if (fragment) return {quote:fragment.quote,label:pack.id === 'sample-cafe-morning' ? 'Earlier line in the sample conversation' : 'Your earlier line'};
  }
  return null;
}
