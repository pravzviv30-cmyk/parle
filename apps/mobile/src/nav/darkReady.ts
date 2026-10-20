/**
 * Which routes may draw dark (DECISIONS.md UI-008, 2026-10-20).
 *
 * Dark mode is on, but a screen only follows it once it has been rebuilt to
 * its canvas artboard in both themes. Until then it is pinned light: the
 * navigator wraps it in `<PinLight>`, so every shared part inside it reads
 * `b.light` and the screen looks exactly as it did before dark mode existed.
 * A rebuild step adds its route here, and nothing else changes.
 *
 * Some routes are light by rule, not by schedule: the first scene belongs to
 * onboarding, which stays light (the founder's decision), and the paywall is
 * unpinned only in its own later step. Those are in `ALWAYS_LIGHT`, which wins
 * over `DARK_READY`. Onboarding, sign up and the launch screen are not routes;
 * App.tsx mounts them under `<PinLight>` directly.
 *
 * This file imports nothing so the rule is testable without React Native.
 */

export type ThemeMode = 'light' | 'dark';

/** Routes rebuilt for dark. Starts empty; each rebuild step adds its route. */
export const DARK_READY: ReadonlySet<string> = new Set<string>([]);

/** Routes that stay light whatever DARK_READY says. */
export const ALWAYS_LIGHT: ReadonlySet<string> = new Set<string>(['FirstScene', 'Wall']);

/** Whether a route is pinned light, given the ready set (injectable for tests). */
export function pinnedLight(route: string, ready: ReadonlySet<string> = DARK_READY): boolean {
  return ALWAYS_LIGHT.has(route) || !ready.has(route);
}

/** The mode a route draws in when the provider resolves `mode`. */
export function routeMode(route: string | undefined, mode: ThemeMode, ready: ReadonlySet<string> = DARK_READY): ThemeMode {
  if (route === undefined) return 'light';
  return pinnedLight(route, ready) ? 'light' : mode;
}
