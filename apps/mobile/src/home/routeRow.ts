/**
 * Today's path row (UI-015) as a rule: what a screen reader hears for one row.
 *
 * The row is one press, so it carries one label: the title, then the line,
 * then what the press does. An action can name itself more fully than its
 * visible word ("Say it" can be "Say On se tutoie ?"); a row with no action
 * is its words alone. Empty parts are dropped, never read as a pause.
 */

export interface RouteRowWords {
  title: string;
  line?: string | null;
  action?: { label: string; accessibilityLabel?: string } | null;
}

export function routeRowLabel({ title, line, action }: RouteRowWords): string {
  const said = action == null ? null : (action.accessibilityLabel ?? action.label);
  return [title, line, said]
    .map((part) => (part ?? '').trim())
    .filter((part) => part !== '')
    .join(', ');
}
