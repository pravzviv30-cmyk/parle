/**
 * Today's mix — whether a sitting across topics is worth offering, and the
 * lanes the round robin runs over.
 *
 * `buildDrillSession` already decides who plays and core's `mixQueue` already
 * decides the order. Neither of them knows what a topic is, and neither should.
 * What is left is one app-side question: is a mixed sitting different enough
 * from the sitting the learner could already open?
 *
 * It is different exactly when the due phrases come from two or more topics.
 * Below that the round robin has one lane, so the mix would replay a single
 * topic's own drills under a grander name, and a card that promises variety and
 * delivers repetition is a card that teaches the learner to ignore cards.
 *
 * Pure and clock-injected, so PracticeTab can be a layout and this can be a
 * test. Same reason as practice/statusLine.ts.
 */

import { dueCards, type PracticeTopic, type ReviewCard } from '@luvani/core';

export const MIX_OFFER = {
  title: "Today's mix",
  sub: 'A little of everything you have learned.',
};

/** How many topics have to be due before the mix is more than a rename. */
const TOPICS_FOR_A_MIX = 2;

/**
 * The lanes, in the order the learner's own story wrote them.
 *
 * A topic with no phrases yet is left out rather than passed in empty: the
 * round robin would skip it on every pass, and a lane that is never anything
 * but empty is noise in the input to a deterministic function.
 */
export function topicGroups(topics: readonly PracticeTopic[]): readonly (readonly string[])[] {
  return topics.filter((topic) => topic.phraseKeys.length > 0).map((topic) => topic.phraseKeys);
}

/**
 * Whether to show the card at all.
 *
 * Measured against `dueCards` rather than the whole deck, and against the same
 * cap, because that is precisely the set the sitting will be built from. A deck
 * with fifty due cards from one topic still opens as one topic.
 */
export function offersMix(deck: readonly ReviewCard[], topics: readonly PracticeTopic[], now: number): boolean {
  const groups = topicGroups(topics);
  if (groups.length < TOPICS_FOR_A_MIX) return false;

  const spanned = new Set<number>();
  for (const card of dueCards(deck, now)) {
    // First lane wins, the way mixQueue assigns it, so a phrase that came up in
    // two conversations counts once and cannot fake a span on its own.
    const home = groups.findIndex((keys) => keys.includes(card.id));
    if (home !== -1) spanned.add(home);
    if (spanned.size >= TOPICS_FOR_A_MIX) return true;
  }
  return false;
}

/** What the sitting calls itself once it is open. */
export function sittingTitle(opts?: { mix?: boolean }): string {
  return opts?.mix === true ? MIX_OFFER.title : 'Drills';
}

/**
 * What a learner reads when the sitting could not be read off the disk.
 *
 * It says the true thing, which is that nothing they have done is affected, and
 * it gives them the same door the empty sitting gives them. No error code, no
 * apology, nothing suggesting they did something.
 */
export const DRILL_UNREAD = {
  title: 'This sitting did not open.',
  body: 'Nothing you have practised is affected. Try again in a moment, or come back to it later.',
} as const;
