/**
 * Learner-facing words for the Tutor landing page.
 *
 * The page used to open on a greeting that changed through the day. The
 * founder's screenshot opens on the tutor instead: "Your Tutor, Luc", with the
 * promise underneath. That is a better opening because the tab is about one
 * person, and because a header that changes by the hour is a header a learner
 * cannot use as a landmark.
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

/**
 * The tab's header: the page's subject and who it is.
 *
 * The tutor's name is the tutor's, not the learner's. `tutorNameOf` has
 * already resolved whichever voice the learner chose, so this only sets it.
 */
export function tutorHeading(tutorName: string): string {
  return `Your Tutor, ${tutorName}`;
}

/**
 * The one line under the header saying what the tab is for.
 *
 * British spelling on purpose. The screenshot spells it the American way and
 * the rest of the app spells it "judgement", and a second convention inside one
 * app costs more than either spelling is worth.
 */
export const TUTOR_PURPOSE = 'Speak naturally. Zero judgement.';

/**
 * The line under the voice circle.
 *
 * It says what the conversation is like rather than what the control does, and
 * it names no pressure at all. It is a constant rather than a sentence about
 * the tutor because the name is already in the header two rows above, and
 * saying it twice on one screen reads as a script.
 */
export const TUTOR_ORB_SUBLINE = 'Gentle guidance, no pressure.';
