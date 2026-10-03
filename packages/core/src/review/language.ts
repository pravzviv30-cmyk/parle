import type { ReviewCard } from './scheduler.ts';

/** Storage faces are review prompts, not language labels: turn cards invert vocab. */
export function reviewPhraseFor(card: Pick<ReviewCard, 'kind' | 'front' | 'back'>): { fr: string; en: string } | null {
  if (card.kind !== 'vocab' && card.kind !== 'turn') return null;
  if (typeof card.front !== 'string' || typeof card.back !== 'string') return null;
  const fr = (card.kind === 'turn' ? card.back : card.front).trim();
  const en = (card.kind === 'turn' ? card.front : card.back).trim();
  return fr && en ? { fr, en } : null;
}
