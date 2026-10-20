/**
 * The free tier's share of a review sitting (founder decision 2026-10-20, a
 * follow-up to D24).
 *
 * Spaced review of phrases that came only out of conversations is part of the
 * trial. The daily phrase, the café lesson, the free sample pack and curated
 * phrases stay reviewable for everyone, and so does any card that predates
 * source tags (core's `reviewableFree` fails open).
 *
 * Pure, so the screen deals what this returns and the tests hold the rule.
 * The lock is read once, when the sitting is dealt: a sitting never changes
 * under the learner's thumb. `unknown` standing counts as unlocked, because a
 * billing read that has not answered yet must not take practice away.
 */

import { conversationOnly, dueCards, reviewableFree, type ReviewCard } from '@luvani/core';
import type { FeatureLockState } from '../purchases/featureLocks.ts';

export interface FreeTierDeal {
  /** The cards to deal, already through `dueCards` (capped, oldest first). */
  due: ReviewCard[];
  /** Due conversation-only cards left out because the feature is locked. */
  heldBack: number;
}

export function dealForTier(deck: readonly ReviewCard[], now: number, lock: FeatureLockState): FreeTierDeal {
  if (lock !== 'locked') return { due: dueCards(deck, now), heldBack: 0 };
  return {
    due: dueCards(reviewableFree(deck), now),
    heldBack: dueCards(deck.filter(conversationOnly), now).length,
  };
}

/** The one quiet row under a locked sitting. Null when nothing was held back. */
export function heldBackLine(count: number): string | null {
  if (count <= 0) return null;
  return count === 1
    ? '1 phrase from your conversations is included with your trial.'
    : `${count} phrases from your conversations are included with your trial.`;
}

/** The text action beside it, which opens the wall at its locked door. */
export const HELD_BACK_ACTION = 'See the trial';
