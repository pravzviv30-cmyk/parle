/**
 * Keyboard reach on the web (F927). A leaf module with no react-native import,
 * so the test suite can call it.
 *
 * react-native-web 0.21's press responder presses on Enter for every role, but
 * on Space only for a button. A radio, checkbox, tab or switch therefore
 * answered Enter alone. `spaceActivator` gives those roles Space, and leaves
 * Enter to the responder so a choice is never made twice.
 *
 * The focus ring is one CSS rule, drawn on keyboard focus only.
 */

/** The roles a keyboard user expects Space to choose. */
const SPACE_ROLES = new Set(['radio', 'checkbox', 'tab', 'switch']);

/** Whether this key, on this role, needs pressing here (the responder already handles the rest). */
export function keyActivates(role: string | null | undefined, key: string): boolean {
  return role != null && SPACE_ROLES.has(role) && (key === ' ' || key === 'Spacebar');
}

type KeyEventLike = { key: string; repeat?: boolean; preventDefault: () => void };

/**
 * A web `onKeyDown` that chooses on Space, or undefined for a role that needs
 * none. Space is prevented so the page does not scroll; a held key chooses once.
 */
export function spaceActivator(role: string | null | undefined, activate: () => void): ((event: KeyEventLike) => void) | undefined {
  if (role == null || !SPACE_ROLES.has(role)) return undefined;
  return (event) => {
    if (!keyActivates(role, event.key)) return;
    event.preventDefault();
    if (!event.repeat) activate();
  };
}

/** The data attribute the focus rule targets: `dataSet={focusRing}` renders `data-focusring`. */
export const FOCUS_RING_ATTRIBUTE = 'focusring';
/** Spread as `dataSet={focusRing}` on a Pressable or View. */
export const focusRing = { [FOCUS_RING_ATTRIBUTE]: 'true' } as const;

const FOCUS_RULE_ID = 'luvani-focus-ring';

/**
 * The rule. `!important` outranks react-native-web's atomic `outline` classes;
 * `:focus:not(:focus-visible)` keeps a mouse click ringless in every browser.
 */
export function focusRuleCss(ring: { width: number; offset: number; colour: string }): string {
  const selector = `[data-${FOCUS_RING_ATTRIBUTE}]`;
  return `${selector}:focus-visible { outline: ${ring.width}px solid ${ring.colour} !important; outline-offset: ${ring.offset}px !important; }\n`
    + `${selector}:focus:not(:focus-visible) { outline: none !important; }`;
}

/** Adds the rule to the page once. A no-op where there is no document. */
export function installFocusRule(ring: { width: number; offset: number; colour: string }): void {
  const doc = (globalThis as { document?: Document }).document;
  if (doc == null || doc.getElementById(FOCUS_RULE_ID) != null) return;
  const style = doc.createElement('style');
  style.id = FOCUS_RULE_ID;
  style.textContent = focusRuleCss(ring);
  doc.head.appendChild(style);
}
