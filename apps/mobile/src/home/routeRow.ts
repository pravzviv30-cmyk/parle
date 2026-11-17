/**
 * Today's path row (UI-015) as a rule: what a screen reader hears for one row.
 *
 * The row is one press, so it carries one label: the title, then the line.
 * Every row ends in a chevron and names no action word (F954), so a review is
 * called by its title alone. Empty parts are dropped, never read as a pause.
 */

export interface RouteRowWords {
  title: string;
  /** The title's language when it is not English ('fr'), so it is read in that voice. */
  titleLang?: string;
  line?: string | null;
}

export interface RouteRowSaid {
  label: string;
  hint: string | undefined;
  language: string | undefined;
}

const parts = (words: readonly (string | null | undefined)[]): string[] =>
  words.map((part) => (part ?? '').trim()).filter((part) => part !== '');

/** Parts as sentences: a full stop after each part that has none of its own. */
const sentences = (said: readonly string[]): string =>
  said.map((part, i) => (i < said.length - 1 && !/[.!?]$/.test(part) ? `${part}.` : part)).join(' ');

/**
 * What a screen reader hears for one row (fix round 3). A French title is the
 * label alone, in French (`accessibilityLanguage`), so it is not read in the
 * English voice; the line follows as the hint. An English row is one label:
 * the title and the line.
 */
export function routeRowLabel({ title, titleLang, line }: RouteRowWords): RouteRowSaid {
  if (titleLang !== undefined) {
    const rest = parts([line]);
    return { label: title.trim(), hint: rest.length === 0 ? undefined : sentences(rest), language: titleLang };
  }
  return { label: parts([title, line]).join(', '), hint: undefined, language: undefined };
}
