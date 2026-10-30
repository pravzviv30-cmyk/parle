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

/**
 * Runs both key handlers in order, so the Space handler never replaces a
 * caller's own `onKeyDown`. Either may be missing.
 */
export function composeKeyDown<E>(first: ((event: E) => void) | undefined, second: ((event: E) => void) | undefined): ((event: E) => void) | undefined {
  if (first == null) return second;
  if (second == null) return first;
  return (event) => { first(event); second(event); };
}

/**
 * What the ring draws on: every keyboard-reachable element. react-native-web
 * renders a Pressable as a div with tabindex 0 (the app's own tab bar is
 * built on Press, so it is one too), and a link with an href as an a. An
 * element focused only by script (a heading with tabIndex -1) is left alone.
 */
export const FOCUS_TARGETS = ['[tabindex]:not([tabindex="-1"])', 'a[href]', 'button'] as const;
/** Text fields draw their own focus (AccountField's border), so they never take the ring. */
export const FOCUS_EXCLUDED = ['input', 'textarea', 'select'] as const;

/** Whether the rule's selector takes this element: the same targets and exclusions, as a function. */
export function focusRingApplies(tag: string, attributes: Record<string, string>): boolean {
  if ((FOCUS_EXCLUDED as readonly string[]).includes(tag)) return false;
  if (attributes.tabindex != null) return attributes.tabindex !== '-1';
  return (tag === 'a' && attributes.href != null) || tag === 'button';
}

const FOCUS_RULE_ID = 'luvani-focus-ring';

type Ring = { width: number; offset: number; colour: string; halo: string };

/**
 * The rule. The outline is drawn `offset` clear of the control and a
 * box-shadow halo fills that gap, so the ring is two-tone. `!important`
 * outranks react-native-web's atomic classes; it also replaces a control's own
 * shadow while it holds keyboard focus, and only then.
 * `:focus:not(:focus-visible)` keeps a mouse click ringless in every browser.
 */
export function focusRuleCss(ring: Ring): string {
  const not = FOCUS_EXCLUDED.map((tag) => `:not(${tag})`).join('');
  const on = (state: string) => FOCUS_TARGETS.map((target) => `${target}${not}${state}`).join(', ');
  return `${on(':focus-visible')} { outline: ${ring.width}px solid ${ring.colour} !important; outline-offset: ${ring.offset}px !important; box-shadow: 0 0 0 ${ring.offset}px ${ring.halo} !important; }\n`
    + `${on(':focus:not(:focus-visible)')} { outline: none !important; }`;
}

/** Adds the rule to the page once. A no-op where there is no document. */
export function installFocusRule(ring: Ring): void {
  const doc = (globalThis as { document?: Document }).document;
  if (doc == null || doc.getElementById(FOCUS_RULE_ID) != null) return;
  const style = doc.createElement('style');
  style.id = FOCUS_RULE_ID;
  style.textContent = focusRuleCss(ring);
  doc.head.appendChild(style);
}
