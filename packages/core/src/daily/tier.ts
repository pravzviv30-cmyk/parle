/**
 * Which tier of the word pool today's learner is shown.
 *
 * The founder asked for two things at once about the word of the day: a
 * curated tier that makes somebody sound like a local, and a tier that rises
 * with the learner. Both, mixed. `words.ts` holds the three tiers; this file
 * is the one rule that says which one a learner is standing in.
 *
 * ## It reads the level standing, and does not invent a second one
 *
 * `levelFor(totalXp(activity)).index` is the app's only measure of how far a
 * learner has come, and it is deliberately fed by production alone: words
 * actually said, turns composed unaided, phrases resolved. A second standing
 * invented here, out of days opened or cards seen, would be an engagement
 * proxy wearing a pedagogy hat, and it would disagree with the ladder on the
 * one screen that shows both. So the input is the level index and nothing
 * else.
 *
 * The mapping is deliberately coarse, three tiers across six names:
 *
 * | Level index | Name              | Tier |
 * |-------------|-------------------|------|
 * | 0, 1        | Beginner, Rookie  | 1    |
 * | 2, 3        | General, Captain  | 2    |
 * | 4 and above | Master, Veteran   | 3    |
 *
 * ## What a tier is, and what it is not
 *
 * A tier is a **pitch**, not an assessment. Being shown a tier three word is
 * not a claim that the learner knows tier one, and nothing about this file is
 * evidence of anything: a card that was displayed is not a word that was
 * produced. The ladder that fed the level index is the evidence, and it was
 * earned somewhere else, out loud.
 *
 * Two consequences worth naming, because both are visible to a learner:
 *
 * - **A promotion re-phases the sequence.** The day after a level boundary is
 *   crossed the pool changes, so the run of words a learner was walking is not
 *   continued. Accepted: the alternative is storing a position, and a stored
 *   position is a second source of truth about a day.
 * - **A learner never sees the other tiers on Home.** That is the cost of
 *   pitching at all. My French and the situation card are unaffected.
 */

import type { DailyWord } from './words.ts';

export type WordTier = 1 | 2 | 3;

/**
 * The tier for a level index.
 *
 * Nonsense in gives tier one rather than an error: this is called on the path
 * that draws Home, and a learner whose stored XP is somehow unreadable should
 * meet the gentlest pool rather than a blank screen. A fraction is floored, so
 * anything between Rookie and General is still Rookie.
 */
export function wordTierFor(levelIndex: number): WordTier {
  if (!Number.isFinite(levelIndex)) return 1;
  const index = Math.floor(levelIndex);
  if (index <= 1) return 1;
  if (index <= 3) return 2;
  return 3;
}

/**
 * The words of that learner's tier, in pool order.
 *
 * A filter and nothing more: `dailyPick` still decides which of them today is,
 * on the same clock reading Home uses for the situation and the scene.
 *
 * An empty result is possible only for a pool that has no words of a tier at
 * all, which `daily.test.ts` refuses for the shipped pool. It is not softened
 * with a fallback tier on purpose. A fallback would draw a plausible card over
 * a content bug, and `dailyPick` already says out loud that an empty pool has
 * no honest card in it.
 */
export function wordsForLevel(pool: readonly DailyWord[], levelIndex: number): readonly DailyWord[] {
  const tier = wordTierFor(levelIndex);
  return pool.filter((word) => word.tier === tier);
}
