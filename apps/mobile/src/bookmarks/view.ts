/**
 * What a saved situation is called, and which ones there are.
 *
 * Home's daily situation card carries a Bookmark button, and what it saves has
 * to arrive somewhere a learner can find it again. That somewhere is My French,
 * beside the notebook and the situations they have already walked into, because
 * a thing you saved to come back to belongs with the other things you came back
 * to.
 *
 * The store keeps decisions, not a list. Every tap is a row carrying the state
 * the learner chose and the moment they chose it, which is what lets an un-save
 * survive a sync fold. Reading that back into "the situations they have saved"
 * is a fold, and it is this file, for the reason docs/TESTING.md gives:
 * apps/mobile has no renderer, so a rule inside a `.tsx` is a rule nothing can
 * ask a question about. Same arrangement as `progress/portfolio.ts`.
 *
 * ## An id the pool no longer carries is dropped, silently
 *
 * The pool is authored content and content gets retired. A phone that saved
 * `situation:cafe-terrace` two releases ago may open a build where that id is
 * gone, and the honest failure there is for the row to be absent, not for the
 * card to draw a blank line or for the screen to throw. The learner loses one
 * row they cannot see and cannot fix; anything else loses them the screen.
 *
 * ## Nothing at zero
 *
 * `hasSaved` exists so My French can draw the card only when there is one, and
 * draw nothing at all otherwise. Not an empty state, not a hint, not a nudge to
 * go and save something. That is `progress/evidence.ts`'s rule and the reason
 * behind it holds here: a learner who has saved nothing has not failed at
 * anything, and a panel telling them the shelf is empty says they have.
 */

import type { DailyScenario } from '@luvani/core';
import type { BookmarkItem } from './store.ts';

/** My French's heading over the saved list. */
export const SAVED_SITUATIONS_LABEL = 'Saved situations';

/** The verb on a saved row, which opens the situation as a conversation. */
export const SAVED_SITUATION_ACTION = 'Start';

/**
 * The Bookmark button's word.
 *
 * It says the state, not the command, once something is saved: a learner who
 * has just tapped it wants to know it worked more than they want to be told
 * how to undo it, and the filled mark beside the word carries the rest.
 */
export function bookmarkLabel(saved: boolean): string {
  return saved ? 'Saved' : 'Bookmark';
}

/** "Save <situation>" / "Remove <situation> from saved", for a screen reader. */
export function bookmarkAccessibilityLabel(saved: boolean, titleEn: string): string {
  return saved ? `Remove ${titleEn} from saved situations` : `Save ${titleEn}`;
}

/**
 * The learner's current decision about one situation.
 *
 * Latest decision wins, and a tie on the instant falls to the later row, which
 * is the order the store already writes in.
 */
export function isBookmarked(items: readonly BookmarkItem[], scenarioId: string): boolean {
  return latestFor(items).get(scenarioId)?.saved === true;
}

/**
 * The saved situations, newest decision first.
 *
 * Newest first because the last thing a learner saved is the thing they were
 * most recently thinking about, and it is the row they will look for.
 */
export function savedSituations(
  items: readonly BookmarkItem[],
  pool: readonly DailyScenario[],
): readonly DailyScenario[] {
  const known = new Map(pool.map((s) => [s.id, s]));
  return [...latestFor(items).values()]
    .filter((item) => item.saved)
    .sort((a, b) => b.at - a.at)
    .map((item) => known.get(item.scenarioId))
    .filter((s): s is DailyScenario => s !== undefined);
}

/** Whether My French should draw the saved list at all. */
export function hasSaved(saved: readonly DailyScenario[]): boolean {
  return saved.length > 0;
}

/**
 * One decision per situation: the latest the learner made.
 *
 * A plain fold rather than a sort, so two rows claiming the same instant settle
 * on the one written later, which is the store's own order and the only tie
 * break available without inventing evidence.
 */
function latestFor(items: readonly BookmarkItem[]): Map<string, BookmarkItem> {
  const latest = new Map<string, BookmarkItem>();
  for (const item of items) {
    const held = latest.get(item.scenarioId);
    if (held === undefined || item.at >= held.at) latest.set(item.scenarioId, item);
  }
  return latest;
}
