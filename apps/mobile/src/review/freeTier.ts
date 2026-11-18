/**
 * The review sitting's deal (founder decision 2026-10-20, a follow-up to D24;
 * reversed in part by REV-003, 2026-11-18).
 *
 * Spaced review of every kept phrase, conversation phrases included, is free
 * on every plan, so the deal reads no lock and holds nothing back. Drills of a
 * whole conversation pack stay part of Core (`conversationPractice`, read by
 * the locked-route guard in `purchases/featureLocks.ts`).
 *
 * Pure, so the screen deals what this returns and the tests hold the rule.
 */

import { dueCards, type ReviewCard } from '@luvani/core';

export interface FreeTierDeal {
  /** The cards to deal, already through `dueCards` (capped, oldest first). */
  due: ReviewCard[];
}

export function dealForTier(deck: readonly ReviewCard[], now: number): FreeTierDeal {
  return { due: dueCards(deck, now) };
}

/** What Home's review card offers: the oldest due card Review would deal. */
export function reviewOffer(deck: readonly ReviewCard[], now: number): ReviewCard | null {
  return dealForTier(deck, now).due[0] ?? null;
}
