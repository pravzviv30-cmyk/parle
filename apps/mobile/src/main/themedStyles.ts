/**
 * The per-mode style cache behind `useThemedStyles` (main/bTheme.tsx). Pure so
 * it can be tested without React Native: a `make` is called at most once per
 * mode, and every caller of the same `make` shares the result.
 */
export type ModeTokens = { readonly mode: 'light' | 'dark' };

const cache = new WeakMap<object, { light?: unknown; dark?: unknown }>();

export function themedStyles<T, K extends ModeTokens>(make: (t: K) => T, t: K): T {
  let entry = cache.get(make);
  if (entry === undefined) { entry = {}; cache.set(make, entry); }
  if (entry[t.mode] === undefined) entry[t.mode] = make(t);
  return entry[t.mode] as T;
}
