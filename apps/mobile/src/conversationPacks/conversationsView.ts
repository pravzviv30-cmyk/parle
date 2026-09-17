/**
 * What the Conversations route says for itself — F574.
 *
 * Four lines, and every other word on that screen belongs to somebody else:
 * the counts to `practice/archive.ts`, the cards to `practice/sessionCard.ts`,
 * the detail and the delete flow to `ConversationPackLibrary.tsx`. These four
 * are the screen's own, so they live where a test can read them rather than
 * inside a `.tsx` nothing in this workspace can render.
 *
 * ## No count in the heading
 *
 * The purpose line says what to do, not how many there are. A number over a
 * list the learner is about to scroll is a number asking to be compared with
 * last month's, and the one honest count on this screen is already in the vault
 * card, in words, decided by the module that did the counting.
 *
 * ## The door says what is behind it
 *
 * The feed is for reading. The library is where a conversation is opened whole,
 * continued, or deleted, so the row that opens it names all three rather than
 * saying "more". A learner looking for the way to delete something should not
 * have to guess which euphemism we chose.
 */

/** The route's own name, set large at the top. */
export const CONVERSATIONS_TITLE = 'Your conversations';

/** One plain line under it, saying what this screen is for. */
export const CONVERSATIONS_PURPOSE = 'Return to any of them.';

/** Over the door into the library. */
export const LIBRARY_LABEL = 'Your saved conversations';

/** What is behind that door, named rather than implied. */
export const LIBRARY_LINE = 'Open one for its phrases, continue talking, or delete it.';

/** What a screen reader hears on the door, which is both lines as one sentence. */
export function libraryDoorLabel(): string {
  return `${LIBRARY_LABEL}. ${LIBRARY_LINE}`;
}
