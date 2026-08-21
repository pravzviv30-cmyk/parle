/**
 * Does this key press mean send?
 *
 * The founder typed a topic, pressed Enter, and watched the text sit there.
 * Tapping Send worked instantly. `onSubmitEditing`, `returnKeyType="send"` and
 * `submitBehavior="submit"` were all already wired, which is what made it worth
 * reading the platform rather than the props.
 *
 * What react-native-web 0.21.2 actually does, read out of
 * `node_modules/react-native-web/dist/exports/TextInput/index.js`:
 *
 *   - It has never heard of `submitBehavior`. The prop list it destructures
 *     (`:80-133`) knows only the deprecated `blurOnSubmit`, and `pickProps`
 *     is a whitelist, so `submitBehavior` is dropped before the DOM sees it.
 *     On web that prop is inert: it neither submits nor keeps the caret.
 *   - Enter is handled in `handleKeyDown` (`:270-293`), attached as the input's
 *     `onKeyDown`. For a single-line input it calls `onSubmitEditing` and then,
 *     because `blurOnSubmit == null` defaults to `!multiline`, schedules a
 *     `blur()` on the field. So even the happy path takes the caret away, which
 *     is the opposite of what `submitBehavior="submit"` asked for.
 *   - The whole block is skipped when `e.isDefaultPrevented()`, when the event
 *     is an IME composition, or when Shift is held.
 *
 * So the fix is a handler of our own rather than a prop. RNW calls `onKeyPress`
 * from inside that same `handleKeyDown`, BEFORE its Enter branch. Sending from
 * there and calling `preventDefault()` means the branch stands down: no double
 * send if it was firing all along, and no blur either, which is `submit`
 * semantics delivered on the platform that does not know the word.
 *
 * On iOS and Android the native props already work, so this must answer no
 * there or every Enter would send twice.
 */

/**
 * The parts of a key press this rule reads.
 *
 * Deliberately structural rather than a React or React Native event type: this
 * module is tested under plain node, and the two platforms hand the same
 * handler two different objects. Web passes a synthetic keyboard event with
 * `key`, `shiftKey` and a live `nativeEvent`; native passes only
 * `{ nativeEvent: { key } }`.
 */
export interface KeyPressLike {
  key?: string | undefined;
  shiftKey?: boolean | undefined;
  /** True while an input method is mid-composition. Web only. */
  isComposing?: boolean | undefined;
  /** The IME sentinel. Some browsers report only this. */
  keyCode?: number | undefined;
}

/** What a browser reports for a key press an input method still owns. */
const IME_KEY_CODE = 229;

/**
 * Read a key press off whichever object the platform handed the component.
 *
 * Web puts `key` and `shiftKey` on the synthetic event and the composition
 * flags on the DOM event underneath it. Native puts a bare `{ key }` on
 * `nativeEvent` and nothing else. Reading that difference is a decision, so it
 * lives here with the rule it feeds rather than in the screen, where nothing
 * could check it.
 */
export function keyPressFrom(event: unknown): KeyPressLike {
  if (typeof event !== 'object' || event === null) return {};
  const top = event as { key?: unknown; shiftKey?: unknown; nativeEvent?: unknown };
  const native =
    typeof top.nativeEvent === 'object' && top.nativeEvent !== null
      ? (top.nativeEvent as { key?: unknown; isComposing?: unknown; keyCode?: unknown })
      : {};
  return {
    key: typeof top.key === 'string' ? top.key : typeof native.key === 'string' ? native.key : undefined,
    shiftKey: top.shiftKey === true,
    isComposing: native.isComposing === true,
    keyCode: typeof native.keyCode === 'number' ? native.keyCode : undefined,
  };
}

/**
 * `platform` is `Platform.OS`. It is a parameter rather than an import for the
 * same reason `now` is one elsewhere in this repo: a rule that reaches for the
 * world cannot be asked a question about a world it is not in.
 */
export function enterSubmits(platform: string, event: KeyPressLike, draft: string): boolean {
  // Native already sends on return. A second path there sends twice, and the
  // learner watches their topic arrive as two turns.
  if (platform !== 'web') return false;

  if (event.key !== 'Enter') return false;

  // Shift plus Enter is somebody reaching for a new line. Nothing on this
  // screen has a second line yet, so the honest answer is to do nothing rather
  // than to send something they were still writing.
  if (event.shiftKey === true) return false;

  // An input method is mid-word. Enter here confirms an accented character;
  // treating it as send is how "café" turns into a sent message reading "caf".
  if (event.isComposing === true || event.keyCode === IME_KEY_CODE) return false;

  // An empty box has nothing to send, and swallowing the key press for it
  // would be taking something away for no reason.
  return draft.trim().length > 0;
}
