/**
 * Every word My French says in its own voice.
 *
 * The tab used to spell its headings inside the `.tsx`, which is the one place
 * in this workspace nothing can read them: there is no renderer here, so a
 * sentence in a component is a sentence no sweep can hold to the guilt list,
 * the em dash rule or the no-digits rule. They live here instead, beside a
 * suite that walks all of them.
 *
 * `MY_FRENCH_PURPOSE` moved here from `lanes.ts` when the lanes went. It keeps
 * its SCREAMING_CASE name because `surfaceContract.test.ts` reads a tab's
 * purpose line as a literal, a template or exactly that shape, and a tab whose
 * purpose is a lowercase import reads to it as a tab with no purpose at all.
 *
 * ## What the shelf is allowed to say when it is empty
 *
 * `SHELF_EMPTY` is the one line here written for a learner who has nothing, and
 * it is written forwards. "Your first kept phrase lands here" says what the
 * shelf is for; "you have not kept any phrases yet" says the learner failed to
 * fill it, which is the shape `progress/today.ts` and `progress/evidence.ts`
 * refuse everywhere else on this tab.
 */

/**
 * The tab's title: the word on the tab bar.
 *
 * Whole-app phase 2 retired "The French that has become yours." and the
 * three-claim slogan under it from routine visits: three lines of heading a
 * learner read every time before anything of their own.
 */
export const MY_FRENCH_TITLE = 'Progress';

/** The line under it: one plain sentence about what is on the page. */
export const MY_FRENCH_PURPOSE = 'The French you have used and kept.';

/** The heading over the phrase the learner kept most recently. */
export const SHELF_LABEL = 'Your phrase shelf';

/** What the shelf says before a first phrase is theirs. */
export const SHELF_EMPTY = 'Your first kept phrase lands here.';

/** What a screen reader hears on the shelf row, because the row is a door. */
export const SHELF_OPEN = 'Open my phrases';

/** The heading over the situations the learner bookmarked to come back to. */
export const SAVED_LABEL = 'Saved for later';

/** The heading over the recent conversations, which is also the group's name. */
export const CONVERSATIONS_ROW = 'Your conversations';

/** The line on the See all row: nothing is spent, and nothing expires. */
export const CONVERSATIONS_SUB = 'Return to any of them';

/** Under the recent rows: the whole library, one quiet tap away. */
export const RECENT_ALL = 'See all your conversations';

/**
 * The heading over the learner's own material: the phrase shelf and the
 * daily collection, together, straight after the conversations (whole-app
 * phase 2). Two kinds of saved French with one heading, each its own row so
 * the difference between earned phrases and saved daily items stays visible.
 */
export const COLLECTION_LABEL = 'Your collection';

/**
 * The daily collection's row: saved authored items, not phrases from a conversation.
 *
 * The line used to end "and offline audio", which read as sound for every
 * item. Only the voiced ones carry a recording (Stage 4, 2026-09-25).
 */
export const DAILY_LABEL = 'Daily collection';
export const DAILY_LINE = 'Saved words and phrases. Tutor audio plays offline for the voiced ones.';
export const DAILY_OPEN = 'Open daily collection';

/**
 * The one door from the portfolio into every situation. The full catalogue
 * lives in Missions; this page suggests at most two.
 */
export const BROWSE_LABEL = 'Browse situations';
export const BROWSE_LINE = 'Every place to practise, in any order.';
export const BROWSE_OPEN = 'Browse every situation';

/**
 * One row per goal the learner wrote (Stage 4, 2026-09-25): the goal in their
 * words under this heading, the next task under it, and the row opens the
 * goal screen. The fit wording ("matches your goal" or a starting point) is
 * `goals/next.ts`'s, because it depends on whether the table matched.
 */
export const GOALS_ROW_LABEL = 'Your goal';
export const GOALS_ROW_OPEN = 'Open your goal';

/** The page could not read what is saved on this phone. Not the same as having nothing. */
export const MY_FRENCH_UNREAD = 'Your French could not be loaded just now.';

/** The one action on that state. */
export const MY_FRENCH_RETRY = 'Try again';

/**
 * Every line above, so one sweep can walk them all.
 *
 * A constant the suite has to be told about is a constant somebody will forget
 * to tell it about. This is the list, and the test asserts its length against
 * the exports so a tenth line cannot arrive unswept.
 */
export const MY_FRENCH_COPY = [
  MY_FRENCH_TITLE,
  MY_FRENCH_PURPOSE,
  SHELF_LABEL,
  SHELF_EMPTY,
  SHELF_OPEN,
  SAVED_LABEL,
  CONVERSATIONS_ROW,
  CONVERSATIONS_SUB,
  RECENT_ALL,
  COLLECTION_LABEL,
  DAILY_LABEL,
  DAILY_LINE,
  DAILY_OPEN,
  BROWSE_LABEL,
  BROWSE_LINE,
  BROWSE_OPEN,
  GOALS_ROW_LABEL,
  GOALS_ROW_OPEN,
  MY_FRENCH_UNREAD,
  MY_FRENCH_RETRY,
] as const;
