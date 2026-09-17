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

/** The tab's headline: what this page is a record of. */
export const MY_FRENCH_TITLE = 'The French that has become yours.';

/** The line under it. Three claims, and the page has to earn all three. */
export const MY_FRENCH_PURPOSE = 'Real conversations. Real situations. Real independence.';

/** The heading over the phrase the learner kept most recently. */
export const SHELF_LABEL = 'Your phrase shelf';

/** What the shelf says before a first phrase is theirs. */
export const SHELF_EMPTY = 'Your first kept phrase lands here.';

/** What a screen reader hears on the shelf row, because the row is a door. */
export const SHELF_OPEN = 'Open my phrases';

/** The heading over the situations the learner bookmarked to come back to. */
export const SAVED_LABEL = 'Saved for later';

/** The row into the conversations the tutor turned into practice. */
export const CONVERSATIONS_ROW = 'Your conversations';

/** The line under it: nothing is spent, and nothing expires. */
export const CONVERSATIONS_SUB = 'Return to any of them';

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
] as const;
