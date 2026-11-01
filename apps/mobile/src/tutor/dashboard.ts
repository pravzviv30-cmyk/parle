/**
 * Learner-facing words for the Tutor landing page.
 *
 * The page used to open on a greeting that changed through the day. The
 * founder's approved Tutor mockup opens with an invitation — "Talk with Luc" —
 * and a continuity promise underneath. That is a better opening because the
 * tab is about returning to one person, and because a header that changes by
 * the hour is a header a learner cannot use as a landmark.
 *
 * The words live here rather than in the screen for the reason docs/TESTING.md
 * gives: apps/mobile has no renderer, so a sentence written inside a `.tsx` is
 * a sentence nothing can check. `tutor/gate.ts` is the same move for the doors.
 *
 * `firstNameOf` stays even though the greeting that needed it is gone, because
 * `home/greeting.ts` imports it. One name rule for the whole app: a full name,
 * a padded name and a skipped name are split in exactly one place, so Home and
 * anything after it can never disagree about what a learner is called.
 */

/** Return the first name a learner asked us to use, or null when they skipped it. */
export function firstNameOf(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : null;
}

/** The continuity promise directly under "Talk with <name>" in UI 4. */
export const TUTOR_PURPOSE = 'Your tutor remembers where you left off.';

/**
 * The ready state's supporting line is the same promise, not a second slogan.
 * The landing page already draws it under the header and therefore withholds it
 * under the ready orb; the state model keeps it so any non-visual caller still
 * gets the complete ready description.
 */
export const TUTOR_ORB_SUBLINE = TUTOR_PURPOSE;
