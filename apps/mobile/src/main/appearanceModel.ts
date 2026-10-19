export type DisplayPreference = 'system' | 'light' | 'dark';
export type MainMode = 'light' | 'dark';
/**
 * App-wide dark mode is off until the C2 screens get dark styles (KNOWN_ISSUES).
 * This is the one seam: set it to true to let the stored preference resolve again.
 */
export const DARK_MODE_ENABLED = false;
export function displayPreference(value: unknown): DisplayPreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}
/** What the learner's stored preference would resolve to with dark mode on. */
export function preferredMode(preference: DisplayPreference, system: string | null | undefined): MainMode {
  return preference === 'system' ? system === 'dark' ? 'dark' : 'light' : preference;
}
/** The appearance the app actually draws. Pinned to light while dark mode is off. */
export function mainMode(preference: DisplayPreference, system: string | null | undefined): MainMode {
  return DARK_MODE_ENABLED ? preferredMode(preference, system) : 'light';
}
