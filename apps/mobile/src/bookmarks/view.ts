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
 * Where a tap has got to: nothing in flight, a write running, or one that did
 * not take.
 *
 * `refused` rather than any of the obvious words for it, because this string is
 * written into a screen and `copy/guilt.ts` bans the obvious one from anything
 * a learner could read.
 */
export type BookmarkWrite = 'idle' | 'writing' | 'refused';

/** Everything the Bookmark button needs, decided in one place. */
export interface BookmarkControl {
  /** The word on the button. */
  label: string;
  /** The same thing, as a sentence that names the situation. */
  accessibilityLabel: string;
  /** True while a write is in flight, so one tap is one write. */
  busy: boolean;
}

/**
 * The Bookmark button, in whichever of the three states it is in.
 *
 * A save is a write and a read back, which is two trips across the native
 * storage bridge, and until this existed the button said the same word for the
 * whole of it: the learner tapped, nothing moved, and they tapped again. Worse
 * was the end of it, because a write that failed left the word where it started
 * with nothing anywhere saying the shelf had not changed.
 *
 * So the failed state says the state the store is still in rather than
 * apologising, and the button stays live: the way to try again is the thing
 * they already pressed. Nobody is told they did anything wrong, because they
 * did not.
 */
export function bookmarkControl(saved: boolean, titleEn: string, write: BookmarkWrite): BookmarkControl {
  if (write === 'writing') {
    return {
      label: saved ? 'Removing' : 'Saving',
      accessibilityLabel: saved ? `Removing ${titleEn} from saved situations` : `Saving ${titleEn}`,
      busy: true,
    };
  }
  if (write === 'refused') {
    return {
      label: saved ? 'Still saved' : 'Not saved yet',
      accessibilityLabel: saved
        ? `${titleEn} is still saved. Tap to try again.`
        : `${titleEn} is not saved yet. Tap to try again.`,
      busy: false,
    };
  }
  return {
    label: bookmarkLabel(saved),
    accessibilityLabel: bookmarkAccessibilityLabel(saved, titleEn),
    busy: false,
  };
}

/**
 * The learner's current decision about one situation, out of a fold.
 *
 * Takes the fold rather than the rows because the caller draws once and asks
 * twice: Home used to hand the raw list to a function that rebuilt the whole
 * Map to answer one boolean, on every render. `bookmarkDecisions` is the fold,
 * memoised where it is read, and this is every reader of it.
 */
export function isBookmarkedIn(decisions: ReadonlyMap<string, BookmarkItem>, scenarioId: string): boolean {
  return decisions.get(scenarioId)?.saved === true;
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
  return [...bookmarkDecisions(items).values()]
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
 *
 * Exported so a screen can fold once and ask many times. It was private, and
 * the one question Home asks of it ran the whole fold again on every render.
 */
export function bookmarkDecisions(items: readonly BookmarkItem[]): Map<string, BookmarkItem> {
  const latest = new Map<string, BookmarkItem>();
  for (const item of items) {
    const held = latest.get(item.scenarioId);
    if (held === undefined || item.at >= held.at) latest.set(item.scenarioId, item);
  }
  return latest;
}
