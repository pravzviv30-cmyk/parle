/**
 * Today's path row (UI-015) as a rule: what a screen reader hears for one row.
 *
 * The row is one press, so it carries one label: the title, then the line,
 * then what the press does. An action can name itself more fully than its
 * visible word ("Say it" can be "Say On se tutoie ?"); a row with no action
 * is its words alone. Empty parts are dropped, never read as a pause.
 */

export interface RouteRowWords {
  eyebrow?: string | null;
  title: string;
  /** The title's language when it is not English ('fr'), so it is read in that voice. */
  titleLang?: string;
  line?: string | null;
  action?: { label: string; accessibilityLabel?: string } | null;
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
 * English voice; the eyebrow, the line and the action follow as the hint. An
 * English row is one label: the eyebrow, the title, the line and the action.
 */
export function routeRowLabel({ eyebrow, title, titleLang, line, action }: RouteRowWords): RouteRowSaid {
  const said = action == null ? null : (action.accessibilityLabel ?? action.label);
  if (titleLang !== undefined) {
    const rest = parts([eyebrow, line, said]);
    return { label: title.trim(), hint: rest.length === 0 ? undefined : sentences(rest), language: titleLang };
  }
  return { label: parts([eyebrow, title, line, said]).join(', '), hint: undefined, language: undefined };
}
