/**
 * The small shaping rules a sentence needs when it is built out of two halves.
 *
 * A title written for a heading starts with a capital, and the moment it is
 * dropped into the middle of a sentence that capital is wrong. Three modules
 * had already worked that out separately: the tutor's memory line, the thread
 * line, and now the joined can-do sentence on Home. Three copies of one rule is
 * how two of them come to disagree about an acronym, so the rule lives here and
 * the three read it.
 *
 * Nothing here knows about French, about the learner, or about a screen. It is
 * string shaping, and it is tested as string shaping.
 */

/**
 * The same words with a small first letter, for the middle of a sentence.
 *
 * Only the first character moves. "Order at a café" becomes "order at a café",
 * and anything already lower, empty, or starting with punctuation comes back
 * untouched rather than being guessed at.
 */
export function lowerFirst(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toLowerCase() + text.slice(1);
}
