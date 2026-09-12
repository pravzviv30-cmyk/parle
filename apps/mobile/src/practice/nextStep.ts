/**
 * The Practice tab's one question: what should the learner do now?
 *
 * It used to read the authored path, because the path was what the tab drew.
 * The tab is the archive of the learner's own conversations now, so the step
 * reads that instead, and the two branches it has left are the two things this
 * screen can honestly offer: a deck the scheduler wants back, and the newest
 * conversation nobody has practised yet.
 *
 * Due cards win, and the reason has not changed: a phrase slipping away
 * matters more than new ground. Below that, the newest ready pack the learner
 * has never come back to, because the conversation that just happened is the
 * one whose French is still warm. When the deck is quiet and every pack has
 * been revisited there is no step at all, and the tab draws no headline rather
 * than inventing a cheerful message for somebody who is simply up to date.
 *
 * `dueCards` from `@luvani/core`, so the count here and the sitting the Review
 * screen opens are the same capped set. Pure and clock-injected, so PracticeTab
 * can be a layout and this can be a test.
 */

import { dueCards, type ConversationPack, type ReviewCard } from '@luvani/core';
import { orderedConversationPacks } from '../conversationPacks/model.ts';

/** The headline over the step, and the word on a review step's button. */
export const NEXT_STEP = { label: 'Your next step', review: 'Review', first: 'Start your first conversation' } as const;

/** What to do now: review a due deck, revisit a conversation, or nothing. */
export type NextStep =
  | { kind: 'review'; due: number }
  | { kind: 'pack'; pack: ConversationPack }
  /** No conversation yet: the first one is the step (F555). */
  | { kind: 'first' };

/**
 * The review step's one line.
 *
 * Counts a card, not a percentage and not a run of days: "1 card is ready",
 * "3 cards are ready". Singular at one, plural everywhere else.
 */
export function reviewLine(due: number): string {
  return due === 1 ? '1 card is ready' : `${due} cards are ready`;
}

/**
 * The line under a pack step, which says where the phrases came from.
 *
 * It names the conversation rather than counting days since it happened. How
 * long ago is already on that conversation's own card, and a second reading of
 * the same fact is how two parts of one screen start to disagree.
 */
export function packLine(pack: ConversationPack): string {
  const n = pack.keyPhrases.length;
  const phrases = n === 1 ? '1 phrase' : `${n} phrases`;
  return `${phrases} from this conversation, ready when you are`;
}

/**
 * The step, decided in exactly two branches then nothing.
 *
 * A pack qualifies when it is ready, carries phrases, and has never been
 * practised. `lastPractisedAt` is the only honest signal available for that:
 * it is a date rather than a tally, so this asks it the one question it can
 * actually answer.
 */
export function nextStep(
  deck: readonly ReviewCard[],
  packs: readonly ConversationPack[],
  now: number,
): NextStep | null {
  // Computed once and read twice: the count that decides the branch is the
  // same count the branch carries, so they can never disagree.
  const due = dueCards(deck, now).length;
  if (due > 0) return { kind: 'review', due };

  const fresh = orderedConversationPacks(packs).find(
    (pack) => pack.state === 'ready' && pack.keyPhrases.length > 0 && pack.lastPractisedAt === null,
  );
  if (fresh !== undefined) return { kind: 'pack', pack: fresh };

  // Nothing due and no pack at all: the first conversation is the step, and
  // it is the third branch of the tab's one control rather than a second pill
  // beside the review one (F555). A learner with packs that are all
  // practised, and a quiet deck, is up to date and gets no step.
  if (packs.length === 0) return { kind: 'first' };

  return null;
}
