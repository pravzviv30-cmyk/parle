/**
 * Which Friends a learner sees, and what the start says — Stage 3.
 *
 * Before joining, the tab offered three doors onto one setup. Now it is one
 * opt-in start with privacy as a quiet link beneath it, and the circle's own
 * doors appear once there is a circle. Nothing here changes what Friends is:
 * membership stays the server's, and joining stays optional.
 */

import type { SocialSnapshot } from './socialModel.ts';

export type FriendsEntry = 'loading' | 'start' | 'circle';

/** Unanswered, not yet joined, or joined. The tab draws exactly one of the three. */
export function friendsEntry(snapshot: SocialSnapshot | null): FriendsEntry {
  if (snapshot === null) return 'loading';
  return snapshot.settings.enabled ? 'circle' : 'start';
}

export const FRIENDS_START_TITLE = 'Your circle starts with one friend.';
export const FRIENDS_START_BODY = 'Choose a username, invite someone you know, and make room for French together. Joining is optional, and your recordings stay private.';
/** The one start, on the tab and on the privacy screen alike. */
export const FRIENDS_START = 'Set up Friends';
/** Secondary, beneath the start, for somebody who wants to read before joining. */
export const FRIENDS_PRIVACY_LINK = 'How Friends privacy works';

/**
 * Under the tab title: what the tab holds, said plainly (notebook Phase 4 copy
 * pass, 2026-09-27). It replaced the tagline "A little French, together.".
 */
export const FRIENDS_PURPOSE = 'A weekly board and shared challenges with people you know.';
/** Beside a name on the board with no points this week. It replaced "Ready when you are". */
export const FRIENDS_NO_POINTS = 'No points this week';

export const FRIENDS_COPY: readonly string[] = [
  FRIENDS_PURPOSE,
  FRIENDS_START_TITLE,
  FRIENDS_START_BODY,
  FRIENDS_START,
  FRIENDS_PRIVACY_LINK,
  FRIENDS_NO_POINTS,
];
