/**
 * The words that buy a learner a second to think, without breaking the rhythm.
 *
 * A beginner's French stops being a series of answers and starts being a
 * conversation at the point where they can join two thoughts, hedge one, or
 * take a moment without going silent. Native speakers hear that before they
 * hear grammar. These are the words that do it.
 *
 * ## A curated list, not a new field
 *
 * Every one of these is already an authored `DailyWord` with its own note and
 * example: nothing new is written here and nothing is duplicated. What was
 * missing was a way to ask "which of the two hundred and eighty-four are the
 * ones that carry cadence", and `DailyWord` has no kind to ask it with. Adding
 * one would mean deciding a kind for every other word in the pool, most of
 * which have no obvious answer. A curated list of ids is the smaller shape, and
 * it fails loudly if an id is ever retired.
 *
 * Ordered as a learner would meet them: the two that start half of all spoken
 * French sentences first, then the hedges, then the ones that mark a summary.
 */

import { DAILY_WORDS, type DailyWord } from './words.ts';

/** The connector ids, in the order a learner meets them. */
export const CONNECTOR_IDS: readonly string[] = [
  'word:du-coup',
  'word:en-fait',
  'word:tu-vois',
  'word:quand-meme',
  'word:franchement',
  'word:au-fait',
  'word:en-gros',
  'word:de-toute-facon',
  'word:bref',
  'word:ca-marche',
];

/**
 * The authored connectors, in order.
 *
 * Throws on an id the pool no longer carries, rather than quietly returning a
 * shorter list. A connector that silently disappeared would leave a section
 * with a hole in it and nothing to say why.
 */
export function connectorWords(): readonly DailyWord[] {
  return CONNECTOR_IDS.map((id) => {
    const word = DAILY_WORDS.find((entry) => entry.id === id);
    if (!word) throw new Error(`connector ${id} is no longer in DAILY_WORDS`);
    return word;
  });
}
