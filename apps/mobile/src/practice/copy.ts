/**
 * What the Practice tab says about itself — F574.
 *
 * The tab used to open on the word "Practice" and a four word purpose, which
 * told a learner where they were and nothing about what the page was for. The
 * mockup replaced both with a sentence that answers the only question somebody
 * arriving here actually has: where did this come from, and what is it for.
 *
 * It lives here rather than in `PracticeTab.tsx` for the reason every string in
 * this app does: a screen holds layout, and a line nothing can import is a line
 * nothing can check. The copy sweeps read `PRACTICE_COPY`, so a sixth string
 * added below joins them by existing rather than by being remembered.
 *
 * The two action words are here and not in `nextStep.ts` because they are what
 * the control on the card says, not part of the rule that decides which control
 * it is. `nextStep.ts` reads the label from here so the headline over the card
 * and the card cannot drift apart.
 *
 * The two access lines are `copy/access.ts`'s (Stage 4, 2026-09-25): they
 * already said exactly what the shared vocabulary says, so they read it from
 * there and not one visible character changed.
 */

import { LIVE_MINUTES, NO_MINUTES } from '../copy/access.ts';

/**
 * The tab's own title: the word on the tab bar.
 *
 * Whole-app phase 2 took the two-line "Made from your conversations" heading
 * down to the tab's name. Where the practice comes from is said once, on the
 * card that names the conversation, which is where it is true.
 */
export const PRACTICE_TITLE = 'Practice';

/** The line under it: one short sentence, not a slogan. */
export const PRACTICE_PURPOSE = 'Short practice from what you have said.';

/** The caps label over the one card at the top of the tab. */
export const NEXT_PRACTICE_LABEL = 'Your next practice';

/** The control on a card whose phrase came from the deck. */
export const REVIEW_ACTION = 'Review';

/**
 * The control on a card whose phrase came from a conversation.
 *
 * "Practise" with an s: British spelling, and a verb here.
 */
export const PACK_ACTION = 'Practise this conversation';

/**
 * The quiet heading over the made-from rows, and the word that names their
 * conversation when the card above has not already (whole-app phase 2).
 *
 * The rows are alternatives to the recommended sitting, not three more steps,
 * so they sit under one quiet heading rather than a second heading repeating
 * the conversation's title.
 */
export const ALTERNATIVES = {
  label: 'More ways to practise',
  /** Before the conversation's title, when the rows need to say it. */
  from: 'From',
} as const;

/**
 * The recommended action at the top of the tab.
 *
 * No duration is promised: nobody has measured how long a short sitting takes,
 * and a number here would be the first claim the product cannot back. What is
 * said instead is what is true of every module sitting: it uses no live
 * minutes.
 */
export const RECOMMENDED = {
  start: 'Start a short practice',
  resume: 'Resume practice',
  /** Under the action, whichever it is. */
  noMinutes: NO_MINUTES,
  /** When the sitting draws on a saved conversation, before its title. */
  fromConversation: 'Includes phrases from',
  /** When only scheduled review contributed. */
  fromReview: 'Phrases your review is ready for.',
  /** When a sitting is waiting on this phone. */
  resumeLine: 'Pick up where you stopped.',
  /**
   * For a learner who already has a conversation but nothing to practise from
   * it yet. Never "first": they have had one (whole-app phase 2 review).
   */
  talk: 'Start a conversation',
  /** Said with `talk` while the newest conversation is still being prepared. */
  preparing: 'Your latest conversation is still being turned into practice.',
} as const;

/**
 * The quieter doors at the foot of the tab. `choose` is the one door into the
 * whole conversation library; "See your conversations" was a second door to
 * the same screen and went in whole-app phase 2.
 */
export const PRACTICE_ALTERNATIVES = {
  review: 'Scheduled review',
  choose: 'Choose a conversation',
  revisit: 'Revisit with your tutor',
  /** Said beside the tutor door, because the tutor is the one door that costs minutes. */
  revisitUses: LIVE_MINUTES,
} as const;

/**
 * Help inside a practice sitting: the known French line, on request. Asking is
 * always fine, and it is recorded so the result is called practice, not recall.
 */
export const PRACTICE_HELP = {
  show: 'Show the phrase',
  showLabel: 'Show the French phrase',
} as const;

/** What a practice sitting says at the end, chosen by `sittingStatement`. */
export const PRACTICE_END = {
  'recalled-some': 'You brought some of these back without choices.',
  practised: 'You practised these phrases.',
  'coming-back': 'These phrases will come round again.',
  /** Nothing playable, said as a fact rather than a finish. */
  empty: 'Nothing here can be practised right now.',
  emptyBody: 'Try another conversation, or talk with your tutor to make new practice.',
  /** The phone would not keep this sitting. Said plainly, with no finish claimed. */
  notSaved: 'This practice was not saved on this phone.',
  notSavedBody: 'Try again in a moment. Your earlier practice is still here.',
  /** Under a sitting the store confirmed: what happens to the phrases next. */
  after: 'Your review deck takes it from here.',
  /** Saved, but older than the recent history keeps, so it is not listed there. */
  savedOutsideHistory: 'Practice saved.',
  savedOutsideHistoryBody: 'This session is outside your recent history. Your review deck takes it from here.',
  /** Kept safe on this phone, still finishing its writes. */
  savedLocally: 'Kept on this phone. It will finish saving shortly.',
  /** The one door on a sitting that was not saved: the same save again. */
  retry: 'Try saving again',
  retrying: 'Saving',
  /** A saved sitting whose exercises are gone from this phone. */
  cannotResume: 'That practice can no longer be resumed.',
  cannotResumeBody: 'Its phrases are no longer on this phone. Start a new practice from Practice.',
  /** A resume link with no unfinished sitting saved: finished already, or never started. */
  nothingToResume: 'There is no unfinished practice to resume.',
  nothingToResumeBody: 'Start a new practice from Practice.',
  /** A practice link that could not be read. */
  unreadable: 'This practice link could not be opened.',
  unreadableBody: 'Go back to Practice and start it from there.',
} as const;

/** Every line this module can say, for the copy sweeps. */
export const PRACTICE_COPY: readonly string[] = [
  PRACTICE_TITLE,
  PRACTICE_PURPOSE,
  NEXT_PRACTICE_LABEL,
  REVIEW_ACTION,
  PACK_ACTION,
  ...Object.values(ALTERNATIVES),
  ...Object.values(RECOMMENDED),
  ...Object.values(PRACTICE_ALTERNATIVES),
  ...Object.values(PRACTICE_END),
  ...Object.values(PRACTICE_HELP),
];
