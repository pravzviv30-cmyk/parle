/**
 * When Home reads its storage again, and what a re-read may take off the
 * screen (F768).
 *
 * Home used to re-read every minute while it was on top, and every read
 * started by setting the scene to null, which is the branch that draws the
 * sand blocks. So a learner who left Home open watched the page blank and
 * redraw once a minute, and every motion on it would have replayed with it.
 *
 * Two rules, pure so they are tested without a renderer:
 *
 * - The timer only asks whether the local day has turned. A page drawn for
 *   today is not read again for nothing; a return to the foreground still
 *   reads, because the learner may have practised on another device.
 * - A re-read keeps what is drawn until the new read lands. Only a read for an
 *   account nothing has been drawn for (the first, or after an account switch)
 *   clears the page back to the sand blocks, so one learner's scene is never
 *   drawn under another learner's name.
 */

import { localDayKey } from '@luvani/core';

/** How often the focused Home asks whether the day has turned, in ms. Asking reads nothing. */
export const DAY_CHECK_MS = 60_000;

/** True once the local calendar day is no longer the one Home last read for. */
export function dayTurned(readFor: string, now: number): boolean {
  return localDayKey(now) !== readFor;
}

/**
 * Whether a read that is starting clears the page first: only when nothing has
 * been drawn for this account. `drawnFor` is the scope generation the last
 * landed read belonged to, or null before any has landed.
 */
export function refreshClears(drawnFor: number | null, scope: number): boolean {
  return drawnFor !== scope;
}
