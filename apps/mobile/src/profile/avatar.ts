/**
 * What the profile avatar draws, from the same name rule as Today's greeting.
 *
 * 2026-10-20, sim nits: with no first name Today said "Bonjour." while the
 * avatar showed "Y" from a 'You' fallback. Both now read `firstNameOf`, so a
 * skipped name draws a neutral person glyph rather than a letter nobody chose.
 */

import { firstNameOf } from '../tutor/dashboard.ts';

/** The initial to draw, or null for the neutral person glyph. */
export function avatarInitial(name: string | null | undefined): string | null {
  const first = firstNameOf(name);
  return first ? Array.from(first)[0]!.toLocaleUpperCase() : null;
}
