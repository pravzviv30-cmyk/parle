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

import type { Thread } from './threads.ts';

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

/**
 * What the remembers row says it will do, and where it goes — F573.
 *
 * The memory used to be a card with a heading, a line and an outline button
 * under it, and a second block of words when the plan did not open that button.
 * Revamp A makes it the peach row at the top of the tab: the tutor's mark, the
 * tutor's name, the one line, a chevron. A row has no room for a button and no
 * room for a paragraph, so the words that used to sit on buttons are what the
 * row promises instead: a chevron tells a sighted learner that pressing it goes
 * somewhere, the line above it says where, and the promise is spoken with the
 * rest of the row. The one arm that has news rather than a verb, the plan that
 * does not open, keeps its sentence on glass.
 *
 * It lives here rather than in `ContinuityCard.tsx` for the reason the rest of
 * this file does: apps/mobile has no renderer, so a branch inside a `.tsx` is a
 * branch nothing can ask a question of, and this one has four arms.
 */

/** A scene walked out of part way is picked back up where it was left. */
export const PICK_IT_UP = 'Pick it up';
/** A conversation that finished is carried on, which is the Max plan's door. */
export const KEEP_GOING = 'Keep going';
/** And when that door is shut, one honest line rather than a refused button. */
export const MAX_ONLY_ARC = 'Keeping a conversation going across sessions comes with the Max plan.';
/** With nothing to carry on, the row opens what the tutor remembers. */
export const SEE_MEMORY = 'See what your tutor remembers';

/**
 * Where the remembers row goes.
 *
 * `markPack` is the pack a successful room will mark as continued, and it is
 * only ever set on the one arm where the conversation actually carries on. It
 * rides on the route rather than being worked out again in the tab, then rides
 * through navigation until ConvoScreen receives its first live view. A mark on
 * the tap itself would retire a thread when the join failed or never opened.
 */
export type ContinuityRoute =
  | { screen: 'Convo'; params: { missionId: string }; markPack: null }
  | { screen: 'Convo'; params: { seedTopic: { fr: string; en: string } }; markPack: string }
  | { screen: 'Wall'; params: { entry: 'settings' }; markPack: null }
  | { screen: 'TutorMemory'; params: undefined; markPack: null };

export interface ContinuityRow {
  /** The line under the tutor's name: the thread's, or the memory's. */
  gloss: string;
  /** What pressing the row will do. */
  hint: string;
  /** The whole row, said once, for a learner who hears the screen. */
  label: string;
  route: ContinuityRoute;
}

/**
 * The row, decided from the thread and the plan.
 *
 * The thread's own line wins when there is a thread, because it is the more
 * specific of the two: "Au marche is waiting where you left it" is a fact about
 * this learner, and the memory line behind it is a fact about the last time
 * they spoke. With no thread at all the row still has something true to say,
 * and it opens the memory rather than a conversation, because offering to carry
 * on something that does not exist is the app inventing a history.
 *
 * The plan-gated arm is the one that says two sentences, and it says them on
 * glass rather than only to a screen reader. A row that reads "Keep talking
 * about your weekend" and opens a plans page is a trapdoor; the learner is told
 * where it goes before they press it, and the door itself is never refused
 * mid-tap.
 *
 * `label` is the whole row said once. `TintRow` would otherwise announce the
 * name and the line and nothing about what the row does, so the promise is
 * folded in here where a test can read it, rather than composed in the `.tsx`.
 */
export function continuityRow(input: {
  /** "<Name> remembers", from `continuity.ts`. */
  headline: string;
  /** What the tutor remembers, from `continuity.ts`. */
  line: string;
  /** The one thread to pick up, from `threads.ts`, or null. */
  thread: Thread | null;
  /** Whether keeping a conversation going is open on this plan. */
  continueAllowed: boolean;
}): ContinuityRow {
  const said = (gloss: string, hint: string, spoken = `${gloss} ${hint}.`): { gloss: string; hint: string; label: string } => ({
    gloss,
    hint,
    label: `${input.headline}. ${spoken}`,
  });
  const thread = input.thread;
  if (thread !== null && thread.kind === 'scene') {
    return {
      ...said(thread.line, PICK_IT_UP),
      route: { screen: 'Convo', params: { missionId: thread.missionId }, markPack: null },
    };
  }
  if (thread !== null && input.continueAllowed) {
    return {
      ...said(thread.line, KEEP_GOING),
      route: { screen: 'Convo', params: { seedTopic: thread.seedTopic }, markPack: thread.packId },
    };
  }
  if (thread !== null) {
    const gloss = `${thread.line} ${MAX_ONLY_ARC}`;
    return {
      ...said(gloss, MAX_ONLY_ARC, gloss),
      route: { screen: 'Wall', params: { entry: 'settings' }, markPack: null },
    };
  }
  return {
    ...said(input.line, SEE_MEMORY),
    route: { screen: 'TutorMemory', params: undefined, markPack: null },
  };
}
