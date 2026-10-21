export type DisplayPreference = 'system' | 'light' | 'dark';
export type MainMode = 'light' | 'dark';
/**
 * App-wide dark mode is on (DECISIONS.md UI-008, 2026-10-20). Screens that are
 * not rebuilt for dark yet are pinned light by route (nav/darkReady.ts), so this
 * stays the one seam: set it to false to draw everything light again.
 */
export const DARK_MODE_ENABLED = true;
export function displayPreference(value: unknown): DisplayPreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}
/** What the learner's stored preference would resolve to with dark mode on. */
export function preferredMode(preference: DisplayPreference, system: string | null | undefined): MainMode {
  return preference === 'system' ? system === 'dark' ? 'dark' : 'light' : preference;
}
/** The appearance the provider resolves. Light everywhere if the seam is off. */
export function mainMode(preference: DisplayPreference, system: string | null | undefined): MainMode {
  return DARK_MODE_ENABLED ? preferredMode(preference, system) : 'light';
}
