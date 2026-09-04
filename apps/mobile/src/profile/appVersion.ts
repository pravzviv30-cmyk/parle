/**
 * Which build this is, said once at the bottom of Profile.
 *
 * A version line is the first thing anyone asks for when a learner writes in
 * about something that went wrong, and until now the only answer was "whatever
 * the store had that week". It costs one line and it is the difference between
 * a reproducible report and a guess.
 *
 * ## Why the expo read is not in this file
 *
 * `expo-constants` cannot be loaded by the mobile test runner: it pulls
 * `expo-modules-core`, which ships TypeScript inside `node_modules`, and node's
 * type stripping refuses to touch anything under there. So the rule lives here
 * as a plain function over an `unknown`, and the one line that actually asks
 * the app config sits in `ProfileTab.tsx` beside the text it draws. That keeps
 * the decision testable, which is the whole house technique, and it keeps the
 * untestable part down to a property read with no branch in it.
 *
 * `unknown` rather than `string | undefined` on purpose. `expoConfig` is typed
 * optimistically and comes from a JSON file that a build can ship without a
 * version at all, so the guard has to be real rather than decorative.
 */

/** The product's own name, as the footer says it. */
const APP_NAME = 'Luvani';

/**
 * "Luvani 0.1.0", or nothing at all.
 *
 * Nothing at all is the important half. A footer reading "Luvani undefined", or
 * a bare product name with a blank after it, is worse than no line: it looks
 * like a bug in the place a learner goes to check whether they have found one.
 * Anything that is not a non-empty string, once trimmed, is answered with null
 * and the line is simply absent.
 */
export function appVersionLine(version: unknown): string | null {
  if (typeof version !== 'string') return null;
  const trimmed = version.trim();
  return trimmed.length === 0 ? null : `${APP_NAME} ${trimmed}`;
}
