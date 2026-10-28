/**
 * Whether this conversation screen was reached by reloading its own web
 * address (F923).
 *
 * The room does not survive a reload, but the address does, and the screen
 * used to start a fresh session on mount: minutes spent without asking, and in
 * whatever mode the stringified params read as. The honest signal is simple:
 * the path the page was loaded at, read once when this module loads, and only
 * the first conversation screen after that load is asked about it. Native has
 * no address and is never held.
 */

export const RELOAD_INTRO = {
  title: 'Your last conversation ended.',
  start: 'Start again',
  back: 'Back to Tutor',
} as const;

/** The path the web page was loaded at, before any in-app navigation. */
const coldPath: string | null =
  typeof window !== 'undefined' && typeof window.location?.pathname === 'string' ? window.location.pathname : null;
let consumed = false;

export function reloadedIntoConvo(state: { platform: string; coldPath: string | null; consumed: boolean }): boolean {
  return state.platform === 'web' && !state.consumed && state.coldPath !== null && /\/conversation\/?$/.test(state.coldPath);
}

/** Whether this load is a reload of the conversation address, until one screen has asked. Pure, so a double render agrees. */
export function isReload(platform: string): boolean {
  return reloadedIntoConvo({ platform, coldPath, consumed });
}

/** Called once the first conversation screen has mounted: every later one starts as usual. */
export function consumeReload(): void {
  consumed = true;
}
